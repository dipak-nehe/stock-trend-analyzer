// "Compared with its industry": the company's latest fiscal-year ratios against the typical (median) ratios of SEC
// filers in the same industry, from data/industry.json (built monthly by scripts/build_industry.py).

export const MIN_PEERS = 8;  // narrowest industry level (4-, 3- then 2-digit SIC) with at least this many companies
export const RATIOS = ["netMargin", "operatingMargin", "grossMargin", "revenueGrowth", "roe", "currentRatio", "rdIntensity"];
const FINANCIAL_RATIOS = ["revenueGrowth", "roe"];  // banks and insurers: margins and current ratios don't fit

/** The industry group to compare with: { level: 4 | 3 | 2, code, group } or null. @param {any} data @param {string | null} sic */
export function industryGroup(data, sic) {
  if (!data || !sic) return null;
  for (const level of [4, 3, 2]) {
    const code = sic.slice(0, level), group = data.groups[`${level}:${code}`];
    if (group && group.companies >= MIN_PEERS) return { level, code, group };
  }
  return null;
}

/** The company's ratios for its latest fiscal year (the same definitions as the industry file). */
export function companyRatios(d) {
  const s = d.series, i = d.years.length - 1;
  const at = (k, j = i) => (s[k] && s[k][j] != null ? s[k][j] : null);
  const div = (a, b) => (a != null && b != null && b !== 0 ? a / b : null);
  const rev = at("revenue"), prev = at("revenue", i - 1), eq = at("equity");
  return {
    netMargin: div(at("netIncome"), rev),
    operatingMargin: div(at("operatingIncome"), rev),
    grossMargin: div(at("grossProfit"), rev),
    revenueGrowth: rev != null && prev > 0 ? rev / prev - 1 : null,
    roe: eq > 0 ? div(at("netIncome"), eq) : null,
    currentRatio: div(at("currentAssets"), at("currentLiabilities")),
    rdIntensity: div(at("researchAndDevelopment"), rev),
  };
}

/** Rows of { ratio, value, median, position: "higher" | "typical" | "lower" }, for ratios both sides have. */
export function industryComparison(d, financial, data) {
  const found = industryGroup(data, d.sic);
  if (!found) return null;
  const mine = companyRatios(d), names = financial ? FINANCIAL_RATIOS : RATIOS;
  const rows = names.filter((k) => mine[k] != null && found.group[k]).map((k) => {
    const g = found.group[k], v = mine[k];
    return { ratio: k, value: v, median: g.median, position: v > g.p75 ? "higher" : v < g.p25 ? "lower" : "typical" };
  });
  return rows.length ? { ...found, year: data.year, rows } : null;
}
