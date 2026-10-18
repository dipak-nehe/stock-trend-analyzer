import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_FUNDS, benchmark, breakdownRows, compareRows, costOverYears, holdingRows, overlap, overlapPairs, parseFunds, reportDate, risk, topShare, versusIndex, yearly } from "../../src/funds.ts";
import { setLang } from "../../src/i18n.ts";
import type { ChartPoint, Fund } from "../../src/types.ts";

const fund = (over: Record<string, unknown> = {}): Fund => ({
  ticker: "AAA", fund: "A Fund", form: "N-CSR", expenseRatio: 0.0003, costPer10k: 3, periodEnd: "2025-12-31",
  returns: { 1: 0.18, 5: 0.14, 10: 0.15 }, netAssets: 1e12, holdings: 500, turnover: 0.02,
  indexes: [{ name: "Broad", kind: "broad", returns: { 1: 0.17, 10: 0.14 } }, { name: "S&P 500 Index", kind: "additional", returns: { 1: 0.18, 10: 0.152 } }],
  ...over,
}) as unknown as Fund;
const row = <R extends { key: string }>(rows: R[], key: string) => rows.find((r) => r.key === key);

test("tickers are read from a list: upper case, no duplicates, at most four", () => {
  assert.deepEqual(parseFunds("voo, fxaix VOO bnd schd agthx"), ["VOO", "FXAIX", "BND", "SCHD"]);
  assert.equal(MAX_FUNDS, 4);
  assert.deepEqual(parseFunds("<x> ,,"), []);
});

test("cost over 20 years: what a yearly cost takes from $10,000 growing 7% a year", () => {
  assert.equal(costOverYears(0), 0);
  assert.ok(Math.abs(costOverYears(0.0003) - 216) < 1);    // an index ETF
  assert.ok(Math.abs(costOverYears(0.006) - 4116) < 1);    // an active fund: about 19 times as much
  assert.equal(costOverYears(null), null);
});

test("a fund is set against its own index when the report names one, else the broad market", () => {
  assert.equal(benchmark(fund()).name, "S&P 500 Index");
  assert.equal(benchmark(fund({ indexes: [{ name: "", kind: "broad", returns: {} }] })).kind, "broad");
  assert.equal(benchmark(fund({ indexes: [] })), null);
  assert.ok(Math.abs(versusIndex(fund(), "10") - (0.15 - 0.152)) < 1e-12);
});

test("side by side: the lower cost, higher return and lower turnover are marked; size isn't", () => {
  setLang("en");
  const { rows } = compareRows([fund(), fund({ ticker: "BBB", expenseRatio: 0.006, costPer10k: 67, turnover: 0.32, returns: { 1: 0.16, 5: 0.12, 10: 0.16 }, netAssets: 3e11 })]);
  assert.deepEqual(row(rows, "expenseRatio").cells.map((c) => [c.text, c.best]), [["0.03%", true], ["0.60%", false]]);
  assert.deepEqual(row(rows, "cost20").cells.map((c) => c.text), ["$216", "$4,116"]);
  assert.deepEqual(row(rows, "ret10").cells.map((c) => c.best), [false, true]);
  assert.deepEqual(row(rows, "turnover").cells.map((c) => c.best), [true, false]);
  assert.ok(row(rows, "netAssets").cells.every((c) => !c.best));
  assert.equal(row(rows, "top10"), undefined);                     // nobody reports it: the row is left out
  assert.match(row(rows, "vsIndex10").cells[0].text, /^−0\.20%<span[^>]*>vs S&amp;P 500 Index, 10 years</);
  const evil = compareRows([fund({ indexes: [{ name: "<img src=x>", kind: "additional", returns: { 10: 0.1 } }] })]).rows;
  assert.doesNotMatch(row(evil, "vsIndex10").cells[0].text, /<img/);   // index names come from filings: escaped
});

test("one fund alone gets no marks; equal values get none either", () => {
  assert.ok(compareRows([fund()]).rows.every((r) => r.cells.every((c) => !c.best)));
  assert.ok(row(compareRows([fund(), fund({ ticker: "B" })]).rows, "expenseRatio").cells.every((c) => !c.best));
});

test("returns over years ending on different dates get a caveat; a half-year report has no yearly cost or returns", () => {
  setLang("en");
  const half = fund({ ticker: "QQQ", form: "N-CSRS", returns: {}, periodEnd: undefined });
  const { rows, caveat } = compareRows([fund(), fund({ ticker: "FX", periodEnd: "2026-02-28" }), half]);
  assert.equal(caveat, "The returns cover years ending on different dates (AAA Dec 31, 2025, FX Feb 28, 2026), so they aren't an exact match.");
  assert.equal(row(rows, "costPer10k").cells[2].text, "n/a");
  assert.equal(row(rows, "ret1").cells[2].text, "n/a");
});

