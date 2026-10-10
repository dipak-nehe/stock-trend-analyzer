// The stock table shared by My portfolio (portfolio.html) and the S&P 500 selection (sp500-view.html): loading the
// companies a few at a time, drawing the table (ten measures, Buffett's criteria and the balance-sheet score, a median row, sortable
// headers), and the saved portfolio list in this browser. The measures come from portfolio.js.
import { fetchFinancials } from "./page.js";
import { COLUMNS, MAX_ROWS, checkName, medians, parseTickers, portfolioRow, sortRows, tone } from "./portfolio.js";
import { getLang, t } from "./i18n.js";
import { pct } from "./format.js";

/** @typedef {{ ticker: string, status: "loading" | "ok" | "error", row?: any, error?: string, started?: boolean }} Entry */
/** @typedef {{ key: string, dir: 1 | -1 }} Sort */

export const esc = (/** @type {string} */ s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/** The same company? BRK.B and BRK-B are. @param {string} a @param {string} b */
export const same = (a, b) => a.toUpperCase().replace(/[./]/g, "-") === b.toUpperCase().replace(/[./]/g, "-");
export const langQuery = () => (getLang() !== "en" ? { lang: getLang() } : {});

// ---------- the saved portfolio (this browser) ----------
const STORE = "portfolio";

/** The tickers saved in My portfolio, or [] when there are none or storage is unavailable. */
export function savedTickers() {
  try { return parseTickers(localStorage.getItem(STORE)); } catch { return []; }
}

/** Replace the saved list. @param {string[]} tickers */
export function saveTickers(tickers) {
  try { localStorage.setItem(STORE, tickers.join(",")); } catch { /* storage unavailable: the address still has them */ }
}

/**
 * Add tickers to the saved list, skipping ones already there and stopping at MAX_ROWS.
 * Returns { added, skipped (already saved), full (left out: no room) }. @param {string[]} tickers
 */
export function addToSaved(tickers) {
  const list = savedTickers(), added = [], skipped = [], full = [];
  for (const ticker of tickers) {
    if (list.some((x) => same(x, ticker))) skipped.push(ticker);
    else if (list.length >= MAX_ROWS) full.push(ticker);
    else { list.push(ticker); added.push(ticker); }
  }
  saveTickers(list);
  return { added, skipped, full };
}

// ---------- loading ----------
const PARALLEL = 3;  // companies loaded at the same time (a first-time lookup makes the server ask SEC)

/**
 * A loader for a list of entries: start() fetches the ones still loading, PARALLEL at a time, and calls onChange
 * after each one finishes. @param {() => Entry[]} getEntries @param {() => void} onChange
 */
export function loader(getEntries, onChange) {
  let running = 0;
  const start = () => {
    for (const e of getEntries()) {
      if (running >= PARALLEL) return;
      if (e.status !== "loading" || e.started) continue;
      e.started = true;
      running++;
      fetchFinancials(e.ticker)
        .then((d) => { e.ticker = d.ticker; e.row = portfolioRow(d); e.status = "ok"; })
        .catch((err) => { e.error = /** @type {Error} */ (err).message; e.status = "error"; })
        .finally(() => { running--; onChange(); start(); });
    }
  };
  return start;
}

// ---------- the table ----------
/** @param {(typeof COLUMNS)[number]} col @param {{v: number|null, why?: string, met?: number, judged?: number, notMet?: string[]}} c */
function cell(col, c) {
  if (c.v == null) {
    const why = t(`pf.why.${c.why || "notEnough"}`);
    return `<td class="nm" title="${esc(why)}">${t("cmp.na")}<span class="sr-only"> (${esc(why)})</span></td>`;
  }
  if (col.kind === "score") {
    // "3 of 4", with the checks not met on hover (named as on their tab); the median row has only the share met
    if (c.met == null) return `<td class="pf-cell ${tone(col, c.v)}">${esc(t("pf.scoreMedian", { pct: pct(c.v, 0) }))}</td>`;
    const detail = c.notMet && c.notMet.length ? t("pf.notMet", { list: c.notMet.map((id) => checkName(col.key, id)).join(", ") }) : t("pf.allMet");
    return `<td class="pf-cell ${tone(col, c.v)}" title="${esc(detail)}">${esc(t("pf.score", { met: c.met, judged: c.judged }))}`
      + `<span class="sr-only"> (${esc(detail)})</span></td>`;
  }
  const text = col.kind === "growth" && c.v > 0 ? `+${pct(c.v)}` : pct(c.v);
  return `<td class="pf-cell ${tone(col, c.v)}">${text}</td>`;
}

/**
 * The table's HTML: header with sort buttons, a row per entry (loaded ones sorted, then loading and failed ones),
 * and a median row once two have loaded. With removable, each row ends with a remove button.
 * @param {Entry[]} entries @param {Sort} sort @param {{ removable?: boolean }} [opts]
 */
export function tableHtml(entries, sort, { removable = false } = {}) {
  const header = (/** @type {string} */ key, /** @type {string} */ label, /** @type {string} */ help = "") => {
    const ariaSort = sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none";
    const arrow = sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "";
    return `<th scope="col" aria-sort="${ariaSort}"${help ? ` title="${esc(help)}"` : ""}><button type="button" class="pf-sort" data-sort="${key}">${esc(label)}${arrow}</button></th>`;
  };
  const actionsHead = removable ? `<th scope="col"><span class="sr-only">${t("pf.actions")}</span></th>` : "";
  const head = `<thead><tr>${header("ticker", t("pf.company"))}${COLUMNS.map((c) => header(c.key, t(`pf.col.${c.key}`), t(`pf.help.${c.key}`))).join("")}${actionsHead}</tr></thead>`;

  const ok = entries.filter((e) => e.row);
  const others = entries.filter((e) => !e.row);
  const sorted = sort.key ? sortRows(ok.map((e) => ({ ...e.row, entry: e })), sort.key, sort.dir).map((r) => r.entry) : ok;
  const removeBtn = (/** @type {string} */ ticker) => (removable
    ? `<td><button type="button" class="pf-remove" data-remove="${esc(ticker)}" aria-label="${esc(t("pf.remove", { ticker }))}">✕</button></td>` : "");
  const link = (/** @type {string} */ ticker) => `index.html?${new URLSearchParams({ t: ticker, ...langQuery() })}`;
  const rows = [...sorted, ...others].map((e) => {
    if (e.row) {
      const r = e.row;
      return `<tr data-testid="pf-row"><th scope="row"><a href="${link(r.ticker)}">${esc(r.name)} (${esc(r.ticker)})</a><span class="pf-years">${r.from}–${r.to}</span></th>`
        + COLUMNS.map((c) => cell(c, r.cells[c.key])).join("") + removeBtn(r.ticker) + "</tr>";
    }
    const msg = e.status === "error" ? `<span class="error-text">${esc(e.error || "")}</span>` : `<span class="muted">${esc(t("pf.loading", { ticker: e.ticker }))}</span>`;
    return `<tr data-testid="pf-row"><th scope="row">${esc(e.ticker)}</th><td colspan="${COLUMNS.length}">${msg}</td>${removeBtn(e.ticker)}</tr>`;
  }).join("");

  let foot = "";
  if (ok.length >= 2) {
    const m = medians(ok.map((e) => e.row));
    foot = `<tfoot><tr data-testid="pf-median"><th scope="row">${esc(t("pf.median", { n: ok.length }))}</th>`
      + COLUMNS.map((c) => cell(c, { v: m[c.key] })).join("") + (removable ? "<td></td>" : "") + "</tr></tfoot>";
  }
  return `${head}<tbody>${rows}</tbody>${foot}`;
}

/** The sort after clicking a column: numbers start high-to-low (best growth first), names A-Z; again reverses.
 * @param {Sort} sort @param {string} key @returns {Sort} */
export function nextSort(sort, key) {
  return sort.key === key ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: key === "ticker" ? 1 : -1 };
}
