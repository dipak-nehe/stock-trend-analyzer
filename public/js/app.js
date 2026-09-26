// Page wiring: search, URL state, events, and putting each view on the page.
// All analysis lives in the other modules; this file is the only one that touches the DOM.
import { analyze } from "./flags.js";
import { valueChecks } from "./valuation.js";
import { growthView } from "./growth.js";
import { historyView } from "./history.js";
import { renderCharts } from "./charts.js";
import { dataTable, filingProblems, flagCounts, flagsList, footnote, glanceView, trendTile, valueView } from "./views.js";
import { money, perShare } from "./format.js";

const $ = (id) => document.getElementById(id);
// Bump when the API response format changes, so no cache serves an older shape to newer code.
const API_VERSION = 4;

let current = null;  // { data: API response, result: analyze(data) }
let historyFilter = "all", historyExpanded = false;
const TABS = ["overview", "flags", "history", "value", "charts", "data"];
const TAB_NAMES = { overview: "Overview", flags: "Red flags", history: "SEC history", value: "Graham & Buffett", charts: "Charts", data: "Data" };
let activeTab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
let chartsStale = true;  // charts are drawn when their tab is first shown (a hidden canvas has no size)

function render(d) {
  const s = d.series, cur = d.currency;
  const r = analyze(d);
  current = { data: d, result: r };

  $("coName").textContent = `${d.name} (${d.ticker})`;
  const industry = d.secHistory && d.secHistory.industry;
  $("coMeta").textContent = `${industry ? industry + " · " : ""}Fiscal years ${d.years[0]}–${d.years[d.years.length - 1]} · reported in ${cur} · CIK ${d.cik}`;
  $("secLink").href = d.secUrl;

  $("tiles").innerHTML = [
    trendTile("Revenue", s.revenue, money, cur),
    trendTile("Net income (earnings)", s.netIncome, money, cur),
    trendTile("Earnings per share", s.eps, perShare, cur),
    trendTile("Dividend per share", s.dps, perShare, cur),
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
  $("guide").querySelector(".guide-title").textContent = "How to read these results";
  historyFilter = "all"; historyExpanded = false;
  renderHistory();
  renderValue();
  chartsStale = true;
  showTab(activeTab);
}

// "← Previous / Next →" at the bottom of each tab, skipping tabs hidden for this company.
function renderPanelNav() {
  const visible = TABS.filter((t) => !$(`tab-${t}`).hidden);
  document.querySelectorAll(".panel-nav").forEach((nav) => {
    const i = visible.indexOf(nav.dataset.for);
    const prev = visible[i - 1], next = visible[i + 1];
    nav.innerHTML = (prev ? `<button type="button" class="prev" data-tab="${prev}">← ${TAB_NAMES[prev]}</button>` : "")
      + (next ? `<button type="button" class="next" data-tab="${next}">Next: ${TAB_NAMES[next]} →</button>` : "");
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
  for (const t of TABS) {
    const selected = t === name;
    $(`tab-${t}`).setAttribute("aria-selected", selected);
    $(`tab-${t}`).tabIndex = selected ? 0 : -1;
    $(`panel-${t}`).hidden = !selected;
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
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
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
  if (!current) return;
  const p = parseFloat($("price").value);
  const hash = activeTab === "overview" ? "" : `#${activeTab}`;
  history.replaceState(null, "", `?t=${encodeURIComponent(current.data.ticker)}${p > 0 ? `&p=${p}` : ""}${hash}`);
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
  const visible = TABS.filter((t) => !$(`tab-${t}`).hidden);
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
if (params.get("p")) $("price").value = params.get("p");
if (params.get("t")) run(params.get("t"));
