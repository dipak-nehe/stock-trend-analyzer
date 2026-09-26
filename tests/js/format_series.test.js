import { test } from "node:test";
import assert from "node:assert/strict";
import { money, num, pct, perShare } from "../../public/js/format.js";
import { cagr, classify, lastValue, ratio, yoy } from "../../public/js/series.js";

test("money uses compact units, sign and currency", () => {
  assert.equal(money(416161e6, "USD"), "$416.2B");
  assert.equal(money(-267e6, "USD"), "-$267.0M");
  assert.equal(money(2.26e12, "TWD"), "2.3T TWD");
  assert.equal(money(null, "USD"), "–");
  assert.equal(money(Infinity, "USD"), "–");
});

test("per-share values put the minus sign before the currency", () => {
  assert.equal(perShare(-0.06, "USD"), "-$0.06");
  assert.equal(perShare(44.67, "TWD"), "44.67 TWD");
  assert.equal(perShare(null, "USD"), "–");
});

test("percentages and share counts", () => {
  assert.equal(pct(0.0756), "7.6%");
  assert.equal(pct(0.0756, 0), "8%");
  assert.equal(pct(null), "–");
  assert.equal(num(15004.7e6), "15.00B");
  assert.equal(num(345e6), "345.0M");
});

test("CAGR over the full range, a span, and with gaps", () => {
  assert.ok(Math.abs(cagr([100, 110, 121]) - 0.1) < 1e-9);
  assert.ok(Math.abs(cagr([null, 100, 110, 121]) - 0.1) < 1e-9);   // starts at the first reported year
  assert.ok(Math.abs(cagr([50, 100, 110, 121], 2) - 0.1) < 1e-9);
  assert.equal(cagr([-10, 20]), null);                        // undefined across a sign change
  assert.equal(cagr([100]), null);
  assert.equal(cagr([null, null]), null);
});

test("ratios, year-over-year change and latest value skip missing years", () => {
  assert.deepEqual(ratio([10, null, 30], [2, 5, 0]), [5, null, null]);
  assert.deepEqual(yoy([100, 110, null, 99]), [null, 0.1, null, null]);
  assert.equal(lastValue([1, 2, null]), 2);
  assert.equal(lastValue([null]), null);
});

test("trend labels", () => {
  assert.equal(classify([100, 112, 125, 140, 157]).label, "Strong growth");
  assert.equal(classify([100, 104, 108, 112, 117]).label, "Growing");
  assert.equal(classify([100, 101, 99, 100, 101]).label, "Flat");
  assert.equal(classify([100, 90, 80, 70, 60]).label, "Declining");
  assert.equal(classify([100, 90, 120, 100, 130, 110, 150, 120, 160]).label, "Growing, volatile");
  assert.equal(classify([100, 50, -20, 40, 80]).label.endsWith("(had losses)"), true);
  assert.equal(classify([1, 2]).label, "Not enough data");
});
