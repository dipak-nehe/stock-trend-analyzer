// "Compared with its industry": the company's latest fiscal-year ratios against the typical (median) ratios of SEC
// filers in the same industry, from data/industry.json (built monthly by scripts/build_industry.py).
import { positive } from "./series.ts";
import type { Financials } from "./types.ts";

export const MIN_PEERS = 8;  // narrowest industry level (4-, 3- then 2-digit SIC) with at least this many companies
export const RATIOS = ["netMargin", "operatingMargin", "grossMargin", "revenueGrowth", "roe", "currentRatio", "rdIntensity"] as const;
const FINANCIAL_RATIOS = ["revenueGrowth", "roe"] as const;  // banks and insurers: margins and current ratios don't fit
export type Ratio = (typeof RATIOS)[number];

/** One ratio across an industry group: how many companies, and its quartiles. */
export type Spread = { n: number; p25: number; median: number; p75: number };
export type IndustryGroup = { companies: number } & Partial<Record<Ratio, Spread>>;
/** public/data/industry.json */
export type IndustryData = { year: number; generated?: string; source?: string; groups: Record<string, IndustryGroup> };

/** The industry group to compare with: { level: 4 | 3 | 2, code, group } or null. */
export function industryGroup(data: IndustryData | null | undefined, sic: string | null | undefined) {
  if (!data || !sic) return null;
  for (const level of [4, 3, 2]) {
    const code = sic.slice(0, level), group = data.groups[`${level}:${code}`];
    if (group && group.companies >= MIN_PEERS) return { level, code, group };
  }
  return null;
}

/** The company's ratios for its latest fiscal year (the same definitions as the industry file). */
export function companyRatios(d: Financials): Record<Ratio, number | null> {
  const s = d.series, i = d.years.length - 1;
  const at = (k: string, j = i) => { const arr = s[k]; return arr && arr[j] != null ? arr[j] : null; };
  const div = (a: number | null, b: number | null) => (a != null && b != null && b !== 0 ? a / b : null);
  const rev = at("revenue"), prev = at("revenue", i - 1), eq = at("equity");
  return {
    netMargin: div(at("netIncome"), rev),
    operatingMargin: div(at("operatingIncome"), rev),
    grossMargin: div(at("grossProfit"), rev),
    revenueGrowth: rev != null && positive(prev) ? rev / prev - 1 : null,
    roe: positive(eq) ? div(at("netIncome"), eq) : null,
    currentRatio: div(at("currentAssets"), at("currentLiabilities")),
    rdIntensity: div(at("researchAndDevelopment"), rev),
  };
}

export type Position = "higher" | "typical" | "lower";

/** Rows of { ratio, value, median, position }, for ratios both sides have. */
export function industryComparison(d: Financials, financial: boolean, data: IndustryData | null | undefined) {
  const found = industryGroup(data, d.sic);
  if (!found || !data) return null;
  const mine = companyRatios(d), names: readonly Ratio[] = financial ? FINANCIAL_RATIOS : RATIOS;
  const rows = names.flatMap((k) => {
    const g = found.group[k], v = mine[k];
    if (v == null || !g) return [];
    const position: Position = v > g.p75 ? "higher" : v < g.p25 ? "lower" : "typical";
    return [{ ratio: k, value: v, median: g.median, position }];
  });
  return rows.length ? { ...found, year: data.year, rows } : null;
}

export type IndustryComparison = NonNullable<ReturnType<typeof industryComparison>>;
