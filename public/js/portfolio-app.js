// "My portfolio" page wiring: add and remove stocks, load each one's financials, sort, and keep the list in the
// browser (localStorage) and in the address (?t=KO,AAPL), so it survives a reload and can be bookmarked or shared.
// The measures themselves come from portfolio.js.
import { $, $$, API_VERSION, applyStaticText, bindSlashShortcut, enableWhenFilled, fetchFinancials, initialLang, useLang } from "./page.js";
import { resolveTicker, searchCompanies } from "./company-search.js";
import { bindSuggest } from "./suggest.js";
import { COLUMNS, MAX_ROWS, medians, parseTickers, portfolioRow, sortRows, tone } from "./portfolio.js";
import { getLang, setLang, t } from "./i18n.js";
import { pct } from "./format.js";

const STORE = "portfolio";
const PARALLEL = 3;  // companies loaded at the same time (a first-time lookup makes the server ask SEC)

/** @typedef {{ ticker: string, status: "loading" | "ok" | "error", row?: any, error?: string }} Entry */
/** @type {Entry[]} */
let entries = [];
let sort = { key: "", dir: /** @type {1|-1} */ (1) };

const esc = (/** @type {string} */ s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const same = (/** @type {string} */ a, /** @type {string} */ b) => a.toUpperCase().replace(/[./]/g, "-") === b.toUpperCase().replace(/[./]/g, "-");
const langQuery = () => (getLang() !== "en" ? { lang: getLang() } : {});

// ---------- saving the list ----------
function save() {
  const tickers = entries.filter((e) => e.status !== "error").map((e) => e.ticker);
  try { localStorage.setItem(STORE, tickers.join(",")); } catch { /* storage unavailable: the address still has them */ }
  const q = new URLSearchParams({ ...(tickers.length ? { t: tickers.join(",") } : {}), ...langQuery() });
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}`);
}

function status(text, isError = false) {
  $("pfStatus").textContent = text;
  $("pfStatus").className = `cmp-status${isError ? " error-text" : ""}`;
}

// ---------- loading ----------
let running = 0;
function pump() {
  for (const e of entries) {
    if (running >= PARALLEL) return;
    if (e.status !== "loading" || e.row || e.error || /** @type {any} */ (e).started) continue;
    /** @type {any} */ (e).started = true;
    running++;
    fetchFinancials(e.ticker)
      .then((d) => { e.ticker = d.ticker; e.row = portfolioRow(d); e.status = "ok"; })
      .catch((err) => { e.error = /** @type {Error} */ (err).message; e.status = "error"; })
      .finally(() => { running--; save(); render(); pump(); });
  }
}

/** Add tickers to the list (skipping ones already there) and start loading them. @param {string[]} tickers */
function add(tickers, announce = true) {
  for (const ticker of tickers) {
    if (entries.some((e) => same(e.ticker, ticker))) { if (announce) status(t("pf.already", { ticker })); continue; }
    if (entries.length >= MAX_ROWS) { status(t("pf.full", { max: MAX_ROWS }), true); break; }
    entries.push({ ticker, status: "loading" });
    if (announce) status(t("pf.loading", { ticker }));
  }
  save();
  render();
  pump();
}

function remove(/** @type {string} */ ticker) {
  entries = entries.filter((e) => !same(e.ticker, ticker));
  status(t("pf.removed", { ticker }));
  save();
  render();
}

// ---------- the table ----------
function cell(/** @type {(typeof COLUMNS)[number]} */ col, /** @type {{v: number|null, why?: string}} */ c) {
  if (c.v == null) {
    const why = t(`pf.why.${c.why || "notEnough"}`);
    return `<td class="nm" title="${esc(why)}">${t("cmp.na")}<span class="sr-only"> (${esc(why)})</span></td>`;
  }
  const text = col.kind === "growth" && c.v > 0 ? `+${pct(c.v)}` : pct(c.v);
  return `<td class="pf-cell ${tone(col, c.v)}">${text}</td>`;
}

function render() {
  const has = entries.length > 0;
  $("pfEmpty").hidden = has;
  $("pfResult").hidden = !has;
  if (!has) return;

  const header = (/** @type {string} */ key, /** @type {string} */ label, /** @type {string} */ help = "") => {
    const ariaSort = sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none";
    const arrow = sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "";
    return `<th scope="col" aria-sort="${ariaSort}"${help ? ` title="${esc(help)}"` : ""}><button type="button" class="pf-sort" data-sort="${key}">${esc(label)}${arrow}</button></th>`;
  };
  const head = `<thead><tr>${header("ticker", t("pf.company"))}${COLUMNS.map((c) => header(c.key, t(`pf.col.${c.key}`), t(`pf.help.${c.key}`))).join("")}<th scope="col"><span class="sr-only">${t("pf.actions")}</span></th></tr></thead>`;

  const ok = entries.filter((e) => e.row);
  const others = entries.filter((e) => !e.row);
  const sorted = sort.key ? sortRows(ok.map((e) => ({ ...e.row, entry: e })), sort.key, sort.dir).map((r) => r.entry) : ok;
  const removeBtn = (/** @type {string} */ ticker) => `<td><button type="button" class="pf-remove" data-remove="${esc(ticker)}" aria-label="${esc(t("pf.remove", { ticker }))}">✕</button></td>`;
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
      + COLUMNS.map((c) => cell(c, { v: m[c.key] })).join("") + "<td></td></tr></tfoot>";
  }
  $("pfTable").innerHTML = `${head}<tbody>${rows}</tbody>${foot}`;
}

// ---------- events ----------
const suggest = bindSuggest(/** @type {HTMLInputElement} */ ($("pfTicker")), $("pfSuggest"), {
  fetchResults: (q) => searchCompanies(q, API_VERSION),
  onPick: (ticker) => { $("pfTicker").value = ""; syncAdd(); add([ticker]); },
});
$("pfForm").addEventListener("submit", async (/** @type {Event} */ e) => {
  e.preventDefault();
  suggest.close();
  const text = $("pfTicker").value.trim();
  if (!text) return;
  $("pfTicker").value = "";
  syncAdd();
  add([(await resolveTicker(text, API_VERSION)).toUpperCase()]);
});
$$(".chip[data-t]").forEach((chip) => chip.addEventListener("click", () => add([chip.dataset.t || ""])));
$("pfTable").addEventListener("click", (/** @type {Event} */ e) => {
  const el = /** @type {HTMLElement} */ (e.target);
  const sortBtn = /** @type {HTMLElement | null} */ (el.closest("[data-sort]"));
  if (sortBtn) {
    const key = sortBtn.dataset.sort || "";
    // Numbers start high-to-low (the best growth first); names start A-Z. A second click reverses.
    sort = sort.key === key ? { key, dir: /** @type {1|-1} */ (-sort.dir) } : { key, dir: key === "ticker" ? 1 : -1 };
    render();
    $("pfTable").querySelector(`[data-sort="${key}"]`).focus();
    return;
  }
  const removeBtn = /** @type {HTMLElement | null} */ (el.closest("[data-remove]"));
  if (removeBtn) { remove(removeBtn.dataset.remove || ""); $("pfTicker").focus(); }
});
$("pfClear").addEventListener("click", () => {
  entries = [];
  status(t("pf.cleared"));
  save();
  render();
  $("pfTicker").focus();
});
$$(".lang-switch [data-lang]").forEach((btn) => btn.addEventListener("click", () => {
  if (!useLang(btn.dataset.lang)) return;
  $("pfSuggest").setAttribute("aria-label", t("search.suggestions"));
  save();
  render();
}));
bindSlashShortcut("pfTicker");
const syncAdd = enableWhenFilled("pfTicker", "pfAdd");

// ---------- start ----------
// The list comes from the address when it has one (a bookmark or a shared link), else from this browser. ?add=KO (the
// "Add to my portfolio" link on a result) adds one company to the saved list.
const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
$("pfSuggest").setAttribute("aria-label", t("search.suggestions"));
let saved = "";
try { saved = localStorage.getItem(STORE) || ""; } catch { /* storage unavailable */ }
add(parseTickers(params.has("t") ? params.get("t") : saved), false);
const toAdd = parseTickers(params.get("add"));
if (toAdd.length) add(toAdd);
if (!entries.length) $("pfTicker").focus();
