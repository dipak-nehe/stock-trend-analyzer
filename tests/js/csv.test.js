import { test } from "node:test";
import assert from "node:assert/strict";
import { companyRows, tableRows, toCsv } from "../../public/js/csv.js";
import { analyze } from "../../public/js/flags.js";
import { portfolioRow } from "../../public/js/portfolio.js";
import { setLang } from "../../public/js/i18n.js";
import { company } from "./company.js";

test("CSV cells are quoted only when needed, quotes doubled, lines ending in CRLF", () => {
  assert.equal(toCsv([["a", 1, null], ['Coca-Cola Company (The), "KO"', 2.5, "x\ny"]]),
    'a,1,\r\n"Coca-Cola Company (The), ""KO""",2.5,"x\ny"\r\n');
});

test("a company's figures: metric, unit, then the figures as filed for every year", () => {
  setLang("en");
  const d = company(), rows = companyRows(d, analyze(d));
  assert.deepEqual(rows[0], ["Metric", "Unit", ...d.years]);
  const byLabel = Object.fromEntries(rows.slice(1).map((r) => [r[0], r]));
  assert.deepEqual(byLabel.Revenue, ["Revenue", "USD", ...d.series.revenue]);          // raw, not "$1.0B"
  assert.equal(byLabel["EPS (diluted)"][1], "USD per share");
  assert.equal(byLabel["Diluted shares"][1], "shares");
  assert.equal(byLabel["Free cash flow"][2], d.series.operatingCashFlow[0] - d.series.capex[0]);  // the first year
});

test("a stock table: one row per loaded stock, percentages as numbers, scores as counts, n/a when not measurable", () => {
  setLang("en");
  const row = portfolioRow(company({ dps: company().years.map(() => 0) }));
  const rows = tableRows([{ ticker: "TEST", status: "ok", row }, { ticker: "ZZZ", status: "error", error: "x" }]);
  assert.equal(rows.length, 2);                                                         // the failed one is left out
  assert.deepEqual(rows[0].slice(0, 5), ["Company", "Ticker", "First year", "Latest year", "Revenue growth (%)"]);
  assert.equal(rows[0].at(-1), "Balance-sheet checks passed");
  assert.deepEqual(rows[1].slice(0, 4), ["Test Co", "TEST", 2016, 2025]);
  assert.equal(rows[1][4], Math.round(row.cells.revenue.v * 1000) / 10);               // e.g. 6 for 6.0%
  assert.equal(rows[1][6], "n/a");                                                      // no dividend: no growth
  assert.match(String(rows[1].at(-2)), /^\d+ of \d+$/);
});

test("labels follow the page's language", () => {
  setLang("es");
  try {
    const d = company();
    assert.equal(companyRows(d, analyze(d))[0][1], "Unidad");
    assert.equal(tableRows([])[0][0], "Empresa");
  } finally {
    setLang("en");
  }
});
