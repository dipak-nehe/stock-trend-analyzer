// The Funds page (funds.html): the measures for a US mutual fund or ETF, from its latest shareholder report
// (/api/fund), and the rules for setting up to four side by side. No page code here, so it can be unit-tested;
// funds-app.ts puts it on the page.
import { money, pct } from "./format.ts";
import { getLang, getLocale, t } from "./i18n.ts";
import { esc } from "./html.ts";
import type { ChartPoint, Fund } from "./types.ts";

type Index = Fund["indexes"][number];

export const MAX_FUNDS = 4;
export const EXAMPLES = ["VOO", "VTI", "FXAIX", "BND", "SCHD", "AGTHX"];
// For "cost over 20 years": $10,000 growing 7% a year before costs (a round illustration, not a forecast)
export const ILLUSTRATION = { amount: 10000, years: 20, growth: 0.07 };

/** Tickers from a list ("voo, fxaix" or "VOO FXAIX"): upper case, no duplicates, at most MAX_FUNDS.
 */
export function parseFunds(text: string|null|undefined) {
  const out: string[] = [];
  for (const x of String(text || "").split(/[\s,]+/)) {
    const tk = x.trim().toUpperCase();
    if (/^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(tk) && !out.includes(tk)) out.push(tk);
  }
  return out.slice(0, MAX_FUNDS);
}

/**
 * What a yearly cost takes out over the illustration: the end value of $10,000 growing 7% a year, less the end value
 * when the cost comes off each year's growth. @param expenseRatio e.g. 0.0003
 */
export function costOverYears(expenseRatio: number|null|undefined, { amount, years, growth } = ILLUSTRATION) {
  if (expenseRatio == null) return null;
  return amount * (Math.pow(1 + growth, years) - Math.pow(1 + growth - expenseRatio, years));
}

/**
 * The index to set the fund against: its own benchmark when the report names one (an "additional" index, e.g. the
 * S&P 500 for an S&P 500 fund), otherwise the broad market index every report must show. */
export function benchmark(fund: Fund): Index | null {
  const list = fund.indexes || [];
  return list.find((i) => i.kind === "additional") || list.find((i) => i.kind === "broad") || null;
}

/** The index's name, or what kind it is when the report only tags it with an id. */
export function indexName(index: Pick<Index, "name" | "kind">): string {
  return index.name || t(index.kind === "broad" ? "fund.index.broad" : "fund.index.own");
}

/** The fund's return over n years minus its index's (positive = it did better), or null. */
export function versusIndex(fund: Fund, n: string): number | null {
  const idx = benchmark(fund), own = fund.returns && fund.returns[n];
  return idx && own != null && idx.returns[n] != null ? own - idx.returns[n] : null;
}

