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

  $("result").classList.remove("hidden");
  $("guide").open = false;  // keep the results in view; the guide stays one click away
  historyFilter = "all"; historyExpanded = false;
  renderHistory();
  renderValue();
  chartsStale = true;
  showTab(activeTab);
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
$("tabs").addEventListener("keydown", (e) => {
  const visible = TABS.filter((t) => !$(`tab-${t}`).hidden);
  const i = visible.indexOf(activeTab);
  const next = { ArrowRight: visible[(i + 1) % visible.length], ArrowLeft: visible[(i - 1 + visible.length) % visible.length],
                 Home: visible[0], End: visible[visible.length - 1] }[e.key];
  if (next) { e.preventDefault(); showTab(next, { focus: true }); }
});
$("glance").addEventListener("click", (e) => {
  const row = e.target.closest("[data-tab]");
  if (!row) return;
  showTab(row.dataset.tab);
  $("tabs").scrollIntoView({ behavior: "smooth", block: "start" });
});

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
