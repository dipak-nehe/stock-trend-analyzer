// The search box's company lookup: suggestions from /api/search, and turning typed text into a ticker.
// Kept apart from page.js (which needs a browser page) so it can be unit-tested on its own.

/** Company suggestions for the search box: [{ ticker, name }], best first. @param {string} q @param {number} [v] */
export async function searchCompanies(q, v = 0) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&v=${v}`);
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  return (await res.json()).results;
}

/** What to look up for the search-box text: the text itself when it's a ticker SEC knows, else the best-matching
 * company's ticker ("coca cola" -> "KO"), else the text unchanged (so the usual "not found" message shows).
 * @param {string} text @param {number} [v] the API version, so the CDN's cached answers follow it */
export async function resolveTicker(text, v = 0) {
  const q = text.trim();
  if (!q) return q;
  try {
    const results = await searchCompanies(q, v);
    const asTicker = q.toUpperCase().replace(/[./]/g, "-");
    if (results.some((r) => r.ticker.toUpperCase().replace(/[./]/g, "-") === asTicker)) return q;
    return results.length ? results[0].ticker : q;
  } catch {
    return q;  // search unavailable: try it as a ticker
  }
}
