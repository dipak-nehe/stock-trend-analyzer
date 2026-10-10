// "My portfolio" page wiring: add and remove stocks, load each one's financials, sort, and keep the list in the
// browser (localStorage) and in the address (?t=KO,AAPL), so it survives a reload and can be bookmarked or shared.
// The measures themselves come from portfolio.js.
import { $, $$, API_VERSION, applyStaticText, bindSlashShortcut, enableWhenFilled, initialLang, useLang } from "./page.js";
import { resolveTicker, searchCompanies } from "./company-search.js";
import { bindSuggest } from "./suggest.js";
import { MAX_ROWS, parseTickers } from "./portfolio.js";
import { langQuery, loader, nextSort, same, savedTickers, saveTickers, tableHtml } from "./stock-table.js";
import { setLang, t } from "./i18n.js";

/** @type {import("./stock-table.js").Entry[]} */
let entries = [];
/** @type {import("./stock-table.js").Sort} */
let sort = { key: "", dir: 1 };

// ---------- saving the list ----------
function save() {
  const tickers = entries.filter((e) => e.status !== "error").map((e) => e.ticker);
  saveTickers(tickers);
  const q = new URLSearchParams({ ...(tickers.length ? { t: tickers.join(",") } : {}), ...langQuery() });
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}`);
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

// ---------- the table ----------
function render() {
  const has = entries.length > 0;
  $("pfEmpty").hidden = has;
  $("pfResult").hidden = !has;
  if (has) $("pfTable").innerHTML = tableHtml(entries, sort, { removable: true });
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
add(params.has("t") ? parseTickers(params.get("t")) : savedTickers(), false);
const toAdd = parseTickers(params.get("add"));
if (toAdd.length) add(toAdd);
if (!entries.length) $("pfTicker").focus();
