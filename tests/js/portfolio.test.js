import { test } from "node:test";
import assert from "node:assert/strict";
import { COLUMNS, MAX_ROWS, checkName, medians, parseTickers, portfolioRow, sortRows, tone } from "../../public/js/portfolio.js";
import { YEARS, company, nulls } from "./company.js";
import { analyze } from "../../public/js/flags.js";
import { durableChecks } from "../../public/js/durable.js";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const cagr = (a, b, n = 9) => Math.pow(b / a, 1 / n) - 1;
const col = (key) => COLUMNS.find((c) => c.key === key);

test("ten percentage columns and the balance-sheet score, over the company's own years", () => {
  assert.equal(COLUMNS.filter((c) => c.kind !== "score").length, 10);
  assert.deepEqual(COLUMNS.filter((c) => c.kind === "score").map((c) => c.key), ["balance"]);
  const row = portfolioRow(company());
  assert.deepEqual(Object.keys(row.cells), COLUMNS.map((c) => c.key));
  assert.deepEqual([row.ticker, row.from, row.to], ["TEST", 2016, 2025]);
});

test("growth columns are the average growth per year from the first to the latest year", () => {
  const d = company(), s = d.series, c = portfolioRow(d).cells;
  close(c.revenue.v, cagr(s.revenue[0], s.revenue[9]));
  close(c.eps.v, cagr(s.eps[0], s.eps[9]));
  close(c.dps.v, cagr(s.dps[0], s.dps[9]));
  const fcf = (i) => s.operatingCashFlow[i] - s.capex[i];
  close(c.fcf.v, cagr(fcf(0), fcf(9)));
  const bvps = (i) => s.equity[i] / s.dilutedShares[i];
  close(c.bvps.v, cagr(bvps(0), bvps(9)));
  close(c.shares.v, cagr(s.dilutedShares[0], s.dilutedShares[9]));
  assert.ok(c.shares.v < 0);  // the test company buys back shares
});

test("margins and returns are totals over the period, so one odd year can't dominate", () => {
  const d = company(), s = d.series, c = portfolioRow(d).cells;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  close(c.netMargin.v, sum(s.netIncome) / sum(s.revenue));
  close(c.roe.v, sum(s.netIncome) / sum(s.equity));
  const fcf = s.operatingCashFlow.map((o, i) => o - s.capex[i]);
  close(c.fcfMargin.v, sum(fcf) / sum(s.revenue));
  assert.ok(c.rotc.v > 0);  // from the value checks (valuation.js), the same figure as the results page
});

test("growth that can't be measured says why", () => {
  const lossNow = portfolioRow(company({ eps: YEARS.map((_, i) => (i === 9 ? -1 : 1 + i)) })).cells.eps;
  assert.deepEqual(lossNow, { v: null, why: "negativeEnd" });
  const lossThen = portfolioRow(company({ eps: YEARS.map((_, i) => (i === 0 ? -1 : 1 + i)) })).cells.eps;
  assert.equal(lossThen.v, null);
  assert.equal(lossThen.why, "negativeStart");
  assert.deepEqual(portfolioRow(company({ dps: YEARS.map(() => 0) })).cells.dps, { v: null, why: "noDividend" });
  assert.deepEqual(portfolioRow(company({ dps: nulls() })).cells.dps, { v: null, why: "noDividend" });
  assert.deepEqual(portfolioRow(company({ dps: YEARS.map((_, i) => (i < 3 ? 0 : 0.5)) })).cells.dps, { v: null, why: "startedDividend" });
  // Intel suspended its dividend in 2024: a stopped dividend, not a loss
  assert.deepEqual(portfolioRow(company({ dps: YEARS.map((_, i) => (i > 7 ? 0 : 0.5)) })).cells.dps, { v: null, why: "stoppedDividend" });
  assert.equal(portfolioRow(company({ revenue: YEARS.map((_, i) => (i === 9 ? 5e8 : null)) })).cells.revenue.why, "notEnough");
  assert.deepEqual(portfolioRow(company({ equity: YEARS.map((_, i) => (i === 4 ? -1e6 : 1e9)) })).cells.roe, { v: null, why: "negativeEquity" });
});

