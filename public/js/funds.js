// The Funds page (funds.html): the measures for a US mutual fund or ETF, from its latest shareholder report
// (/api/fund), and the rules for setting up to four side by side. No page code here, so it can be unit-tested;
// funds-app.js puts it on the page.
import { money, pct } from "./format.js";
import { getLang, getLocale, t } from "./i18n.js";

export const MAX_FUNDS = 4;
export const EXAMPLES = ["VOO", "VTI", "FXAIX", "BND", "SCHD", "AGTHX"];
// For "cost over 20 years": $10,000 growing 7% a year before costs (a round illustration, not a forecast)
export const ILLUSTRATION = { amount: 10000, years: 20, growth: 0.07 };

/** Tickers from a list ("voo, fxaix" or "VOO FXAIX"): upper case, no duplicates, at most MAX_FUNDS.
 * @param {string | null | undefined} text */
export function parseFunds(text) {
  const out = [];
  for (const x of String(text || "").split(/[\s,]+/)) {
    const tk = x.trim().toUpperCase();
    if (/^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(tk) && !out.includes(tk)) out.push(tk);
  }
  return out.slice(0, MAX_FUNDS);
}

/**
 * What a yearly cost takes out over the illustration: the end value of $10,000 growing 7% a year, less the end value
 * when the cost comes off each year's growth. @param {number | null | undefined} expenseRatio e.g. 0.0003
 */
export function costOverYears(expenseRatio, { amount, years, growth } = ILLUSTRATION) {
  if (expenseRatio == null) return null;
  return amount * (Math.pow(1 + growth, years) - Math.pow(1 + growth - expenseRatio, years));
}

/**
 * The index to set the fund against: its own benchmark when the report names one (an "additional" index, e.g. the
 * S&P 500 for an S&P 500 fund), otherwise the broad market index every report must show. @param {any} fund
 */
export function benchmark(fund) {
  const list = fund.indexes || [];
  return list.find((i) => i.kind === "additional") || list.find((i) => i.kind === "broad") || null;
}

/** The index's name, or what kind it is when the report only tags it with an id. @param {any} index */
export function indexName(index) {
  return index.name || t(index.kind === "broad" ? "fund.index.broad" : "fund.index.own");
}

/** The fund's return over n years minus its index's (positive = it did better), or null. @param {any} fund @param {string} n */
export function versusIndex(fund, n) {
  const idx = benchmark(fund), own = fund.returns && fund.returns[n];
  return idx && own != null && idx.returns[n] != null ? own - idx.returns[n] : null;
}

/** Text from a filing, safe inside HTML. @param {string} text */
const escHtml = (text) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
const signedPct = (/** @type {number} */ v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${pct(Math.abs(v), 2)}`;
const usd = (/** @type {number} */ v) => money(v, "USD", v >= 1e9 ? 1 : 0);
/** Whole dollars: "$4,120" in English, "4.120 US$" in Spanish. @param {number} v */
export const dollars = (v) => {
  const n = new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(Math.round(v));
  return getLang() === "es" ? `${n} US$` : `$${n}`;
};
const count = (/** @type {number} */ v) => new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 0 }).format(v);

/**
 * The comparison rows: [group, key, value(fund), text(value, fund), direction]. Direction "lower"/"higher" marks
 * the more favourable fund when two or more are shown; null = no mark (size isn't better or worse).
 * @type {[string, string, (f: any) => number | null | undefined, (v: number, f: any) => string, "lower" | "higher" | null][]}
 */
export const ROWS = [
  ["cost", "expenseRatio", (f) => f.expenseRatio, (v) => pct(v, 2), "lower"],
  // the report's own figure, for its period: a year only in the annual report
  ["cost", "costPer10k", (f) => (f.form === "N-CSR" ? f.costPer10k : null), (v) => dollars(v), "lower"],
  ["cost", "cost20", (f) => costOverYears(f.expenseRatio), (v) => dollars(v), "lower"],
  ["returns", "ret1", (f) => f.returns && f.returns["1"], (v) => pct(v), "higher"],
  ["returns", "ret5", (f) => f.returns && f.returns["5"], (v) => pct(v), "higher"],
  ["returns", "ret10", (f) => f.returns && f.returns["10"], (v) => pct(v), "higher"],
  ["returns", "vsIndex10", (f) => versusIndex(f, "10") ?? versusIndex(f, "5"), (v, f) => `${signedPct(v)}<span class="muted fund-vs">${
    t(versusIndex(f, "10") != null ? "fund.vs10" : "fund.vs5", { index: escHtml(indexName(benchmark(f))) })}</span>`, null],
  ["portfolio", "netAssets", (f) => f.netAssets, (v) => usd(v), null],
  ["portfolio", "holdings", (f) => f.holdings, (v) => count(v), null],
  ["portfolio", "top10", (f) => topShare(f), (v) => t("fund.topShare", { pct: pct(v, 0), n: 10 }), null],
  ["portfolio", "turnover", (f) => f.turnover, (v) => pct(v, 0), "lower"],
];

/**
 * The table for the funds shown: one row per measure with a cell per fund ({ text, best }), the rows nobody has
 * left out, plus a caveat when the returns cover different periods (funds end their years in different months).
 * @param {any[]} funds loaded funds, in the order shown
 */
export function compareRows(funds) {
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
 * @param {any} fund */
export function topShare(fund) {
  if (fund.topTen) return fund.topTen.pct / 100;
  return fund.topHoldings && fund.topHoldings.count === 10 ? fund.topHoldings.pct : null;
}

/** The fund's ten largest holdings as rows { rank, name, share (0.075 = 7.5%), securities } (several share classes or
 * bonds of one issuer are one row). @param {any} fund */
export function holdingRows(fund) {
  return fund.topTen ? fund.topTen.rows.map((r, i) => ({ rank: i + 1, name: r.name, share: r.pct / 100, securities: r.securities })) : [];
}

/** "Dec 31, 2025" / "31 dic 2025" for a report date ("2025-12-31"). @param {string | null | undefined} iso */
export function reportDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  return new Intl.DateTimeFormat(getLocale(), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** The fund's portfolio split as label/share rows: the largest six, then the rest together. @param {any} fund */
export function breakdownRows(fund, max = 6) {
  const b = fund.breakdown;
  if (!b || !b.rows || !b.rows.length) return [];
  const rows = b.rows.slice(0, max).map(([label, share]) => ({ label, share }));
  const rest = b.rows.slice(max).reduce((sum, [, share]) => sum + share, 0);
  if (rest > 0.0005) rows.push({ label: t("fund.otherRows"), share: rest });
  return rows;
}
