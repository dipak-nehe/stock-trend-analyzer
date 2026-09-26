// Page wiring: search, URL state, events, and putting each view on the page.
// All analysis lives in the other modules; this file is the only one that touches the DOM.
import { analyze } from "./flags.js";
import { valueChecks } from "./valuation.js";
import { growthView } from "./growth.js";
import { historyView } from "./history.js";
import { renderCharts } from "./charts.js";
import { dataTable, filingProblems, flagCounts, flagsList, footnote, glanceView, trendTile, valueView } from "./views.js";
import { money, perShare } from "./format.js";
import { detectLang, dictionaries, getLang, setLang, t } from "./i18n.js";

const $ = (id) => document.getElementById(id);
// Bump when the API response format changes, so no cache serves an older shape to newer code.
const API_VERSION = 4;

let current = null;  // { data: API response, result: analyze(data) }
let historyFilter = "all", historyExpanded = false;
const TABS = ["overview", "flags", "history", "value", "charts", "data"];
let activeTab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
let chartsStale = true;  // charts are drawn when their tab is first shown (a hidden canvas has no size)

function render(d) {
  const s = d.series, cur = d.currency;
  const r = analyze(d);
  current = { data: d, result: r };

  $("coName").textContent = `${d.name} (${d.ticker})`;
  const industry = d.secHistory && d.secHistory.industry;
  $("coMeta").textContent = (industry ? industry + " · " : "")
    + t("company.meta", { from: d.years[0], to: d.years[d.years.length - 1], cur, cik: d.cik });
  $("secLink").href = d.secUrl;

  $("tiles").innerHTML = [
    trendTile(t("tile.revenue"), s.revenue, money, cur),
    trendTile(t("tile.netIncome"), s.netIncome, money, cur),
    trendTile(t("tile.eps"), s.eps, perShare, cur),
    trendTile(t("tile.dps"), s.dps, perShare, cur),
  ].join("");
  $("score").innerHTML = flagCounts(r.flags);
  $("flags").innerHTML = flagsList(r.flags);
  $("table").innerHTML = dataTable(d, r);

  const growth = growthView(d, r);
  $("growthTable").innerHTML = growth.table;
  $("growthIntro").textContent = growth.intro;
  $("note").textContent = footnote(d);

  const crit = r.flags.filter((f) => f.sev === "critical").length;
  $("flagsBadge").textContent = crit || "";
  const problems = filingProblems(d.secHistory);
  $("historyBadge").textContent = problems && problems.sev === "critical" ? problems.total : "";
  $("tab-history").hidden = !d.secHistory;
  if (!d.secHistory && activeTab === "history") activeTab = "overview";

  renderPanelNav();
  $("result").classList.remove("hidden");
  $("guide").open = false;  // keep the results in view; the guide stays one click away
  $("guide").classList.add("has-results");  // guide cards now open their tab
  $("guide").querySelector(".guide-title").textContent = t("guide.titleAfter");
  document.title = `${d.ticker} · Stock Trend Analyzer`;
  historyFilter = "all"; historyExpanded = false;
  renderHistory();
  renderValue();
  chartsStale = true;
  showTab(activeTab);
}

// "← Previous / Next →" at the bottom of each tab, skipping tabs hidden for this company.
function renderPanelNav() {
  const visible = TABS.filter((tab) => !$(`tab-${tab}`).hidden);
  document.querySelectorAll(".panel-nav").forEach((nav) => {
    const i = visible.indexOf(nav.dataset.for);
    const prev = visible[i - 1], next = visible[i + 1];
    nav.innerHTML = (prev ? `<button type="button" class="prev" data-tab="${prev}">${t("nav.prev", { name: t(`tab.${prev}`) })}</button>` : "")
      + (next ? `<button type="button" class="next" data-tab="${next}">${t("nav.next", { name: t(`tab.${next}`) })}</button>` : "");
  });
}

function openTabAndScroll(name) {
  showTab(name);
  $("tabs").scrollIntoView({ behavior: "smooth", block: "start" });
}

