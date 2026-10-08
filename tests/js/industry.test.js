import { test } from "node:test";
import assert from "node:assert/strict";
import { companyRatios, industryComparison, industryGroup } from "../../public/js/industry.js";
import { company } from "./company.js";

const stat = (median, p25 = median - 0.05, p75 = median + 0.05) => ({ n: 20, p25, median, p75 });
const DATA = {
  year: 2025,
  groups: {
    "4:2080": { companies: 21, netMargin: stat(0.05), revenueGrowth: stat(0.02), roe: stat(0.10), currentRatio: stat(1.2, 1.0, 1.5) },
    "4:3571": { companies: 7, netMargin: stat(0.05) },   // too few: falls back to the 3-digit group
    "3:357": { companies: 50, netMargin: stat(0.04), grossMargin: stat(0.30) },
    "2:60": { companies: 400, netMargin: stat(0.30), revenueGrowth: stat(0.05), roe: stat(0.11) },
  },
};

test("the narrowest industry level with at least 8 companies is used", () => {
  assert.equal(industryGroup(DATA, "2080").level, 4);
  const fallback = industryGroup(DATA, "3571");
  assert.equal(fallback.level, 3); assert.equal(fallback.code, "357");
  assert.equal(industryGroup(DATA, "6021").level, 2);
  assert.equal(industryGroup(DATA, "9999"), null);
  assert.equal(industryGroup(null, "2080"), null);
  assert.equal(industryGroup(DATA, null), null);
});

test("the company's own ratios come from its latest fiscal year", () => {
  const d = company(), s = d.series, last = s.revenue.length - 1;
  const r = companyRatios(d);
  assert.ok(Math.abs(r.netMargin - s.netIncome[last] / s.revenue[last]) < 1e-12);
  assert.ok(Math.abs(r.revenueGrowth - (s.revenue[last] / s.revenue[last - 1] - 1)) < 1e-12);
  assert.equal(r.rdIntensity, null);  // the test company doesn't report R&D
});

test("each ratio is placed higher than most, typical or lower than most, against the middle half", () => {
  const d = company({}, { sic: "2080" });  // net margin about 10.6%, ROE about 12.9%, current ratio 2.4
  const cmp = industryComparison(d, false, DATA), pos = Object.fromEntries(cmp.rows.map((r) => [r.ratio, r.position]));
  assert.equal(pos.netMargin, "higher");     // above the 75th percentile of 10%
  assert.equal(pos.roe, "typical");          // between 5% and 15%
  assert.equal(pos.currentRatio, "higher");  // 2.4 against 1.0-1.5
  assert.ok(!("grossMargin" in pos));        // the industry has no figure for it, so no row
  assert.equal(cmp.year, 2025); assert.equal(cmp.group.companies, 21);
});

test("banks and insurers are only compared on growth and return on equity", () => {
  const cmp = industryComparison(company({}, { sic: "6021" }), true, DATA);
  assert.deepEqual(cmp.rows.map((r) => r.ratio).sort(), ["revenueGrowth", "roe"]);
});

test("no comparison without an industry code or industry data", () => {
  assert.equal(industryComparison(company(), false, DATA), null);
  assert.equal(industryComparison(company({}, { sic: "2080" }), false, null), null);
});