const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${pct(Math.abs(v), 2)}`;
const usd = (v: number) => money(v, "USD", v >= 1e9 ? 1 : 0);
/** Whole dollars: "$4,120" in English, "4.120 US$" in Spanish. */
export const dollars = (v: number) => {
  const n = new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(Math.round(v));
  return getLang() === "es" ? `${n} US$` : `$${n}`;
};
const count = (v: number) => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(v);

/**
 * The comparison rows: [group, key, value(fund), text(value, fund), direction]. Direction "lower"/"higher" marks
 * the more favourable fund when two or more are shown; null = no mark (size isn't better or worse).
 */
export const ROWS: [string, string, (f: Fund) => number | null | undefined, (v: number, f: Fund) => string, "lower" | "higher" | null][] = [
  ["cost", "expenseRatio", (f) => f.expenseRatio, (v) => pct(v, 2), "lower"],
  // the report's own figure, for its period: a year only in the annual report
  ["cost", "costPer10k", (f) => (f.form === "N-CSR" ? f.costPer10k : null), (v) => dollars(v), "lower"],
  ["cost", "cost20", (f) => costOverYears(f.expenseRatio), (v) => dollars(v), "lower"],
  ["returns", "ret1", (f) => f.returns && f.returns["1"], (v) => pct(v), "higher"],
  ["returns", "ret5", (f) => f.returns && f.returns["5"], (v) => pct(v), "higher"],
  ["returns", "ret10", (f) => f.returns && f.returns["10"], (v) => pct(v), "higher"],
  // only for funds with a sales charge: what a buyer who paid it got (rows nobody has are left out)
  ["returns", "afterCharge10", (f) => f.returnsAfterSalesCharge && (f.returnsAfterSalesCharge["10"] ?? f.returnsAfterSalesCharge["5"]),
    (v, f) => `${pct(v)}<span class="muted fund-vs">${t(f.returnsAfterSalesCharge?.["10"] != null ? "fund.years10" : "fund.years5")}</span>`, null],
  ["returns", "vsIndex10", (f) => versusIndex(f, "10") ?? versusIndex(f, "5"), (v, f) => `${signedPct(v)}<span class="muted fund-vs">${
    t(versusIndex(f, "10") != null ? "fund.vs10" : "fund.vs5", { index: esc(indexName(benchmark(f)!)) })}</span>`, null],
  ["risk", "worstYear", (f) => risk(f)?.worst.ret, (v, f) => `${pct(v)}<span class="muted fund-vs">${t("fund.yearTo", { date: reportDate(risk(f)?.worst.date) })}</span>`, null],
  ["risk", "lossYears", (f) => risk(f)?.down, (v, f) => t("fund.lossYears", { n: v, of: risk(f)?.years ?? 0 }), null],
  ["portfolio", "netAssets", (f) => f.netAssets, (v) => usd(v), null],
  ["portfolio", "holdings", (f) => f.holdings, (v) => count(v), null],
  ["portfolio", "top10", (f) => topShare(f), (v) => t("fund.topShare", { pct: pct(v, 0), n: 10 }), null],
  ["portfolio", "turnover", (f) => f.turnover, (v) => pct(v, 0), "lower"],
];

/**
 * The table for the funds shown: one row per measure with a cell per fund ({ text, best }), the rows nobody has
 * left out, plus a caveat when the returns cover different periods (funds end their years in different months).
 * @param funds loaded funds, in the order shown
 */
export function compareRows(funds: Fund[]) {
  const rows = [];
  for (const [group, key, value, text, direction] of ROWS) {
    const values = funds.map((f) => value(f));
    if (values.every((v) => v == null)) continue;
    const known = values.filter((v) => v != null);
    const target = direction && funds.length > 1 && known.length > 1 && new Set(known).size > 1
      ? (direction === "lower" ? Math.min(...known) : Math.max(...known)) : null;
    rows.push({
      group, key, label: t(`fund.row.${key}`),
      cells: values.map((v, i) => ({ text: v == null ? t("cmp.na") : text(v, funds[i]), best: target != null && v === target })),
    });
  }
  const ends = [...new Set(funds.map((f) => f.periodEnd).filter(Boolean))];
  const caveat = ends.length > 1 ? t("fund.differentPeriods", { list: funds.filter((f) => f.periodEnd).map((f) => `${f.ticker} ${reportDate(f.periodEnd)}`).join(", ") }) : "";
  return { rows, caveat };
}

/** The share of the fund in its 10 largest holdings: from its N-PORT holdings list, else its shareholder report.
 */
export function topShare(fund: Fund): number | null {
  if (fund.topTen) return fund.topTen.pct / 100;
  return fund.topHoldings && fund.topHoldings.count === 10 ? fund.topHoldings.pct : null;
}

/** The fund's ten largest holdings as rows { rank, name, share (0.075 = 7.5%), securities } (several share classes or
 * bonds of one issuer are one row). */
export function holdingRows(fund: Fund) {
  return fund.topTen ? fund.topTen.rows.map((r, i) => ({ rank: i + 1, name: r.name, share: r.pct / 100, securities: r.securities })) : [];
}

/**
 * The chart's points one year apart, ending at the last one (the report charts quarters or months for some funds).
 * @param points [date, value] pairs, in date order
 */
export function yearly(points: ChartPoint[] | null | undefined): ChartPoint[] {
  if (!points || points.length < 2) return [];
  const last = points[points.length - 1][0];
  const kept = points.filter(([d]) => d.slice(5, 7) === last.slice(5, 7));
  return kept.length >= 2 ? kept : [];
}

/**
 * Risk from the growth-of-$10,000 line: the worst 12 months (between the yearly points), and how many of those years
 * lost money. When the line starts below $10,000 (a sales charge taken on day one), the first year is left out, so
 * the charge doesn't count as a market loss. Null without a line. @param fund
 */
export function risk(fund: Fund): { worst: { ret: number; date: string }; down: number; years: number } | null {
  let pts = yearly(fund.growth && fund.growth.fund);
  if (pts.length && pts[0][1] < 9900) pts = pts.slice(1);
  if (pts.length < 3) return null;
  const years = pts.slice(1).map(([date, v], i) => ({ date, ret: v / pts[i][1] - 1 }));
  const worst = years.reduce((a, b) => (b.ret < a.ret ? b : a));
  return { worst, down: years.filter((y) => y.ret < 0).length, years: years.length };
}

/**
 * How much two funds hold in common: the sum, over the issuers both hold, of the smaller of the two weights (the
 * usual overlap measure: 100% = the same portfolio), and the largest shared holdings. Null unless both have weights.
 */
export function overlap(a: Fund, b: Fund) {
  const wa = a.topTen && a.topTen.weights, wb = b.topTen && b.topTen.weights;
  if (!wa || !wb || !wa.length || !wb.length) return null;
  // two share classes of one fund (VOO and VFIAX) hold the very same portfolio
  if (a.seriesId && a.seriesId === b.seriesId) {
    return { pct: 1, same: true, count: wa.length, top: wa.slice(0, 5).map(([, weight, name]) => ({ name, pct: weight })) };
  }
  const mb = new Map(wb.map(([key, weight]) => [key, weight]));
  const shared = wa.filter(([key]) => mb.has(key)).map(([key, weight, name]) => ({ name, pct: Math.min(weight, mb.get(key) ?? 0) }))
    .sort((x, y) => y.pct - x.pct);
  return { pct: Math.min(100, shared.reduce((sum, h) => sum + h.pct, 0)) / 100, count: shared.length, top: shared.slice(0, 5) };
}

/** Every pair of funds shown, with their overlap (pairs without holdings data left out). */
export function overlapPairs(funds: Fund[]) {
  const out = [];
  for (let i = 0; i < funds.length; i++) {
    for (let j = i + 1; j < funds.length; j++) {
      const o = overlap(funds[i], funds[j]);
      if (o) out.push({ a: funds[i].ticker, b: funds[j].ticker, ...o });
    }
  }
  return out;
}

/** "Dec 31, 2025" / "31 dic 2025" for a report date ("2025-12-31"). */
export function reportDate(iso: string|null|undefined) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  return new Intl.DateTimeFormat(getLocale(), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** The fund's portfolio split as label/share rows: the largest six, then the rest together. */
export function breakdownRows(fund: Fund, max = 6) {
  const b = fund.breakdown;
  if (!b || !b.rows || !b.rows.length) return [];
  const rows = b.rows.slice(0, max).map(([label, share]) => ({ label, share }));
  const rest = b.rows.slice(max).reduce((sum, [, share]) => sum + share, 0);
  if (rest > 0.0005) rows.push({ label: t("fund.otherRows"), share: rest });
  return rows;
}