test("cash-flow and capital measures are N/A for banks", () => {
  const bank = company({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: YEARS.map(() => 100e9),
                         totalLiabilities: YEARS.map(() => 90e9), equity: YEARS.map(() => 10e9) });
  const c = portfolioRow(bank).cells;
  for (const key of ["fcf", "rotc", "fcfMargin"]) assert.deepEqual(c[key], { v: null, why: "bank" }, key);
  assert.ok(c.revenue.v != null && c.roe.v != null);
});

test("cell colours: growth and returns by their yardsticks, and fewer shares is the good direction", () => {
  assert.equal(tone(col("revenue"), 0.07), "good");
  assert.equal(tone(col("revenue"), 0.03), "");
  assert.equal(tone(col("revenue"), -0.01), "bad");
  assert.equal(tone(col("roe"), 0.2), "good");
  assert.equal(tone(col("roe"), 0.05), "bad");
  assert.equal(tone(col("shares"), -0.02), "good");  // buybacks
  assert.equal(tone(col("shares"), 0.01), "");
  assert.equal(tone(col("shares"), 0.05), "bad");    // dilution
  assert.equal(tone(col("eps"), null), "");
});

test("the balance-sheet column counts the Durable advantage tab's five balance-sheet tests", () => {
  const d = company(), cell = portfolioRow(d).cells.balance;
  const ids = ["retained", "debtToEquity", "longTermDebt", "preferred", "treasury"];
  const rows = durableChecks(d, analyze(d)).filter((c) => ids.includes(c.id) && (c.status === "pass" || c.status === "fail"));
  assert.equal(cell.judged, rows.length);
  assert.equal(cell.met, rows.filter((c) => c.status === "pass").length);
  // A preferred-stock issue fails one of them and is named
  const pref = portfolioRow(company({ preferredStock: YEARS.map(() => 50e6) })).cells.balance;
  assert.equal(pref.met, cell.met - 1);
  assert.deepEqual(pref.notMet.filter((id) => !cell.notMet.includes(id)), ["preferred"]);
  assert.equal(checkName("preferred"), durableChecks(d, analyze(d)).find((c) => c.id === "preferred").name);
  // For a bank, the debt tests are N/A: only the two that apply (retained earnings, preferred stock) are counted
  const bank = company({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: YEARS.map(() => 100e9),
                         totalLiabilities: YEARS.map(() => 90e9), equity: YEARS.map(() => 10e9),
                         retainedEarnings: YEARS.map((_, i) => 5e9 + i * 1e8) });
  assert.equal(portfolioRow(bank).cells.balance.judged, 2);
});

test("the balance-sheet score is green from three quarters passed and red under half", () => {
  assert.equal(tone(col("balance"), 0.75), "good");
  assert.equal(tone(col("balance"), 0.6), "");
  assert.equal(tone(col("balance"), 0.25), "bad");
});

test("the median row skips stocks without a value", () => {
  const rows = [0.1, 0.3, null, 0.2].map((v) => ({ cells: Object.fromEntries(COLUMNS.map((c) => [c.key, { v }])) }));
  close(medians(rows).revenue, 0.2);
  close(medians(rows.slice(0, 2)).eps, 0.2);         // even count: the middle two averaged
  assert.equal(medians([rows[2]]).roe, null);
});

test("sorting puts stocks without a value last, whichever the direction", () => {
  const r = (ticker, v) => ({ ticker, cells: { roe: { v } } });
  const rows = [r("A", 0.1), r("B", null), r("C", 0.3)];
  assert.deepEqual(sortRows(rows, "roe", -1).map((x) => x.ticker), ["C", "A", "B"]);
  assert.deepEqual(sortRows(rows, "roe", 1).map((x) => x.ticker), ["A", "C", "B"]);
  assert.deepEqual(sortRows(rows, "ticker", 1).map((x) => x.ticker), ["A", "B", "C"]);
});

test("tickers from a link or storage are cleaned, de-duplicated and capped", () => {
  assert.deepEqual(parseTickers("ko, aapl  KO,brk.b,,<script>"), ["KO", "AAPL", "BRK.B"]);
  assert.deepEqual(parseTickers(null), []);
  const many = Array.from({ length: 40 }, (_, i) => `T${i}`).join(",");
  assert.equal(parseTickers(many).length, MAX_ROWS);
});