// On narrow screens the tab bar scrolls sideways: keep the active tab in view and fade the edge
// that has more tabs beyond it.
function revealTab(tab) {
  const bar = $("tabs");
  if (bar.scrollWidth > bar.clientWidth) bar.scrollLeft = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
  updateTabFades();
}
function updateTabFades() {
  const bar = $("tabs");
  bar.classList.toggle("more-left", bar.scrollLeft > 4);
  bar.classList.toggle("more-right", bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4);
}

function showTab(name, { focus = false } = {}) {
  activeTab = name;
  for (const tab of TABS) {
    const selected = tab === name;
    $(`tab-${tab}`).setAttribute("aria-selected", selected);
    $(`tab-${tab}`).tabIndex = selected ? 0 : -1;
    $(`panel-${tab}`).hidden = !selected;
  }
  if (focus) $(`tab-${name}`).focus();
  revealTab($(`tab-${name}`));
  if (name === "charts" && chartsStale && current) {
    renderCharts(current.data, current.result);
    chartsStale = false;
  }
  updateUrl();
}

function renderHistory() {
  const h = current.data.secHistory;
  if (!h) return;
  const view = historyView(h, historyFilter, historyExpanded);
  $("historyIntro").innerHTML = view.intro;
  $("historyTiles").innerHTML = view.tiles;
  $("historyFilters").innerHTML = view.filters;
  $("historyList").innerHTML = view.events;
  $("historyMore").classList.toggle("hidden", view.total <= 10);
  $("historyMore").textContent = view.moreText;
}

function renderValue() {
  if (!current) return;
  const d = current.data;
  const price = parseFloat($("price").value) || null;
  const checks = valueChecks(d, price, current.result);
  const view = valueView(d, price, checks);
  $("glance").innerHTML = glanceView(d, current.result, checks);
  $("valueTiles").innerHTML = view.tiles;
  $("grahamChecks").innerHTML = view.graham; $("grahamScore").innerHTML = view.grahamScore;
  $("buffettChecks").innerHTML = view.buffett; $("buffettScore").innerHTML = view.buffettScore;
  $("priceHint").textContent = view.priceHint;
  $("priceLinks").innerHTML = view.links;
  $("valueNote").textContent = view.note;
}

// The server answers in English; show its message as-is in English, otherwise translate by type.
function errorText(status, message, ticker) {
  if (getLang() === "en") return message;
  const key = status === 400 ? (/enter a ticker/i.test(message) ? "error.empty" : "error.badTicker")
    : status === 404 ? (/no financial data/i.test(message) ? "error.noData" : "error.notFound")
    : status === 502 ? (/limiting/i.test(message) ? "error.busy" : "error.upstream")
    : status === 504 ? "error.timeout" : "error.generic";
  return t(key, { ticker });
}

async function run(ticker) {
  ticker = ticker.trim().toUpperCase();
  if (!ticker) return;
  $("ticker").value = ticker;
  $("error").classList.add("hidden");
  $("loading").classList.remove("hidden");
  $("go").disabled = true;
  try {
    const res = await fetch(`/api/financials?ticker=${encodeURIComponent(ticker)}&v=${API_VERSION}`);
    const body = await res.json();
    if (!res.ok) throw new Error(errorText(res.status, body.error || `HTTP ${res.status}`, ticker));
    render(body);
    updateUrl();
  } catch (e) {
    $("result").classList.add("hidden");
    $("error").textContent = e.message;
    $("error").classList.remove("hidden");
  } finally {
    $("loading").classList.add("hidden");
    $("go").disabled = false;
  }
}

