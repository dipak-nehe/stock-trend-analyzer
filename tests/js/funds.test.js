import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_FUNDS, benchmark, breakdownRows, compareRows, costOverYears, parseFunds, reportDate, versusIndex } from "../../public/js/funds.js";
import { setLang } from "../../public/js/i18n.js";

const fund = (over = {}) => ({
  ticker: "AAA", fund: "A Fund", form: "N-CSR", expenseRatio: 0.0003, costPer10k: 3, periodEnd: "2025-12-31",
  returns: { 1: 0.18, 5: 0.14, 10: 0.15 }, netAssets: 1e12, holdings: 500, turnover: 0.02,
  indexes: [{ name: "Broad", kind: "broad", returns: { 1: 0.17, 10: 0.14 } }, { name: "S&P 500 Index", kind: "additional", returns: { 1: 0.18, 10: 0.152 } }],
  ...over,
});
const row = (rows, key) => rows.find((r) => r.key === key);

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
  const rows = breakdownRows({ breakdown: { by: "IndustrySector", rows: [["A", 0.3], ["B", 0.2], ["C", 0.1], ["D", 0.1], ["E", 0.1], ["F", 0.1], ["G", 0.06], ["H", 0.04]] } });
  assert.deepEqual(rows.map((r) => r.label), ["A", "B", "C", "D", "E", "F", "Other"]);
  assert.ok(Math.abs(rows[6].share - 0.1) < 1e-12);
  assert.deepEqual(breakdownRows({ breakdown: null }), []);
});

test("report dates read naturally in each language", () => {
  setLang("en");
  assert.equal(reportDate("2025-12-31"), "Dec 31, 2025");
  setLang("es");
  try { assert.match(reportDate("2025-12-31"), /^31 dic\.? 2025$/); } finally { setLang("en"); }
});
