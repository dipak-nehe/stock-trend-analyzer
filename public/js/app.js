// Page wiring: search, URL state, events, and putting each view on the page.
// All analysis lives in the other modules; this file is the only one that touches the DOM.
import { analyze } from "./flags.js";
import { valueChecks } from "./valuation.js";
import { growthView } from "./growth.js";
import { historyView } from "./history.js";
import { insiderView } from "./insiders.js";
import { renderCharts } from "./charts.js";
import { checklist, checklistScore, dataTable, filingProblems, flagCounts, flagsList, footnote, glanceView, industryView, rdTile, trendTile, ttmView, valueView } from "./views.js";
import { fixed, money, perShare } from "./format.js";
import { getLang, getLocale, setLang, t } from "./i18n.js";
import { $, $$, API_VERSION, applyStaticText, bindSlashShortcut, compareHref, fetchFinancials, fetchInsiders, initialLang, portfolioHref, targetOf, useLang } from "./page.js";
import { resolveTicker, searchCompanies } from "./company-search.js";
import { durableChecks } from "./durable.js";
import { termsHtml } from "./terms.js";
import { industryComparison } from "./industry.js";
import { quoteOfTheDay } from "./quotes.js";
import { bindSuggest } from "./suggest.js";

let current = null;  // { data: API response, result: analyze(data) }
let failed = null;   // the ticker of a lookup that failed (its error is showing), so the address and language keep it
let historyFilter = "all", historyExpanded = false;
const TABS = ["overview", "flags", "history", "insiders", "value", "durable", "charts", "data"];
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
  $("compareLink").href = compareHref(d.ticker);
  $("portfolioAddLink").href = portfolioHref(d.ticker);
  // When the data was fetched from SEC (results are stored and reused for up to a day)
  const asOf = d.dataAsOf ? new Date(d.dataAsOf).toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" }) : "";
  $("coAsOf").textContent = asOf ? t("company.asOf", { date: asOf }) : "";
  $("staleNote").hidden = !d.stale;
  $("staleNote").textContent = d.stale ? t("company.stale", { date: asOf }) : "";

  $("tiles").innerHTML = [
    trendTile(t("tile.revenue"), s.revenue, money, cur),
    trendTile(t("tile.netIncome"), s.netIncome, money, cur),
    trendTile(t("tile.eps"), s.eps, perShare, cur),
    trendTile(t("tile.dps"), s.dps, perShare, cur),
    rdTile(d),
  ].join("");
  $("ttm").innerHTML = ttmView(d);
  const durable = durableChecks(d, r);
  $("durableChecks").innerHTML = checklist(durable); $("durableScore").innerHTML = checklistScore(durable);
  $("durTermsList").innerHTML = termsHtml();
  renderIndustry();
  if (!industryData) loadIndustry().then(renderIndustry);
  $("score").innerHTML = flagCounts(r.flags);
  $("flags").innerHTML = flagsList(r.flags);
  $("table").innerHTML = dataTable(d, r);

  const growth = growthView(d, r);
  $("growthTable").innerHTML = growth.table;
  $("growthIntro").textContent = growth.intro;
  $("note").textContent = footnote(d);

  const crit = r.flags.filter((f) => f.sev === "critical").length;
  $("flagsBadge").textContent = crit ? String(crit) : "";
  const problems = filingProblems(d.secHistory);
  $("historyBadge").textContent = problems && problems.sev === "critical" ? String(problems.total) : "";
  $("tab-history").hidden = !d.secHistory;
  if (!d.secHistory && activeTab === "history") activeTab = "overview";

  renderPanelNav();
  $("result").classList.remove("hidden");
  $("quotes").hidden = true;  // start-page quotes make way for the results
  $("guide").open = false;  // keep the results in view; the guide stays one click away
  $("guide").classList.add("has-results");  // guide cards now open their tab
  $("guide").querySelector(".guide-title").textContent = t("guide.titleAfter");
  document.title = `${d.ticker} · 10-Year Stock Value Analysis`;
  historyFilter = "all"; historyExpanded = false;
  renderHistory();
  $("insiders").innerHTML = insiderView(d.insiders, d.cik, d.insidersState);
  renderValue();
  chartsStale = true;
  showTab(activeTab);
}

