// Page wiring: search, URL state, events, and putting each view on the page.
// All analysis lives in the other modules; this file is the only one that touches the DOM.
import { analyze } from "./flags.js";
import { valueChecks } from "./valuation.js";
import { growthView } from "./growth.js";
import { historyView } from "./history.js";
import { renderCharts } from "./charts.js";
import { dataTable, flagCounts, flagsList, footnote, trendTile, valueView } from "./views.js";
import { money, perShare } from "./format.js";

const $ = (id) => document.getElementById(id);
// Bump when the API response format changes, so no cache serves an older shape to newer code.
const API_VERSION = 4;

let current = null;  // { data: API response, result: analyze(data) }
let historyFilter = "all", historyExpanded = false;

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

  $("result").classList.remove("hidden");
  historyFilter = "all"; historyExpanded = false;
  renderHistory();
  renderValue();
  renderCharts(d, r);
}

function renderHistory() {
  const h = current.data.secHistory;
  $("historySection").classList.toggle("hidden", !h);
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
  const view = valueView(d, price, valueChecks(d, price, current.result));
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
  history.replaceState(null, "", `?t=${encodeURIComponent(current.data.ticker)}${p > 0 ? `&p=${p}` : ""}`);
}

// ---------- events ----------
// a price belongs to one ticker, so clear it when the user looks up another
$("form").addEventListener("submit", (e) => { e.preventDefault(); $("price").value = ""; run($("ticker").value); });
document.querySelectorAll(".chip[data-t]").forEach((b) => b.addEventListener("click", () => { $("price").value = ""; run(b.dataset.t); }));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => current && renderCharts(current.data, current.result));

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
