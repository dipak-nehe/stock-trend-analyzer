import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { caveats, checklistGrid, compareRows, favourable, glancePairs, indexedSeries, measures, prepare, DIRECTIONS } from "../../public/js/compare.js";
import { setLang } from "../../public/js/i18n.js";
import { YEARS, company, nulls } from "./company.js";

afterEach(() => setLang("en"));
const row = (rows, key) => rows.find((r) => r.key === key);

test("more favourable depends on the measure's direction, and ties or missing values get no mark", () => {
  assert.equal(favourable(0.2, 0.1, "higher"), "a");
  assert.equal(favourable(0.2, 0.1, "lower"), "b");
  assert.equal(favourable(1.5, 1.5, "lower"), null);
  assert.equal(favourable(null, 0.1, "higher"), null);
  assert.equal(favourable(5e9, 1e9, null), null);                              // sizes never get a mark
  assert.equal(favourable({ share: 0.5 }, { share: 0.75 }, "higher"), "b");     // checklist scores compare by share met
});

test("sizes and dividend amounts never get a mark; risk measures point the right way", () => {
  assert.equal(DIRECTIONS.revenue, null);
  assert.equal(DIRECTIONS.netIncome, null);
  assert.equal(DIRECTIONS.dps, null);
  assert.equal(DIRECTIONS.debtToEquity, "lower");
  assert.equal(DIRECTIONS.sharesChange, "lower");
  assert.equal(DIRECTIONS.critical, "lower");
  assert.equal(DIRECTIONS.netMargin, "higher");
});

test("the company with lower debt and higher margins gets the marks on those rows", () => {
  const lean = prepare(company({ totalDebt: YEARS.map(() => 100e6) }));
  const heavy = prepare(company({ totalDebt: YEARS.map(() => 1500e6), netIncome: YEARS.map(() => 50e6) }));
  const rows = compareRows(lean, heavy);
  assert.equal(row(rows, "debtToEquity").better, "a");
  assert.equal(row(rows, "netMargin").better, "a");
  assert.equal(row(rows, "revenue").better, null);
  assert.match(row(rows, "debtToEquity").a, /^0\.06x$/);  // 100M debt vs equity grown to ~1.55B
});

test("valuation rows appear only once a price is entered, and are marked only when both have one", () => {
  const a = company(), b = company({ eps: YEARS.map(() => 2) });
  assert.ok(!compareRows(prepare(a), prepare(b)).some((r) => r.group === "valuation"));
  const oneSide = compareRows(prepare(a, 20), prepare(b));
  assert.equal(row(oneSide, "pe3").b, "add a price");
  assert.equal(row(oneSide, "pe3").better, null);
  const both = compareRows(prepare(a, 20), prepare(b, 20));
  assert.ok(["a", "b"].includes(row(both, "pe3").better));
});

test("banks and negative equity make the related measures n/a instead of misleading", () => {
  const bank = prepare(company({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: YEARS.map(() => 100e9),
                                 totalLiabilities: YEARS.map(() => 90e9), equity: YEARS.map(() => 10e9) }));
  assert.equal(measures(bank).debtToEquity, null);
  assert.equal(measures(bank).currentRatio, null);
  const buybacks = prepare(company({ equity: YEARS.map((_, i) => (i === 9 ? -5e6 : 1000e6)) }));
  assert.equal(measures(buybacks).avgRoe, null);
  const rows = compareRows(bank, prepare(company()));
  assert.equal(row(rows, "currentRatio").a, "n/a");
  assert.equal(row(rows, "currentRatio").better, null);
});

test("indexed growth starts both companies at 100 in their first common year", () => {
  const a = company({ revenue: YEARS.map((_, i) => 100 * (i + 1)) });
  const b = company({ revenue: YEARS.map((_, i) => 1e6 * (i + 1)) }, { years: YEARS.map((y) => y + 2) });  // 2018–2027
  b.series.revenue = YEARS.map((_, i) => 1e6 * (i + 1));
  const idx = indexedSeries(a, b, "revenue");
  assert.equal(idx.years[0], 2018);                                            // first year both report
  assert.equal(idx.a[0], 100);
  assert.equal(idx.b[0], 100);
  assert.equal(idx.years.length, 8);                                           // 2018–2025
  assert.ok(Math.abs(idx.a[1] - (400 / 300) * 100) < 1e-9);
});

test("indexed growth skips years that can't be indexed and needs overlapping years", () => {
  const loss = company({ eps: [-1, -0.5, 1, 1.2, 1.5, 1.6, 1.8, 2, 2.2, 2.5] });
  const idx = indexedSeries(loss, company(), "eps");
  assert.equal(idx.years[0], 2018);                                            // first year with positive EPS on both sides
  const later = company({}, { years: YEARS.map((y) => y + 20) });
  assert.equal(indexedSeries(company(), later, "revenue"), null);
});

test("at-a-glance lines pair up by topic even when one company has no SEC history", () => {
  const pairs = glancePairs(prepare(company()), prepare(company({}, { secHistory: null })));
  const sec = pairs.find((p) => p.what === "SEC record");
  assert.ok(sec.a && sec.b === null);
  assert.equal(pairs.find((p) => p.what === "Revenue").b.what, "Revenue");
});

test("the checklist grid lines up every Graham and Buffett criterion", () => {
  const grid = checklistGrid(prepare(company(), 20), prepare(company()));
  assert.equal(grid.filter((r) => r.who === "graham").length, 8);
  assert.equal(grid.filter((r) => r.who === "buffett").length, 8); // includes return on tangible capital
  assert.equal(grid.find((r) => r.name === "Moderate P/E").b, "price");
});

test("caveats explain different currencies and fiscal year ends", () => {
  const us = company({}, { periodEnds: YEARS.map((y) => `${y}-12-31`) });
  const tw = company({}, { currency: "TWD", periodEnds: YEARS.map((y) => `${y}-12-31`) });
  const apple = company({}, { periodEnds: YEARS.map((y) => `${y}-09-27`) });
  assert.match(caveats(us, tw)[0], /different currencies \(USD and TWD\)/);
  assert.match(caveats(us, apple)[0], /different months/);
  assert.deepEqual(caveats(us, us), []);
});

test("comparison text follows the chosen language", () => {
  setLang("es");
  const rows = compareRows(prepare(company()), prepare(company()));
  assert.equal(row(rows, "debtToEquity").label, "Deuda / patrimonio");
  assert.match(row(rows, "revenueCagr").a, /^\d+,\d %$/);
});

test("the comparison carries the newer measures: tangible return, both extra checklists and the yields", () => {
  const m = measures(prepare(company(), 20));
  assert.ok(m.rotc > 0);
  assert.equal(m.durable.judged > 0 && m.durable.met <= m.durable.judged, true);
  assert.equal(m.piotroski.judged, 9);
  assert.ok(m.divYield > 0 && m.fcfYield > 0);       // a price was entered
  assert.equal(measures(prepare(company())).divYield, null);  // no price, no yield
});

test("EV / free cash flow is compared at the entered prices, lower being more favourable", () => {
  assert.equal(DIRECTIONS.evFcf, "lower");
  const m = measures(prepare(company(), 20));
  assert.ok(m.evFcf > 0);
  assert.equal(measures(prepare(company())).evFcf, null);  // needs a price
  const rows = compareRows(prepare(company(), 20), prepare(company(), 40));
  assert.equal(row(rows, "evFcf").label, "EV / free cash flow");
});

