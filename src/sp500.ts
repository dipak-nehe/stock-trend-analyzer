// The S&P 500 picker's rules: filtering the company list, and the limit of 10 picks at a time (a side-by-side table
// stays readable, and each pick is looked up live). No page code here, so it can be unit-tested; sp500-app.ts and
// sp500-view-app.ts put it on the pages.
import { parseTickers } from "./portfolio.ts";

export const MAX_PICKS = 10;

/** Ticker, name, sector (from public/data/sp500.json). */
export type Company = { t: string; n: string; s: string };

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Companies matching the search text (a ticker that starts with it, or a name containing every word of it) and the
 * sector ("" = all). */
export function filterCompanies(list: Company[], text: string, sector: string) {
  const q = fold(text), words = q ? q.split(" ") : [];
  const qTicker = text.trim().toUpperCase().replace(/[-/]/g, ".");
  return list.filter((c) => (!sector || c.s === sector)
    && (!words.length || c.t.startsWith(qTicker) || words.every((w) => fold(c.n).includes(w))));
}

/** The sectors in the list, A-Z. */
export function sectors(list: Company[]) {
  return [...new Set(list.map((c) => c.s))].sort((a, b) => a.localeCompare(b));
}

/**
 * Tick or untick a company. Returns the new picks, and refused: true when it would be an 11th.
 */
export function togglePick(picks: string[], ticker: string) {
  if (picks.includes(ticker)) return { picks: picks.filter((x) => x !== ticker), refused: false };
  if (picks.length >= MAX_PICKS) return { picks, refused: true };
  return { picks: [...picks, ticker], refused: false };
}

/**
 * Picks from an address (?t= or ?pick=): cleaned and de-duplicated, at most MAX_PICKS; dropped = how many were cut.
 */
export function parsePicks(text: string|null|undefined) {
  const all = parseTickers(text, Infinity);
  return { picks: all.slice(0, MAX_PICKS), dropped: Math.max(0, all.length - MAX_PICKS) };
}
