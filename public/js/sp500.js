// The S&P 500 picker's rules: filtering the company list, and the limit of 10 picks at a time (a side-by-side table
// stays readable, and each pick is looked up live). No page code here, so it can be unit-tested; sp500-app.js and
// sp500-view-app.js put it on the pages.
import { parseTickers } from "./portfolio.js";

export const MAX_PICKS = 10;

/** @typedef {{ t: string, n: string, s: string }} Company  ticker, name, sector (from public/data/sp500.json) */

const fold = (/** @type {string} */ s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Companies matching the search text (a ticker that starts with it, or a name containing every word of it) and the
 * sector ("" = all). @param {Company[]} list @param {string} text @param {string} sector
 */
export function filterCompanies(list, text, sector) {
  const q = fold(text), words = q ? q.split(" ") : [];
  const qTicker = text.trim().toUpperCase().replace(/[-/]/g, ".");
  return list.filter((c) => (!sector || c.s === sector)
    && (!words.length || c.t.startsWith(qTicker) || words.every((w) => fold(c.n).includes(w))));
}

/** The sectors in the list, A-Z. @param {Company[]} list */
export function sectors(list) {
  return [...new Set(list.map((c) => c.s))].sort((a, b) => a.localeCompare(b));
}

/**
 * Tick or untick a company. Returns the new picks, and refused: true when it would be an 11th.
 * @param {string[]} picks @param {string} ticker
 */
export function togglePick(picks, ticker) {
  if (picks.includes(ticker)) return { picks: picks.filter((x) => x !== ticker), refused: false };
  if (picks.length >= MAX_PICKS) return { picks, refused: true };
  return { picks: [...picks, ticker], refused: false };
}

/**
 * Picks from an address (?t= or ?pick=): cleaned and de-duplicated, at most MAX_PICKS; dropped = how many were cut.
 * @param {string|null|undefined} text
 */
export function parsePicks(text) {
  const all = parseTickers(text, Infinity);
  return { picks: all.slice(0, MAX_PICKS), dropped: Math.max(0, all.length - MAX_PICKS) };
}
