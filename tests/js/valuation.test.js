import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../../public/js/flags.js";
import { valueChecks } from "../../public/js/valuation.js";
import { YEARS, company, nulls } from "./company.js";

const checks = (d, price = null) => valueChecks(d, price, analyze(d));
const row = (list, name) => list.find((c) => c.name === name);

test("Graham Number is sqrt(22.5 x EPS x book value per share)", () => {
  const d = company();
  const v = checks(d);
  const eps = d.series.eps.at(-1), bvps = d.series.equity.at(-1) / d.sharesOutstanding.value;
  assert.ok(Math.abs(v.grahamNumber - Math.sqrt(22.5 * eps * bvps)) < 1e-9);
  assert.ok(Math.abs(v.bvps - bvps) < 1e-9);
});

test("valuation rows wait for a price, then pass or fail against it", () => {
  const d = company();
  assert.equal(row(checks(d).graham, "Moderate P/E").status, "price");
  const eps3 = d.series.eps.slice(-3).reduce((a, b) => a + b) / 3;
  assert.equal(row(checks(d, eps3 * 14).graham, "Moderate P/E").status, "pass");
  assert.equal(row(checks(d, eps3 * 16).graham, "Moderate P/E").status, "fail");
  assert.match(row(checks(d, eps3 * 16).graham, "Moderate P/E").actual, /P\/E 16\.0/);
});

test("the owner-earnings estimate rises with growth and supports the margin-of-safety test", () => {
  const slow = checks(company({ eps: YEARS.map(() => 1) })).iv;
  const fast = checks(company()).iv;
  assert.ok(fast > slow && slow > 0);
  assert.equal(row(checks(company(), fast * 0.7).buffett, "Margin of safety").status, "pass");
  assert.equal(row(checks(company(), fast * 0.9).buffett, "Margin of safety").status, "fail");
});

test("growth assumption is capped at 12% a year", () => {
  const rocket = company({ eps: YEARS.map((_, i) => Math.pow(1.5, i)) });
  assert.equal(checks(rocket).g, 0.12);
});

test("balance-sheet rules are N/A for banks", () => {
  const bank = company({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: YEARS.map(() => 100e9),
                         totalLiabilities: YEARS.map(() => 90e9), equity: YEARS.map(() => 10e9) });
  const v = checks(bank);
  for (const name of ["Strong current position", "Debt covered by working capital"]) assert.equal(row(v.graham, name).status, "na", name);
  for (const name of ["Conservative debt", "Low capital needs", "Margin of safety"]) assert.equal(row(v.buffett, name).status, "na", name);
});

test("negative equity makes ROE not meaningful rather than a pass", () => {
  const v = checks(company({ equity: YEARS.map((_, i) => (i === 3 ? -5e6 : 1000e6)) }));
  assert.equal(row(v.buffett, "High return on equity").status, "na");
});

test("Graham's debt test uses long-term debt, Buffett's uses total debt", () => {
  const d = company({ longTermDebt: YEARS.map(() => 300e6), totalDebt: YEARS.map(() => 900e6) });
  const v = checks(d);
  assert.match(row(v.graham, "Debt covered by working capital").actual, /Long-term debt \$300\.0M/);
  const years = 900e6 / d.series.netIncome.at(-1);
  assert.match(row(v.buffett, "Conservative debt").actual, new RegExp(`${years.toFixed(1)} years of earnings`));
});

test("size threshold only applies to USD reporters", () => {
  assert.equal(row(checks(company({}, { currency: "TWD" })).graham, "Adequate size").status, "na");
  assert.equal(row(checks(company()).graham, "Adequate size").status, "pass");
});
