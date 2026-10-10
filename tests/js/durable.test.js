import { test } from "node:test";
import assert from "node:assert/strict";
import { durableChecks } from "../../public/js/durable.js";
import { analyze } from "../../public/js/flags.js";
import { YEARS, company, nulls } from "./company.js";

const flat = (v) => YEARS.map(() => v);
const checks = (d) => durableChecks(d, analyze(d));
const row = (d, name) => checks(d).find((c) => c.name === name);
const status = (d, name) => row(d, name).status;

// A business with every sign of a lasting edge, figures in millions
const strong = (over = {}, extra = {}) => company({
  revenue: flat(1000e6), grossProfit: flat(600e6), sga: flat(150e6), researchAndDevelopment: flat(20e6),
  depreciation: flat(30e6), operatingIncome: flat(400e6), interestExpense: flat(20e6), netIncome: flat(250e6),
  eps: YEARS.map((_, i) => 2 + i * 0.2), retainedEarnings: YEARS.map((_, i) => 1000e6 + i * 100e6),
  totalLiabilities: flat(500e6), equity: flat(800e6), treasuryStock: flat(200e6), longTermDebt: flat(400e6),
  preferredStock: flat(0), capex: flat(60e6), dilutedShares: YEARS.map((_, i) => 100e6 - i * 1e6), ...over,
}, extra);

test("a business with every sign of a lasting edge passes all 14 tests", () => {
  const rows = checks(strong());
  assert.equal(rows.length, 14);
  assert.deepEqual(rows.filter((c) => c.status !== "pass").map((c) => c.name), []);
  assert.match(row(strong(), "Lean overheads").actual, /25\.0% of gross profit over 10 years \(excellent\)/);
  assert.match(row(strong(), "Low debt to equity").actual, /0\.50 times equity, including shares bought back/);  // 500 / (800 + 200)
});

test("each test fails on its own warning sign", () => {
  const fails = (over, name) => assert.equal(status(strong(over), name), "fail", name);
  fails({ grossProfit: flat(300e6) }, "High gross margin");                 // 30% of revenue
  fails({ sga: flat(540e6) }, "Lean overheads");                            // 90% of gross profit
  fails({ researchAndDevelopment: flat(240e6) }, "Modest R&D burden");      // 40% of gross profit
  fails({ depreciation: flat(90e6) }, "Light depreciation");                // 15% of gross profit
  fails({ interestExpense: flat(80e6) }, "Small interest bill");            // 20% of operating income
  fails({ netIncome: flat(100e6) }, "High net margin");                     // 10% of revenue
  fails({ eps: YEARS.map((_, i) => (i % 2 ? 2 : 3)) }, "Earnings rising steadily");
  fails({ totalLiabilities: flat(900e6) }, "Low debt to equity");           // 0.9 times
  fails({ longTermDebt: flat(1500e6) }, "Long-term debt easily repaid");    // 6 years of net income
  fails({ preferredStock: flat(50e6) }, "No preferred stock");
  fails({ capex: flat(150e6) }, "Low capital spending");                    // 60% of net income
  fails({ dilutedShares: YEARS.map((_, i) => 100e6 + i * 1e6) }, "Shares being bought back");
});

test("falling retained earnings pass when the profits went to buybacks, and fail otherwise", () => {
  const shrinking = YEARS.map((_, i) => 1000e6 - i * 100e6);
  assert.equal(status(strong({ retainedEarnings: shrinking }), "Retained earnings building up"), "pass");  // shares fell
  assert.match(row(strong({ retainedEarnings: shrinking }), "Retained earnings building up").actual, /profits went to buybacks: 9% fewer shares/);
  const issuing = YEARS.map((_, i) => 100e6 + i * 1e6);
  assert.equal(status(strong({ retainedEarnings: shrinking, dilutedShares: issuing }), "Retained earnings building up"), "fail");
});

test("missing figures are not reported rather than failed, and no R&D counts as a modest burden", () => {
  const d = strong({ sga: nulls(), depreciation: nulls(), researchAndDevelopment: nulls() });
  assert.equal(status(d, "Lean overheads"), "na");
  assert.equal(row(d, "Light depreciation").actual, "Not reported");
  assert.equal(status(d, "Modest R&D burden"), "pass");
  assert.equal(row(d, "Modest R&D burden").actual, "No R&D reported");
  assert.equal(status(strong({ longTermDebt: nulls() }), "Long-term debt easily repaid"), "pass");
});

test("banks are only judged on earnings, retained earnings, preferred stock, treasury stock and buybacks", () => {
  const bank = strong({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: flat(100e9),
                        totalLiabilities: flat(90e9), equity: flat(10e9) });
  const judged = checks(bank).filter((c) => c.status !== "na").map((c) => c.name);
  assert.deepEqual(judged, ["Earnings rising steadily", "Retained earnings building up", "No preferred stock", "Treasury stock held", "Shares being bought back"]);
});

test("treasury stock held passes; none held or reported doesn't apply, because many companies cancel bought-back shares", () => {
  assert.equal(status(strong(), "Treasury stock held"), "pass");
  assert.equal(row(strong(), "Treasury stock held").actual, "$200.0M of its own shares held");
  assert.equal(status(strong({ treasuryStock: flat(-200e6) }), "Treasury stock held"), "pass");   // a negative sign in the filing
  for (const none of [flat(0), nulls()]) {
    const r = row(strong({ treasuryStock: none }), "Treasury stock held");
    assert.equal(r.status, "na");
    assert.match(r.actual, /may cancel the shares it buys back/);
  }
});
