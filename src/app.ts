// Page wiring: search, URL state, events, and putting each view on the page.
// All analysis lives in the other modules; this file is the only one that touches the DOM.
import { analyze } from "./flags.ts";
import { valueChecks } from "./valuation.ts";
import { growthView } from "./growth.ts";
import { historyView } from "./history.ts";
import { insiderView } from "./insiders.ts";
import { renderCharts } from "./charts.ts";
import { checklist, checklistScore, dataTable, filingProblems, flagCounts, flagsList, footnote, glanceView, industryView, newsUrl, rdTile, trendTile, ttmView, valueView } from "./views.ts";
import { fixed, money, perShare } from "./format.ts";
import { getLang, getLocale, setLang, t } from "./i18n.ts";
import { chipList, clearRecent, loadRecent, rememberRecent } from "./recent.ts";
import { $, $$, API_VERSION, applyStaticText, bindSlashShortcut, compareHref, fetchFinancials, fetchInsiders, initialLang, portfolioHref, targetOf, useLang } from "./page.ts";
import { resolveTicker, searchCompanies } from "./company-search.ts";
import { durableChecks } from "./durable.ts";
import { termsHtml } from "./terms.ts";
import { companyRows, downloadCsv } from "./csv.ts";
import { industryComparison } from "./industry.ts";
import { quoteOfTheDay } from "./quotes.ts";
import type { Analysis } from "./flags.ts";
import type { IndustryData } from "./industry.ts";
import type { Financials, Insiders } from "./types.ts";

/** The company on screen; insider trades are added once their tab has loaded them. */
type Company = Financials & { insiders?: Insiders | null; insidersState?: "loading" | "done" | "error" };
import { bindSuggest } from "./suggest.ts";
import { shareHtml, siteUrl } from "./share.ts";

let current: { data: Company; result: Analysis } | null = null;
let failed: string | null = null;   // the ticker of a lookup that failed (its error is showing), so the address and language keep it
let historyFilter = "all", historyExpanded = false;
const TABS = ["overview", "flags", "history", "insiders", "value", "durable", "charts", "data"];
let activeTab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
let chartsStale = true;  // charts are drawn when their tab is first shown (a hidden canvas has no size)

function render(d: Company) {
  const s = d.series, cur = d.currency;
  const r = analyze(d);
  current = { data: d, result: r };

  $("coName").textContent = `${d.name} (${d.ticker})`;
  const industry = d.secHistory && d.secHistory.industry;
  $("coMeta").textContent = (industry ? industry + " · " : "")
    + t("company.meta", { from: d.years[0], to: d.years[d.years.length - 1], cur, cik: d.cik });
  $<HTMLAnchorElement>("secLink").href = d.secUrl ?? "";
  $<HTMLAnchorElement>("newsLink").href = newsUrl(d.ticker);
  const what = t("share.company", { name: d.name, ticker: d.ticker });
  $("shareRow").innerHTML = shareHtml({ url: siteUrl(`/stock/${encodeURIComponent(d.ticker)}`, getLang()), text: what, subject: t("share.subject", { what: `${d.name} (${d.ticker})` }) });
  $<HTMLAnchorElement>("compareLink").href = compareHref(d.ticker);
  $<HTMLAnchorElement>("portfolioAddLink").href = portfolioHref(d.ticker);
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
  $<HTMLDetailsElement>("guide").open = false;  // keep the results in view; the guide stays one click away
  $("guide").classList.add("has-results");  // guide cards now open their tab
  $("guide").querySelector(".guide-title")!.textContent = t("guide.titleAfter");
  // A company page arrives with a fuller title for its company (backend/pages.py): keep it for that company.
  const pageCompany = stockPathTicker && decodeURIComponent(stockPathTicker).toUpperCase().replace(/[./]/g, "-");
  document.title = pageCompany === d.ticker.toUpperCase().replace(/[./]/g, "-") ? pageTitle : `${d.ticker} · 10-Year Stock Value Analysis`;
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
    const i = visible.indexOf(nav.dataset.for ?? "");
    const prev = visible[i - 1], next = visible[i + 1];
    nav.innerHTML = (prev ? `<button type="button" class="prev" data-tab="${prev}">${t("nav.prev", { name: t(`tab.${prev}`) })}</button>` : "")
      + (next ? `<button type="button" class="next" data-tab="${next}">${t("nav.next", { name: t(`tab.${next}`) })}</button>` : "");
  });
}

