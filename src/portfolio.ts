// "My portfolio": ten 10-year measures per stock, all in %, plus three checklist scores (Buffett's criteria, the
// Durable advantage tab's balance-sheet tests and the Piotroski F-score), from the same API response and the same rules as the results page
// (free cash flow and the bank test from flags.ts, the value checks from valuation.ts, the statement tests from
// durable.ts).
// No page code here, so it can be unit-tested; portfolio-app.ts puts it on the page.
import { analyze } from "./flags.ts";
import { valueChecks } from "./valuation.ts";
import { durableChecks } from "./durable.ts";
import { cagr, firstIdx, lastIdx } from "./series.ts";
import { t } from "./i18n.ts";
import type { Financials } from "./types.ts";

/**
 * The columns, in order. kind: "growth" = average growth per year over the period (CAGR), "level" = over the whole
 * period (total / total, so one odd year can't dominate), "score" = criteria met of those that could be judged (the
 * value is the share met, for sorting and colours). good / bad: the yardsticks for the cell colours; lowerIsBetter
 * for the share count (buybacks are good).
 */
export const COLUMNS: { key: string; kind: "growth"|"level"|"score"; good: number; bad: number; lowerIsBetter?: boolean; }[] = [
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
  { key: "buffett", kind: "score", good: 0.75, bad: 0.5 },
  { key: "balance", kind: "score", good: 0.75, bad: 0.5 },
  // Piotroski's own bands: 8-9 of 9 strong, 0-2 weak
  { key: "piotroski", kind: "score", good: 0.85, bad: 0.3 },
];

// The Durable advantage tab's balance-sheet tests (durable.ts groups its rows by statement)
const BALANCE_SHEET = new Set(["retained", "debtToEquity", "longTermDebt", "preferred", "treasury"]);

/**
 * A checklist's score: { v: share met, met, judged, notMet: ids } over the rows that could be judged (pass or fail;
 * not N/A, not waiting for a price), or n/a when none could. Ids, not names, so a row built ahead of time (the S&P 500
 * file) shows them in the visitor's language: see checkName().
 */
/** One cell of the table: its value (null = n/a, with the reason), and for a checklist score what was met. */
export type Cell = { v: number | null; why?: string; met?: number; judged?: number; notMet?: string[] };

function score(rows: { id: string; status: string }[]): Cell {
  const judged = rows.filter((c) => c.status === "pass" || c.status === "fail");
  if (!judged.length) return { v: null, why: "notEnough" };
  const met = judged.filter((c) => c.status === "pass").length;
  return { v: met / judged.length, met, judged: judged.length, notMet: judged.filter((c) => c.status === "fail").map((c) => c.id) };
}

/**
 * The display name of a test in a score column's notMet list: Buffett's criteria and the Piotroski tests are named as on
 * the Graham & Buffett tab, the balance-sheet tests as on the Durable advantage tab. */
export function checkName(column: string, id: string) {
  return t(column === "balance" ? `dur.${id}.name` : `val.${id}.name`);
}

export const MAX_ROWS = 30;

/** Total of a over total of b, over the years both are reported. */
function totalRatio(a: (number|null)[], b: (number|null)[]) {
  let x = 0, y = 0, n = 0;
  a.forEach((v, i) => { if (v != null && b[i] != null) { x += v; y += b[i]; n++; } });
  return n >= 3 && y > 0 ? x / y : null;
}

/**
 * Why a growth rate can't be given (for the cell's tooltip): too few years, a loss or zero at one end, or a dividend
 * never paid, started or stopped during the period.
 */
function growthWhy(arr: (number|null)[], dividend: boolean = false) {
  const i = firstIdx(arr), j = lastIdx(arr);
  if (dividend && (i < 0 || arr.every((v) => v == null || v === 0))) return "noDividend";
  if (i < 0 || i === j) return "notEnough";
  const first = arr[i], last = arr[j] ?? 0;   // (i and j are reported years)
  if (dividend && first === 0 && last > 0) return "startedDividend";
  if (dividend && last <= 0) return "stoppedDividend";
  if (last <= 0) return "negativeEnd";
  return "negativeStart";
}