test("the portfolio split shows the largest six, then the rest together", () => {
  setLang("en");
  const rows = breakdownRows(fund({ breakdown: { by: "IndustrySector", rows: [["A", 0.3], ["B", 0.2], ["C", 0.1], ["D", 0.1], ["E", 0.1], ["F", 0.1], ["G", 0.06], ["H", 0.04]] } }));
  assert.deepEqual(rows.map((r) => r.label), ["A", "B", "C", "D", "E", "F", "Other"]);
  assert.ok(Math.abs(rows[6].share - 0.1) < 1e-12);
  assert.deepEqual(breakdownRows(fund({ breakdown: null })), []);
});

test("report dates read naturally in each language", () => {
  setLang("en");
  assert.equal(reportDate("2025-12-31"), "Dec 31, 2025");
  setLang("es");
  try { assert.match(reportDate("2025-12-31"), /^31 dic\.? 2025$/); } finally { setLang("en"); }
});

test("the top 10 come from the holdings list, with their share of the fund; else the report's share", () => {
  const topTen = { asOf: "2026-06-30", pct: 37.87, rows: [{ name: "NVIDIA Corp", pct: 7.51, securities: 1 }, { name: "Alphabet Inc", pct: 5.84, securities: 2 }] };
  assert.deepEqual(holdingRows(fund({ topTen })), [{ rank: 1, name: "NVIDIA Corp", share: 0.0751, securities: 1 }, { rank: 2, name: "Alphabet Inc", share: 0.0584, securities: 2 }]);
  assert.ok(Math.abs(topShare(fund({ topTen })) - 0.3787) < 1e-12);
  assert.equal(topShare(fund({ topHoldings: { count: 10, pct: 0.412 } })), 0.412);
  assert.equal(topShare(fund({ topHoldings: { count: 7, pct: 0.3 } })), null);    // not a top 10
  assert.deepEqual(holdingRows(fund()), []);
});

test("the growth chart's yearly points, the worst year and the years with a loss", () => {
  const quarters: ChartPoint[] = [["2023-12-31", 10000], ["2024-03-31", 9000], ["2024-12-31", 12000], ["2025-06-30", 11000], ["2025-12-31", 10800]];
  assert.deepEqual(yearly(quarters).map(([d]) => d), ["2023-12-31", "2024-12-31", "2025-12-31"]);
  const r = risk(fund({ growth: { fund: [["2021-12-31", 10000], ["2022-12-31", 8000], ["2023-12-31", 10000], ["2024-12-31", 12000], ["2025-12-31", 10800]] } }));
  assert.ok(Math.abs(r.worst.ret + 0.2) < 1e-12);
  assert.equal(r.worst.date, "2022-12-31");
  assert.deepEqual([r.down, r.years], [2, 4]);
  // a sales charge taken on day one isn't a market loss: that first year is left out
  const charged = risk(fund({ growth: { fund: [["2021-08-31", 9425], ["2022-08-31", 9500], ["2023-08-31", 10500], ["2024-08-31", 11000]] } }));
  assert.deepEqual([charged.down, charged.years], [0, 2]);
  assert.equal(risk(fund({ growth: null })), null);
});

test("overlap: the smaller weight of each shared holding, added up, with the largest shared ones", () => {
  const a = fund({ ticker: "A", topTen: { weights: [["NVDA", 7, "NVIDIA"], ["AAPL", 6, "Apple"], ["XOM", 1, "Exxon"]] } });
  const b = fund({ ticker: "B", topTen: { weights: [["AAPL", 4, "Apple"], ["NVDA", 8, "NVIDIA"], ["BND", 50, "Bonds"]] } });
  const o = overlap(a, b);
  assert.ok(Math.abs(o.pct - 0.11) < 1e-12);                       // min(7,8) + min(6,4) = 11%
  assert.deepEqual(o.top.map((h) => h.name), ["NVIDIA", "Apple"]);
  assert.equal(o.count, 2);
  assert.equal(overlap(a, fund({ topTen: null })), null);
  assert.deepEqual(overlapPairs([a, b, fund({ ticker: "C" })]).map((p) => `${p.a}-${p.b}`), ["A-B"]);
});

test("returns after a sales charge get their own row, only when a fund has one", () => {
  setLang("en");
  const plain = compareRows([fund()]).rows;
  assert.equal(plain.find((r) => r.key === "afterCharge10"), undefined);
  const charged = compareRows([fund(), fund({ ticker: "C", returnsAfterSalesCharge: { 1: 0.16, 5: 0.12, 10: 0.1437 } })]).rows;
  assert.deepEqual(charged.find((r) => r.key === "afterCharge10").cells.map((c) => c.text.replace(/<[^>]+>/g, " ")), ["n/a", "14.4% 10 years "]);
});

test("two share classes of one fund are the same portfolio", () => {
  const w = { weights: [["NVDA", 7, "NVIDIA"]] };
  const o = overlap(fund({ ticker: "VOO", seriesId: "S1", topTen: w }), fund({ ticker: "VFIAX", seriesId: "S1", topTen: w }));
  assert.deepEqual([o.pct, o.same], [1, true]);
});