// "← Previous / Next →" at the bottom of each tab, skipping tabs hidden for this company.
function renderPanelNav() {
  const visible = TABS.filter((tab) => !$(`tab-${tab}`).hidden);
  $$(".panel-nav").forEach((nav) => {
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
    $(`tab-${tab}`).setAttribute("aria-selected", String(selected));
    $(`tab-${tab}`).tabIndex = selected ? 0 : -1;
    $(`panel-${tab}`).hidden = !selected;
  }
  if (focus) $(`tab-${name}`).focus();
  revealTab($(`tab-${name}`));
  if (name === "charts" && chartsStale && current) {
    renderCharts(current.data, current.result);
    chartsStale = false;
  }
  if (name === "insiders" && current) ensureInsiders();
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

// Insider trades load only when the Insiders tab is opened (reading a company's Form 4s the first time takes
// several seconds): the tab says "Loading…" until they arrive. An answer for a company that's no longer on screen
// is ignored.
function ensureInsiders() {
  // Only the first time: after a failure the tab shows "Try again" (redrawing it mustn't start a retry loop).
  if (!current.data.insidersState) loadInsiders();
}

function loadInsiders() {
  const d = current.data;
  d.insidersState = "loading";
  render(d);
  fetchInsiders(d.ticker).then(
    (insiders) => { d.insiders = insiders; d.insidersState = "done"; },
    () => { d.insidersState = "error"; },
  ).finally(() => { if (current && current.data === d) render(d); });
}

// Typical ratios per industry (data/industry.json, rebuilt monthly), loaded once the first time a company is shown;
// if it can't be loaded the card is simply left out.
let industryData = null, industryLoading = null;
function loadIndustry() {
  industryLoading ??= fetch("data/industry.json").then((res) => (res.ok ? res.json() : null)).catch(() => null)
    .then((data) => (industryData = data));
  return industryLoading;
}
function renderIndustry() {
  if (!current) return;
  $("industry").innerHTML = industryView(current.data, industryComparison(current.data, current.result.financial, industryData));
}

// The visitor's own value-estimate assumptions (percent in the boxes, fractions here); an empty box keeps the default
function assumptions() {
  const read = (id) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v / 100 : undefined; };
  return { g: read("aGrowth"), disc: read("aDisc"), tg: read("aTerm") };
}
const ASSUME_IDS = ["aGrowth", "aDisc", "aTerm"];
function resetAssumptions() { for (const id of ASSUME_IDS) $(id).value = ""; }

function renderValue() {
  if (!current) return;
  const d = current.data;
  const price = parseFloat($("price").value) || null;
  const checks = valueChecks(d, price, current.result, assumptions());
  // empty boxes use the defaults, shown in grey
  $("aGrowth").placeholder = fixed(checks.gAuto * 100, 1); $("aDisc").placeholder = "10"; $("aTerm").placeholder = "3";
  const view = valueView(d, price, checks);
  $("glance").innerHTML = glanceView(d, current.result, checks);
  $("valueTiles").innerHTML = view.tiles;
  $("grahamChecks").innerHTML = view.graham; $("grahamScore").innerHTML = view.grahamScore;
  $("buffettChecks").innerHTML = view.buffett; $("buffettScore").innerHTML = view.buffettScore;
  $("lynchChecks").innerHTML = view.lynch; $("lynchScore").innerHTML = view.lynchScore;
  $("piotroskiChecks").innerHTML = view.piotroski; $("piotroskiScore").innerHTML = view.piotroskiScore;
  $("priceHint").textContent = view.priceHint;
  $("priceLinks").innerHTML = view.links;
  $("valueNote").textContent = view.note;
}

async function run(ticker) {
  ticker = ticker.trim().toUpperCase();
  if (!ticker) return;
  $("searchHint").hidden = true;
  $("ticker").value = ticker;
  $("homeBtn").hidden = false;  // after any lookup (result or error) Home leads back to the start page
  $("error").classList.add("hidden");
  $("loading").classList.remove("hidden");
  $("go").disabled = true;
  try {
    render(await fetchFinancials(ticker));
    failed = null;
  } catch (e) {
    // Forget the previous company: its results are hidden, and the address, language switch and price box
    // must not bring them back while the error shows.
    current = null;
    failed = ticker;
    $("result").classList.add("hidden");
    $("error").textContent = e.message;
    $("error").classList.remove("hidden");
  } finally {
    updateUrl();
    $("loading").classList.add("hidden");
    syncGo();
  }
}

function updateUrl() {
  const q = new URLSearchParams();
  if (current) q.set("t", current.data.ticker);
  else if (failed) q.set("t", failed); // reloading shows the same error, not the previous company
  const p = parseFloat($("price").value);
  if (current && p > 0) q.set("p", String(p));
  if (getLang() !== "en") q.set("lang", getLang());
  const hash = current && activeTab !== "overview" ? `#${activeTab}` : "";
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}${hash}`);
}

// ---------- language ----------
// The start page's Buffett quote for today, in the page language (Spanish uses «» like the rest of the Spanish text)
function labelSuggestions() { $("suggest").setAttribute("aria-label", t("search.suggestions")); }

function showQuote() {
  const q = quoteOfTheDay();
  $("dailyQuote").textContent = getLang() === "es" ? `«${q.es}»` : `“${q.en}”`;
}

function switchLang(lang) {
  if (!useLang(lang)) return;
  showQuote();
  labelSuggestions();
  if (current) render(current.data);  // re-renders in the new language, keeping the open tab and any price
  else if (failed) return void run(failed);  // shows the error again, in the new language
  updateUrl();
}

// ---------- events ----------
// a price belongs to one ticker, so clear it when the user looks up another
// "/" jumps to the search box from anywhere (unless the user is typing in a field)
bindSlashShortcut("ticker");
// Analyze starts disabled in the HTML (an early submit would just reload the page). Once the script runs it stays
// ready: a greyed-out button looked broken, so an empty box gets a hint instead.
function syncGo() { $("go").disabled = false; }
syncGo();
$("ticker").addEventListener("input", () => { $("searchHint").hidden = true; });
$("insiders").addEventListener("click", (e) => {
  if (targetOf(e).closest("#insidersRetry")) loadInsiders();
});
// Suggestions under the search box: picking one looks it up straight away
const suggest = bindSuggest(/** @type {HTMLInputElement} */ ($("ticker")), $("suggest"), {
  fetchResults: (q) => searchCompanies(q, API_VERSION),
  onPick: (ticker) => { $("price").value = ""; resetAssumptions(); run(ticker); },
});
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  suggest.close();
  if (!$("ticker").value.trim()) {
    $("searchHint").hidden = false;
    $("ticker").focus();
    return;
  }
  $("price").value = "";
  resetAssumptions();  // a new company starts from its own defaults
  run(await resolveTicker($("ticker").value, API_VERSION));  // a company name becomes its ticker
});
$$(".chip[data-t]").forEach((b) => b.addEventListener("click", () => { $("price").value = ""; resetAssumptions(); run(b.dataset.t); }));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  chartsStale = true;  // chart colours come from the theme
  if (current && activeTab === "charts") showTab("charts");
});

$("tabs").addEventListener("click", (e) => {
  const tab = /** @type {HTMLElement | null} */ (targetOf(e).closest("[role=tab]"));
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
  const card = /** @type {HTMLElement | null} */ (targetOf(e).closest(".guide-item[data-tab]"));
  if (!card) return;
  if (current) return openTabAndScroll(card.dataset.tab);
  activeTab = card.dataset.tab;
  $("price").value = "";
  resetAssumptions();
  await run(EXAMPLE_TICKER);
  if (current) $("tabs").scrollIntoView({ behavior: "smooth", block: "start" });
});

// Glance lines and panel Previous/Next buttons open a tab.
for (const el of [$("glance"), $("result")]) {
  el.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement | null} */ (targetOf(e).closest("#glance [data-tab], .panel-nav [data-tab]"));
    if (!target || !current || $(`tab-${target.dataset.tab}`).hidden) return;
    e.stopPropagation();
    openTabAndScroll(target.dataset.tab);
  });
}

$("historyFilters").addEventListener("click", (e) => {
  const b = /** @type {HTMLElement | null} */ (targetOf(e).closest("button[data-f]"));
  if (!b) return;
  historyFilter = b.dataset.f; historyExpanded = false; renderHistory();
});
$("historyMore").addEventListener("click", () => { historyExpanded = !historyExpanded; renderHistory(); });

let priceTimer;
$("price").addEventListener("input", () => { clearTimeout(priceTimer); priceTimer = setTimeout(() => { renderValue(); updateUrl(); }, 250); });
for (const id of ASSUME_IDS) $(id).addEventListener("input", () => { clearTimeout(priceTimer); priceTimer = setTimeout(renderValue, 250); });
$("aReset").addEventListener("click", () => { resetAssumptions(); renderValue(); });

const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
showQuote();
labelSuggestions();
$$(".lang-switch [data-lang]").forEach((b) => b.addEventListener("click", () => switchLang(b.dataset.lang)));
if (params.get("p")) $("price").value = params.get("p");
if (params.get("t")) run(params.get("t"));
