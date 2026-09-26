import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../../public/js/flags.js";
import { YEARS, company, events, history, nulls } from "./company.js";

const titles = (d) => analyze(d).flags.map((f) => f.title);
const flag = (d, title) => analyze(d).flags.find((f) => f.title === title);

test("a steady, profitable company collects strengths and no critical flags", () => {
  const r = analyze(company());
  assert.equal(r.flags.filter((f) => f.sev === "critical").length, 0);
  for (const t of ["Consistent revenue growth", "Profitable every year", "Clean filing record", "Share buybacks"]) {
    assert.ok(titles(company()).includes(t), t);
  }
});

test("flags are ordered critical, warning, strength, note", () => {
  const d = company({ netIncome: [...Array(9).fill(100e6), -50e6], totalDebt: YEARS.map(() => 1500e6) });
  const order = { critical: 0, warning: 1, good: 2, info: 3 };
  const sevs = analyze(d).flags.map((f) => order[f.sev]);
  assert.deepEqual(sevs, [...sevs].sort((a, b) => a - b));
});

test("a loss in the last three years is critical; an older loss is a warning", () => {
  assert.equal(flag(company({ netIncome: [...Array(9).fill(100e6), -1e6] }), "Recent net losses").sev, "critical");
  assert.equal(flag(company({ netIncome: [-1e6, ...Array(9).fill(100e6)] }), "Past net losses").sev, "warning");
});

test("debt to equity thresholds", () => {
  const withDebt = (debt) => company({ totalDebt: YEARS.map(() => debt), equity: YEARS.map(() => 1000e6) });
  assert.equal(flag(withDebt(2500e6), "Very high debt vs equity").sev, "critical");
  assert.equal(flag(withDebt(1500e6), "Elevated debt vs equity").sev, "warning");
  assert.equal(flag(withDebt(300e6), "Low leverage").sev, "good");
});

test("banks skip debt and liquidity rules", () => {
  const bank = company({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: YEARS.map(() => 100e9),
                         totalLiabilities: YEARS.map(() => 90e9), totalDebt: YEARS.map(() => 50e9), equity: YEARS.map(() => 10e9) });
  const t = titles(bank);
  assert.ok(t.includes("Looks like a bank or insurer"));
  assert.ok(!t.some((x) => /debt vs equity|Current ratio|liquidity/.test(x)));
});

test("current ratio and interest coverage", () => {
  assert.equal(flag(company({ currentLiabilities: YEARS.map(() => 900e6) }), "Weak short-term liquidity").sev, "critical");
  assert.equal(flag(company({ operatingIncome: YEARS.map(() => 20e6) }), "Thin interest coverage").sev, "warning");
  assert.equal(flag(company({ operatingIncome: YEARS.map(() => -5e6) }), "Interest not covered").sev, "critical");
});

test("earnings that aren't backed by cash", () => {
  const d = company({ operatingCashFlow: YEARS.map(() => 50e6), netIncome: YEARS.map(() => 100e6) });
  assert.match(flag(d, "Earnings not backed by cash").why, /2021, 2022, 2023, 2024, 2025/);
});

test("a recent dividend cut to zero is critical and says so", () => {
  const dps = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.6, 0.8, 0];
  const f = flag(company({ dps }), "Dividend cut, then suspended");
  assert.equal(f.sev, "critical");
  assert.match(f.why, /2024, 2025 and is now zero/);
});

test("dividends larger than earnings", () => {
  const d = company({ dividendsPaid: YEARS.map(() => 300e6), netIncome: YEARS.map(() => 100e6) });
  assert.equal(flag(d, "Dividend exceeds earnings").sev, "critical");
});

test("SEC filing record: restatement, auditor change and repeated late filings", () => {
  const h = history(events(["late_filing", "2025-02-11"], ["late_filing", "2024-11-13"], ["late_filing", "2024-08-30"],
                           ["auditor_change", "2024-10-30"], ["non_reliance", "2018-11-15"], ["sec_letter", "2020-01-01"]));
  const d = company({}, { secHistory: h });
  assert.equal(flag(d, "Financial statements were restated").sev, "critical");
  assert.equal(flag(d, "Auditor changed").sev, "warning");
  const late = flag(d, "Late SEC filings");
  assert.equal(late.sev, "critical");
  assert.match(late.why, /3 late-filing notices since 2016, most recently 2025-02-11/);
  assert.ok(!titles(d).includes("Clean filing record"));
});

test("one late filing is only a warning, and routine SEC letters don't count against a company", () => {
  assert.equal(flag(company({}, { secHistory: history(events(["late_filing", "2025-01-01"])) }), "Late SEC filings").sev, "warning");
  assert.ok(titles(company({}, { secHistory: history(events(["sec_letter", "2025-01-01"])) })).includes("Clean filing record"));
});

test("free cash flow and net margin are returned for the other views", () => {
  const r = analyze(company());
  assert.equal(r.fcf[0], 130e6 - 30e6);
  assert.ok(Math.abs(r.nm[0] - 0.1) < 1e-9);
  assert.equal(r.financial, false);
});
