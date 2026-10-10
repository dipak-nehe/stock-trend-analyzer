// The S&P 500 selection page (sp500-view.html?t=KO,AAPL): the picked companies (at most 10) in the same table as
// My portfolio, loaded live. Read-only: it doesn't change the saved portfolio unless "Save to My portfolio" is pressed.
import { $, $$, applyStaticText, initialLang, useLang } from "./page.js";
import { MAX_PICKS, parsePicks } from "./sp500.js";
import { MAX_ROWS } from "./portfolio.js";
import { addToSaved, esc, langQuery, loader, nextSort, tableHtml } from "./stock-table.js";
import { setLang, t } from "./i18n.js";
import { termsHtml } from "./terms.js";
import { downloadCsv, tableRows } from "./csv.js";

/** @type {import("./stock-table.js").Entry[]} */
let entries = [];
/** @type {import("./stock-table.js").Sort} */
let sort = { key: "", dir: 1 };

function render() {
  const has = entries.length > 0;
  $("spvEmpty").hidden = has;
  $("pfResult").hidden = !has;
  $("spvSave").hidden = !has;
  if (has) $("pfTable").innerHTML = tableHtml(entries, sort);
  $("pfTermsList").innerHTML = termsHtml();
  const tickers = entries.map((e) => e.ticker).join(",");
  $("spvBack").href = `sp500.html?${new URLSearchParams({ ...(tickers ? { pick: tickers } : {}), ...langQuery() })}`;
}

function updateUrl() {
  const q = new URLSearchParams({ ...(entries.length ? { t: entries.map((e) => e.ticker).join(",") } : {}), ...langQuery() });
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}`);
}

// ---------- events ----------
$("pfTable").addEventListener("click", (/** @type {Event} */ e) => {
  const btn = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest("[data-sort]"));
  if (!btn) return;
  const key = btn.dataset.sort || "";
  sort = nextSort(sort, key);
  render();
  $("pfTable").querySelector(`[data-sort="${key}"]`).focus();
});
$("spvCsv").addEventListener("click", () => downloadCsv("sp500-picks.csv", tableRows(entries)));
$("spvSave").addEventListener("click", () => {
  const r = addToSaved(entries.filter((e) => e.status !== "error").map((e) => e.ticker));
  const parts = [t("spv.saved", { n: r.added.length })];
  if (r.skipped.length) parts.push(t("spv.already", { list: r.skipped.join(", ") }));
  if (r.full.length) parts.push(t("spv.full", { max: MAX_ROWS, list: r.full.join(", ") }));
  $("spvStatus").innerHTML = `${esc(parts.join(" "))} `
    + `<a href="portfolio.html?${new URLSearchParams(langQuery())}" data-testid="spv-open-portfolio">${t("spv.open")}</a>`;
});
$$(".lang-switch [data-lang]").forEach((btn) => btn.addEventListener("click", () => {
  if (!useLang(btn.dataset.lang)) return;
  updateUrl();
  render();
}));

// ---------- start ----------
const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
const { picks, dropped } = parsePicks(params.get("t"));
entries = picks.map((ticker) => ({ ticker, status: /** @type {const} */ ("loading") }));
if (dropped) $("spvStatus").textContent = t("sp.dropped", { max: MAX_PICKS, n: dropped });
updateUrl();
render();
loader(() => entries, () => { updateUrl(); render(); })();
