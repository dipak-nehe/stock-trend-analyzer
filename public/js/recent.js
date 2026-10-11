// The start page's chips: the companies this visitor opened most recently (newest first), or a few well-known examples
// before they have opened any. Kept only in this browser (localStorage); nothing is sent anywhere.
// No page code here, so it can be unit-tested; app.js draws the chips.

export const DEFAULT_TICKERS = ["AAPL", "KO", "MSFT", "JPM", "INTC", "T"];
export const MAX_RECENT = 6;
const KEY = "recentTickers";
const TICKER = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;

/** The list with ticker moved to the front, no duplicates, at most max. @param {string[]} list @param {string} ticker */
export function addRecent(list, ticker, max = MAX_RECENT) {
  const tk = ticker.trim().toUpperCase();
  if (!TICKER.test(tk)) return list.slice(0, max);
  return [tk, ...list.filter((x) => x !== tk)].slice(0, max);
}

/** Read a stored list, keeping only well-formed tickers (the value could be anything). @param {string | null} raw */
export function parseRecent(raw) {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && TICKER.test(x)))].slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** This browser's recent companies, newest first; [] when none or storage is unavailable. */
export function loadRecent() {
  try { return parseRecent(localStorage.getItem(KEY)); } catch { return []; }
}

/** Put a company at the front of this browser's list. @param {string} ticker */
export function rememberRecent(ticker) {
  try { localStorage.setItem(KEY, JSON.stringify(addRecent(loadRecent(), ticker))); } catch { /* storage unavailable: no list */ }
}

export function clearRecent() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/** What the chips show: the recent companies when there are any, otherwise the examples. @param {string[]} recent */
export function chipList(recent) {
  return recent.length ? { recent: true, tickers: recent } : { recent: false, tickers: DEFAULT_TICKERS };
}
