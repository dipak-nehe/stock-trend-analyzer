// "My portfolio": ten 10-year measures per stock, all in %, from the same API response and the same rules as the
// results page (free cash flow and the bank test from flags.js, return on tangible capital from valuation.js).
// No page code here, so it can be unit-tested; portfolio-app.js puts it on the page.
import { analyze } from "./flags.js";
import { valueChecks } from "./valuation.js";
import { cagr, firstIdx, lastIdx } from "./series.js";

/**
 * The columns, in order. kind: "growth" = average growth per year over the period (CAGR), "level" = over the whole
 * period (total / total, so one odd year can't dominate). good / bad: the yardsticks for the cell colours; lowerIsBetter
 * for the share count (buybacks are good).
 * @type {{ key: string, kind: "growth" | "level", good: number, bad: number, lowerIsBetter?: boolean }[]}
 */
export const COLUMNS = [
  { key: "revenue", kind: "growth", good: 0.07, bad: 0 },
  { key: "eps", kind: "growth", good: 0.07, bad: 0 },
  { key: "dps", kind: "growth", good: 0.05, bad: 0 },
  { key: "fcf", kind: "growth", good: 0.07, bad: 0 },
  { key: "bvps", kind: "growth", good: 0.05, bad: 0 },
  { key: "netMargin", kind: "level", good: 0.10, bad: 0.03 },
  { key: "roe", kind: "level", good: 0.15, bad: 0.08 },
  { key: "rotc", kind: "level", good: 0.15, bad: 0.08 },
  { key: "fcfMargin", kind: "level", good: 0.10, bad: 0 },
  { key: "shares", kind: "growth", good: 0, bad: 0.02, lowerIsBetter: true },
];

export const MAX_ROWS = 30;

/** Total of a over total of b, over the years both are reported. @param {(number|null)[]} a @param {(number|null)[]} b */
function totalRatio(a, b) {
  let x = 0, y = 0, n = 0;
  a.forEach((v, i) => { if (v != null && b[i] != null) { x += v; y += b[i]; n++; } });
  return n >= 3 && y > 0 ? x / y : null;
}

/**
 * Why a growth rate can't be given (for the cell's tooltip): too few years, a loss or zero at one end, or a dividend
 * never paid, started or stopped during the period.
 * @param {(number|null)[]} arr @param {boolean} [dividend]
 */
function growthWhy(arr, dividend = false) {
  const i = firstIdx(arr), j = lastIdx(arr);
  if (dividend && (i < 0 || arr.every((v) => v == null || v === 0))) return "noDividend";
  if (i < 0 || i === j) return "notEnough";
  if (dividend && arr[i] === 0 && arr[j] > 0) return "startedDividend";
  if (dividend && arr[j] <= 0) return "stoppedDividend";
  if (arr[j] <= 0) return "negativeEnd";
  return "negativeStart";
}

/**
 * One portfolio row: { ticker, name, from, to, cells: { [column key]: { v: number|null, why?: string } } }.
 * @param {any} d an /api/financials response
 */
export function portfolioRow(d) {
  const s = d.series, r = analyze(d), fin = r.financial;
  const growth = (/** @type {(number|null)[]} */ arr, dividend = false) => {
    const v = cagr(arr);
    return v == null ? { v: null, why: growthWhy(arr, dividend) } : { v };
  };
  const level = (/** @type {number|null} */ v, why = "notEnough") => (v == null ? { v: null, why } : { v });
  const bvps = s.equity.map((e, i) => (e != null && s.dilutedShares[i] ? e / s.dilutedShares[i] : null));
  const negEquity = s.equity.some((v) => v != null && v <= 0);
  const rotc = valueChecks(d, null, r).rotcOverall;
  const cells = {
    revenue: growth(s.revenue),
    eps: growth(s.eps),
    dps: growth(s.dps, true),
    fcf: fin ? { v: null, why: "bank" } : growth(r.fcf),
    bvps: growth(bvps),
    netMargin: level(totalRatio(s.netIncome, s.revenue)),
    roe: negEquity ? { v: null, why: "negativeEquity" } : level(totalRatio(s.netIncome, s.equity)),
    rotc: fin ? { v: null, why: "bank" } : level(rotc ?? null),
    fcfMargin: fin ? { v: null, why: "bank" } : level(totalRatio(r.fcf, s.revenue)),
    shares: growth(s.dilutedShares),
  };
  return { ticker: d.ticker, name: d.name, from: d.years[0], to: d.years[d.years.length - 1], cells };
}

/** "good" | "bad" | "" for a cell's colour. @param {(typeof COLUMNS)[number]} col @param {number|null} v */
export function tone(col, v) {
  if (v == null) return "";
  if (col.lowerIsBetter) return v <= col.good ? "good" : v > col.bad ? "bad" : "";
  return v >= col.good ? "good" : v < col.bad ? "bad" : "";
}

/** The median of each column over the rows that have it (null when none do). @param {{cells: any}[]} rows */
export function medians(rows) {
  return Object.fromEntries(COLUMNS.map((c) => {
    const vals = rows.map((row) => row.cells[c.key].v).filter((v) => v != null).sort((a, b) => a - b);
    const m = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null;
    return [c.key, m];
  }));
}

/**
 * Rows sorted by a column; rows without a value always go last. @template T
 * @param {T[]} rows @param {string} key a column key, or "ticker" @param {1|-1} dir 1 = ascending
 */
export function sortRows(rows, key, dir) {
  const value = (/** @type {any} */ row) => (key === "ticker" ? row.ticker : row.cells ? row.cells[key].v : null);
  return [...rows].sort((a, b) => {
    const x = value(a), y = value(b);
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

/** Tickers from a link or storage: upper-case, de-duplicated, at most MAX_ROWS. @param {string|null|undefined} text */
export function parseTickers(text) {
  const seen = new Set();
  return String(text || "").split(/[\s,]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(x))
    .filter((x) => !seen.has(x) && seen.add(x)).slice(0, MAX_ROWS);
}