function updateUrl() {
  const q = new URLSearchParams();
  if (current) q.set("t", current.data.ticker);
  const p = parseFloat($("price").value);
  if (current && p > 0) q.set("p", p);
  if (getLang() !== "en") q.set("lang", getLang());
  const hash = current && activeTab !== "overview" ? `#${activeTab}` : "";
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}${hash}`);
}

// ---------- language ----------
// Static text: the English stays in index.html (kept in data-en the first time) and other languages
// come from the "ui.*" keys in strings/<lang>.js.
function applyStaticText() {
  const lang = getLang(), dict = dictionaries[lang];
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    if (!("en" in el.dataset)) el.dataset.en = el.innerHTML;
    el.innerHTML = lang === "en" ? el.dataset.en : (dict[el.dataset.i18n] ?? el.dataset.en);
  }
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) {
    if (!("enPlaceholder" in el.dataset)) el.dataset.enPlaceholder = el.placeholder;
    el.placeholder = lang === "en" ? el.dataset.enPlaceholder : (dict[el.dataset.i18nPlaceholder] ?? el.dataset.enPlaceholder);
  }
  document.querySelectorAll(".lang-switch [data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  if (current) $("guide").querySelector(".guide-title").textContent = t("guide.titleAfter");
}

function switchLang(lang) {
  if (lang === getLang()) return;
  setLang(lang);
  try { localStorage.setItem("lang", lang); } catch { /* storage unavailable: the link still carries ?lang */ }
  applyStaticText();
  if (current) render(current.data);  // keeps the open tab and any price
  updateUrl();
}

function initialLang(params) {
  if (params.get("lang") && dictionaries[params.get("lang")]) return params.get("lang");
  try { const saved = localStorage.getItem("lang"); if (saved && dictionaries[saved]) return saved; } catch { /* ignore */ }
  return detectLang(navigator.languages || [navigator.language]);
}

// ---------- events ----------
// a price belongs to one ticker, so clear it when the user looks up another
// "/" jumps to the search box from anywhere (unless the user is typing in a field)
document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.target.closest("input, textarea, select")) return;
  e.preventDefault();
  $("ticker").focus();
  $("ticker").select();
});
$("form").addEventListener("submit", (e) => { e.preventDefault(); $("price").value = ""; run($("ticker").value); });
document.querySelectorAll(".chip[data-t]").forEach((b) => b.addEventListener("click", () => { $("price").value = ""; run(b.dataset.t); }));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  chartsStale = true;  // chart colours come from the theme
  if (current && activeTab === "charts") showTab("charts");
});

$("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[role=tab]");
  if (tab) showTab(tab.dataset.tab);
});
$("tabs").addEventListener("scroll", updateTabFades, { passive: true });
addEventListener("resize", updateTabFades);
$("tabs").addEventListener("keydown", (e) => {
  const visible = TABS.filter((tab) => !$(`tab-${tab}`).hidden);
  const i = visible.indexOf(activeTab);
  const next = { ArrowRight: visible[(i + 1) % visible.length], ArrowLeft: visible[(i - 1 + visible.length) % visible.length],
                 Home: visible[0], End: visible[visible.length - 1] }[e.key];
  if (next) { e.preventDefault(); showTab(next, { focus: true }); }
});
// Guide cards: before a search they load an example company on that tab; afterwards they just open it.
const EXAMPLE_TICKER = "AAPL";
$("guide").addEventListener("click", async (e) => {
  const card = e.target.closest(".guide-item[data-tab]");
  if (!card) return;
  if (current) return openTabAndScroll(card.dataset.tab);
  activeTab = card.dataset.tab;
  $("price").value = "";
  await run(EXAMPLE_TICKER);
  if (current) $("tabs").scrollIntoView({ behavior: "smooth", block: "start" });
});

// Glance lines and panel Previous/Next buttons open a tab.
for (const el of [$("glance"), $("result")]) {
  el.addEventListener("click", (e) => {
    const target = e.target.closest("#glance [data-tab], .panel-nav [data-tab]");
    if (!target || !current || $(`tab-${target.dataset.tab}`).hidden) return;
    e.stopPropagation();
    openTabAndScroll(target.dataset.tab);
  });
}

$("historyFilters").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-f]");
  if (!b) return;
  historyFilter = b.dataset.f; historyExpanded = false; renderHistory();
});
$("historyMore").addEventListener("click", () => { historyExpanded = !historyExpanded; renderHistory(); });

let priceTimer;
$("price").addEventListener("input", () => { clearTimeout(priceTimer); priceTimer = setTimeout(() => { renderValue(); updateUrl(); }, 250); });

const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
document.querySelectorAll(".lang-switch [data-lang]").forEach((b) => b.addEventListener("click", () => switchLang(b.dataset.lang)));
if (params.get("p")) $("price").value = params.get("p");
if (params.get("t")) run(params.get("t"));