function openTabAndScroll(name: string) {
  showTab(name);
  $("tabs").scrollIntoView({ behavior: "smooth", block: "start" });
}

// On narrow screens the tab bar scrolls sideways: keep the active tab in view and fade the edge
// that has more tabs beyond it.
function revealTab(tab: HTMLElement) {
  const bar = $("tabs");
  if (bar.scrollWidth > bar.clientWidth) bar.scrollLeft = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
  updateTabFades();
}
function updateTabFades() {
  const bar = $("tabs");
  bar.classList.toggle("more-left", bar.scrollLeft > 4);
  bar.classList.toggle("more-right", bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4);
}

function showTab(name: string, { focus = false } = {}) {
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
  const h = current?.data.secHistory;
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
  if (current && !current.data.insidersState) loadInsiders();
}

function loadInsiders() {
  if (!current) return;
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
let industryData: IndustryData | null = null, industryLoading: Promise<IndustryData | null> | null = null;
function loadIndustry() {
  industryLoading ??= fetch("data/industry.json").then((res): Promise<IndustryData> | null => (res.ok ? res.json() : null))
    .catch((): null => null).then((data) => (industryData = data));
  return industryLoading;
}
function renderIndustry() {
  if (!current) return;
  $("industry").innerHTML = industryView(current.data, industryComparison(current.data, current.result.financial, industryData));
}

// The visitor's own value-estimate assumptions (percent in the boxes, fractions here); an empty box keeps the default
function assumptions() {
  const read = (id: string) => { const v = parseFloat($<HTMLInputElement>(id).value); return Number.isFinite(v) ? v / 100 : undefined; };
  return { g: read("aGrowth"), disc: read("aDisc"), tg: read("aTerm") };
}
const ASSUME_IDS = ["aGrowth", "aDisc", "aTerm"];
function resetAssumptions() { for (const id of ASSUME_IDS) $<HTMLInputElement>(id).value = ""; }

function renderValue() {
  if (!current) return;
  const d = current.data;
  const price = parseFloat($<HTMLInputElement>("price").value) || null;
  const checks = valueChecks(d, price, current.result, assumptions());
  // empty boxes use the defaults, shown in grey
  $<HTMLInputElement>("aGrowth").placeholder = fixed(checks.gAuto * 100, 1); $<HTMLInputElement>("aDisc").placeholder = "10"; $<HTMLInputElement>("aTerm").placeholder = "3";
  const view = valueView(d, price, checks);
  $("glance").innerHTML = glanceView(d, current.result, checks);
  $("valueTiles").innerHTML = view.tiles;
  $("priceTiles").innerHTML = view.priceTiles;
  $("grahamChecks").innerHTML = view.graham; $("grahamScore").innerHTML = view.grahamScore;
  $("buffettChecks").innerHTML = view.buffett; $("buffettScore").innerHTML = view.buffettScore;
  $("lynchChecks").innerHTML = view.lynch; $("lynchScore").innerHTML = view.lynchScore;
  $("piotroskiChecks").innerHTML = view.piotroski; $("piotroskiScore").innerHTML = view.piotroskiScore;
  $("priceHint").textContent = view.priceHint;
  $("priceLinks").innerHTML = view.links;
  $("valueNote").textContent = view.note;
}

async function run(ticker: string) {
  ticker = ticker.trim().toUpperCase();
  if (!ticker) return;
  $("searchHint").hidden = true;
  $<HTMLInputElement>("ticker").value = ticker;
  $("error").classList.add("hidden");
  $("loading").classList.remove("hidden");
  $<HTMLButtonElement>("go").disabled = true;
  try {
    render(await fetchFinancials(ticker));
    failed = null;
    rememberRecent(current!.data.ticker);  // (render set it)  // only companies that opened, under the ticker SEC knows them by
    drawChips();
  } catch (e) {
    // Forget the previous company: its results are hidden, and the address, language switch and price box
    // must not bring them back while the error shows.
    current = null;
    failed = ticker;
    $("result").classList.add("hidden");
    $("error").textContent = (e as Error).message;
    $("error").classList.remove("hidden");
  } finally {
    updateUrl();
    $("loading").classList.add("hidden");
    syncGo();
  }
}

// A company page (/stock/KO, served with that company's title and share preview by backend/pages.py) keeps that form
// of address for the companies looked up on it; the start page uses ?t=KO, as before.
const STOCK_PATH = /^\/stock\/([^/?#]+)\/?$/;
const stockPathTicker = (location.pathname.match(STOCK_PATH) || [])[1];
const pageTitle = document.title;  // the company page's own title, from the server

function updateUrl() {
  const q = new URLSearchParams();
  const shown = current ? current.data.ticker : failed;  // after an error: reloading shows the same error, not the previous company
  if (shown && !stockPathTicker) q.set("t", shown);
  const p = parseFloat($<HTMLInputElement>("price").value);
  if (current && p > 0) q.set("p", String(p));
  if (getLang() !== "en") q.set("lang", getLang());
  const hash = current && activeTab !== "overview" ? `#${activeTab}` : "";
  const path = stockPathTicker ? (shown ? `/stock/${encodeURIComponent(shown)}` : "/") : location.pathname;
  history.replaceState(null, "", `${path}${q.toString() ? `?${q}` : ""}${hash}`);
}

// ---------- language ----------
// The start page's quote for today and its author, in the page language (Spanish uses «» like the rest of the Spanish text)
function labelSuggestions() { $("suggest").setAttribute("aria-label", t("search.suggestions")); }

function showQuote() {
  const q = quoteOfTheDay();
  $("dailyQuote").textContent = getLang() === "es" ? `«${q.es}»` : `“${q.en}”`;
  $("quoteAuthor").textContent = q.author;
}

// The chips under the search box: this visitor's recent companies (with Clear), or examples before there are any
function drawChips() {
  const { recent, tickers } = chipList(loadRecent());
  $("tryChips").innerHTML = `<span>${t(recent ? "chips.recent" : "chips.try")}</span>`
    + tickers.map((tk) => `<button class="chip" type="button" data-t="${tk}">${tk}</button>`).join("")
    + (recent ? `<button class="chip chip-clear" type="button" id="clearRecent" data-testid="clear-recent">${t("chips.clear")}</button>` : "");
}

function switchLang(lang: string): void {
  if (!useLang(lang)) return;
  showQuote();
  drawChips();
  labelSuggestions();
  if (current) render(current.data);  // re-renders in the new language, keeping the open tab and any price
  else if (failed) return void run(failed);  // shows the error again, in the new language
  updateUrl();
}

// ---------- events ----------
// a price belongs to one ticker, so clear it when the user looks up another
// "/" jumps to the search box from anywhere (unless the user is typing in a field)
$("dataCsv").addEventListener("click", () => {
  if (current) downloadCsv(`${current.data.ticker}-10-year-figures.csv`, companyRows(current.data, current.result));
});
bindSlashShortcut("ticker");
// Analyze starts disabled in the HTML (an early submit would just reload the page). Once the script runs it stays
// ready: a greyed-out button looked broken, so an empty box gets a hint instead.
function syncGo() { $<HTMLButtonElement>("go").disabled = false; }
syncGo();
$("ticker").addEventListener("input", () => { $("searchHint").hidden = true; });
$("insiders").addEventListener("click", (e) => {
  if (targetOf(e).closest("#insidersRetry")) loadInsiders();
});
// Suggestions under the search box: picking one looks it up straight away
const suggest = bindSuggest(($("ticker") as HTMLInputElement), $("suggest"), {
  fetchResults: (q) => searchCompanies(q, API_VERSION),
  onPick: (ticker) => { $<HTMLInputElement>("price").value = ""; resetAssumptions(); run(ticker); },
});
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  suggest.close();
  if (!$<HTMLInputElement>("ticker").value.trim()) {
    $("searchHint").hidden = false;
    $("ticker").focus();
    return;
  }
  $<HTMLInputElement>("price").value = "";
  resetAssumptions();  // a new company starts from its own defaults
  run(await resolveTicker($<HTMLInputElement>("ticker").value, API_VERSION));  // a company name becomes its ticker
});
$("tryChips").addEventListener("click", (e) => {
  const chip = (targetOf(e).closest(".chip[data-t]") as HTMLElement | null);
  if (chip) { $<HTMLInputElement>("price").value = ""; resetAssumptions(); run(chip.dataset.t || ""); return; }
  if (targetOf(e).closest("#clearRecent")) { clearRecent(); drawChips(); $("ticker").focus(); }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  chartsStale = true;  // chart colours come from the theme
  if (current && activeTab === "charts") showTab("charts");
});

$("tabs").addEventListener("click", (e) => {
  const tab = (targetOf(e).closest("[role=tab]") as HTMLElement | null);
  if (tab) showTab(tab.dataset.tab ?? "overview");
});
$("tabs").addEventListener("scroll", updateTabFades, { passive: true });
addEventListener("resize", updateTabFades);
$("tabs").addEventListener("keydown", (e) => {
  const visible = TABS.filter((tab) => !$(`tab-${tab}`).hidden);
  const i = visible.indexOf(activeTab);
  const next = ({ ArrowRight: visible[(i + 1) % visible.length], ArrowLeft: visible[(i - 1 + visible.length) % visible.length],
                 Home: visible[0], End: visible[visible.length - 1] } as Record<string, string | undefined>)[e.key];
  if (next) { e.preventDefault(); showTab(next, { focus: true }); }
});
// Guide cards: before a search they load an example company on that tab; afterwards they just open it.
const EXAMPLE_TICKER = "AAPL";
$("guide").addEventListener("click", async (e) => {
  const card = (targetOf(e).closest(".guide-item[data-tab]") as HTMLElement | null);
  if (!card) return;
  const tab = card.dataset.tab ?? "overview";
  if (current) return openTabAndScroll(tab);
  activeTab = tab;
  $<HTMLInputElement>("price").value = "";
  resetAssumptions();
  await run(EXAMPLE_TICKER);
  if (current) $("tabs").scrollIntoView({ behavior: "smooth", block: "start" });
});

// Glance lines and panel Previous/Next buttons open a tab.
for (const el of [$("glance"), $("result")]) {
  el.addEventListener("click", (e) => {
    const target = (targetOf(e).closest("#glance [data-tab], .panel-nav [data-tab]") as HTMLElement | null);
    if (!target || !current || $(`tab-${target.dataset.tab}`).hidden) return;
    e.stopPropagation();
    openTabAndScroll(target.dataset.tab ?? "overview");
  });
}

$("historyFilters").addEventListener("click", (e) => {
  const b = (targetOf(e).closest("button[data-f]") as HTMLElement | null);
  if (!b) return;
  historyFilter = b.dataset.f ?? "all"; historyExpanded = false; renderHistory();
});
$("historyMore").addEventListener("click", () => { historyExpanded = !historyExpanded; renderHistory(); });

let priceTimer = 0;
$("price").addEventListener("input", () => { clearTimeout(priceTimer); priceTimer = window.setTimeout(() => { renderValue(); updateUrl(); }, 250); });
for (const id of ASSUME_IDS) $(id).addEventListener("input", () => { clearTimeout(priceTimer); priceTimer = window.setTimeout(renderValue, 250); });
$("aReset").addEventListener("click", () => { resetAssumptions(); renderValue(); });

const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
drawChips();
showQuote();
labelSuggestions();
$$(".lang-switch [data-lang]").forEach((b) => b.addEventListener("click", () => switchLang(b.dataset.lang ?? "en")));
const startPrice = params.get("p");
if (startPrice) $<HTMLInputElement>("price").value = startPrice;
const startTicker = params.get("t") || (stockPathTicker && decodeURIComponent(stockPathTicker));
if (startTicker) run(startTicker);