/**
 * One portfolio row: { ticker, name, from, to, cells: { [column key]: { v: number|null, why?: string } } }.
 * @param d an /api/financials response
 */
export function portfolioRow(d: Financials) {
  const s = d.series, r = analyze(d), fin = r.financial;
  const growth = (arr: (number | null)[], dividend = false): Cell => {
    const v = cagr(arr);
    return v == null ? { v: null, why: growthWhy(arr, dividend) } : { v };
  };
  const level = (v: number | null, why = "notEnough"): Cell => (v == null ? { v: null, why } : { v });
  const bvps = s.equity.map((e, i) => (e != null && s.dilutedShares[i] ? e / s.dilutedShares[i] : null));
  const negEquity = s.equity.some((v) => v != null && v <= 0);
  const value = valueChecks(d, null, r);  // no price here: the margin-of-safety test waits for one and isn't counted
  const rotc = value.rotcOverall;
  const cells: Record<string, Cell> = {
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
    buffett: score(value.buffett),
    balance: score(durableChecks(d, r).filter((c) => BALANCE_SHEET.has(c.id))),
    piotroski: fin ? { v: null, why: "bank" } : score(value.piotroski),
  };
  return { ticker: d.ticker, name: d.name, from: d.years[0], to: d.years[d.years.length - 1], cells };
}

/** "good" | "bad" | "" for a cell's colour. */
export function tone(col: (typeof COLUMNS)[number], v: number|null) {
  if (v == null) return "";
  if (col.lowerIsBetter) return v <= col.good ? "good" : v > col.bad ? "bad" : "";
  return v >= col.good ? "good" : v < col.bad ? "bad" : "";
}

/**
 * The bottom row: the median of each measure over the rows that have it, but the average for the checklist scores,
 * where a median hides the misses (5, 5 and 4 of 5 has a median of 5 of 5). A score's average is
 * { v: average share met, met: average count met, judged } when every row was judged on the same number of tests
 * (met and judged null otherwise). Null when no row has a value. */
/** A score column's bottom-row average. */
export type Average = { v: number; met: number | null; judged: number | null };

export function medians(rows: { cells: Record<string, Cell> }[]): Record<string, number | Average | null> {
  return Object.fromEntries(COLUMNS.map((c): [string, number | Average | null] => {
    const cells = rows.map((row) => row.cells[c.key]).filter((x): x is Cell & { v: number } => x.v != null);
    if (!cells.length) return [c.key, null];
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    if (c.kind === "score") {
      const same = cells.every((x) => x.judged === cells[0].judged);
      return [c.key, { v: mean(cells.map((x) => x.v)), met: same ? mean(cells.map((x) => x.met ?? 0)) : null, judged: same ? cells[0].judged ?? null : null }];
    }
    const vals = cells.map((x) => x.v).sort((a, b) => a - b);
    return [c.key, vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2];
  }));
}

/**
 * Rows sorted by a column; rows without a value always go last. @template T
 * @param key a column key, or "ticker" @param dir 1 = ascending
 */
export function sortRows<T>(rows: T[], key: string, dir: 1|-1) {
  const value = (row: T) => {
    const r = row as { ticker?: string; cells?: Record<string, Cell> };
    return key === "ticker" ? r.ticker ?? null : r.cells ? r.cells[key].v : null;
  };
  return [...rows].sort((a, b) => {
    const x = value(a), y = value(b);
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

/** Tickers from a link or storage: upper-case, de-duplicated, at most `max`.
 */
export function parseTickers(text: string|null|undefined, max: number = MAX_ROWS) {
  const seen = new Set();
  return String(text || "").split(/[\s,]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(x))
    .filter((x) => !seen.has(x) && seen.add(x)).slice(0, max);
}

/** One stock's row in the table. */
export type PortfolioRow = ReturnType<typeof portfolioRow>;
