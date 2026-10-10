// "My portfolio" page wiring: add and remove stocks, load each one's financials, sort, and keep the list in this browser
// (localStorage). The measures themselves come from portfolio.js; the table and loader from stock-table.js.
//
// Two modes:
// - mine: the list saved in this browser. It's re-read whenever it may have changed elsewhere (another tab saving to
//   it, or coming Back to this page), and the address never carries it, so an old address can't bring back an
//   out-of-date list and save it over the real one. "Copy link to share" gives a link with the list (?t=KO,AAPL).
// - shared: opened from such a link. The shared list is shown read-only and never replaces the visitor's own;
//   "Add these to My portfolio" merges it in. (A link whose list is the visitor's own opens as mine.)
// ?add=KO (the "+ Add to my portfolio" link on a result) adds companies to the saved list and opens as mine.
import { $, $$, API_VERSION, applyStaticText, bindSlashShortcut, enableWhenFilled, initialLang, useLang } from "./page.js";
import { resolveTicker, searchCompanies } from "./company-search.js";
import { bindSuggest } from "./suggest.js";
import { MAX_ROWS, parseTickers } from "./portfolio.js";
import { addToSaved, langQuery, loader, nextSort, same, savedTickers, saveTickers, tableHtml } from "./stock-table.js";
import { setLang, t, tn } from "./i18n.js";
import { termsHtml } from "./terms.js";

/** @type {import("./stock-table.js").Entry[]} */
let entries = [];
/** @type {import("./stock-table.js").Sort} */
let sort = { key: "", dir: 1 };
/** @type {"mine" | "shared"} */
let mode = "mine";

const tickersOf = (/** @type {import("./stock-table.js").Entry[]} */ list) => list.filter((e) => e.status !== "error").map((e) => e.ticker);

// ---------- saving the list (mine only) ----------
function save() {
  if (mode !== "mine") return;
  saveTickers(tickersOf(entries));
  cleanUrl();
}

/** The address without the list (only the language), so reloading or coming back always shows the saved list. */
function cleanUrl() {
  const q = new URLSearchParams(langQuery());
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}`);
}

/** Bring the table in line with the saved list: keep loaded rows, start new ones, drop removed ones. */
function syncFromStorage() {
  if (mode !== "mine") return;
  const saved = savedTickers();
  entries = saved.map((ticker) => entries.find((e) => same(e.ticker, ticker)) || { ticker, status: /** @type {const} */ ("loading") });
  render();
  pump();
}

function status(text, isError = false) {
  $("pfStatus").textContent = text;
  $("pfStatus").className = `cmp-status${isError ? " error-text" : ""}`;
}

// ---------- loading ----------
const pump = loader(() => entries, () => { save(); render(); });

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

// ---------- the page ----------
function render() {
  const shared = mode === "shared", has = entries.length > 0;
  $("pfShared").hidden = !shared;
  $("pfSearch").hidden = shared;
  $("pfTools").hidden = shared;
  if (shared) $("pfSharedTitle").textContent = tn("pf.sharedTitle", entries.length);
  $("pfEmpty").hidden = has || shared;
  $("pfResult").hidden = !has;
  if (has) $("pfTable").innerHTML = tableHtml(entries, sort, { removable: !shared });
  $("pfTermsList").innerHTML = termsHtml();
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
    sort = nextSort(sort, key);
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
$("pfShare").addEventListener("click", () => {
  const url = `${location.origin}${location.pathname}?${new URLSearchParams({ t: tickersOf(entries).join(",") })}`;
  const done = (/** @type {string} */ key) => status(t(key, { url }));
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => done("pf.copied"), () => done("pf.copyThis"));
  else done("pf.copyThis");
});
$("pfSharedAdd").addEventListener("click", () => {
  const r = addToSaved(tickersOf(entries));
  const parts = [t("spv.saved", { n: r.added.length })];
  if (r.skipped.length) parts.push(t("spv.already", { list: r.skipped.join(", ") }));
  if (r.full.length) parts.push(t("spv.full", { max: MAX_ROWS, list: r.full.join(", ") }));
  $("pfSharedStatus").textContent = parts.join(" ");
});
// Another tab (or the S&P 500 page) saved to the list: show it
window.addEventListener("storage", (e) => { if (e.key === "portfolio") syncFromStorage(); });
// Back to this page from the browser's memory: the list may have changed while away
window.addEventListener("pageshow", (e) => { if (e.persisted) syncFromStorage(); });
$$(".lang-switch [data-lang]").forEach((btn) => btn.addEventListener("click", () => {
  if (!useLang(btn.dataset.lang)) return;
  $("pfSuggest").setAttribute("aria-label", t("search.suggestions"));
  if (mode === "mine") cleanUrl();
  else history.replaceState(null, "", `${location.pathname}?${new URLSearchParams({ t: tickersOf(entries).join(","), ...langQuery() })}`);
  render();
}));
bindSlashShortcut("pfTicker");
const syncAdd = enableWhenFilled("pfTicker", "pfAdd");

// ---------- start ----------
const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
$("pfSuggest").setAttribute("aria-label", t("search.suggestions"));
const linked = params.has("t") ? parseTickers(params.get("t")) : null;
const mine = savedTickers();
const sameList = (/** @type {string[]} */ a, /** @type {string[]} */ b) => a.length === b.length && a.every((x) => b.some((y) => same(x, y)));
if (linked && !sameList(linked, mine)) {
  mode = "shared";
  add(linked, false);
} else {
  add(mine, false);
  const toAdd = parseTickers(params.get("add"));
  if (toAdd.length) add(toAdd);
  cleanUrl();
  if (!entries.length) $("pfTicker").focus();
}
