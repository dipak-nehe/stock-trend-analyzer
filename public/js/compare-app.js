// Compare page wiring: two ticker slots, URL state, and putting the comparison on the page.
// The comparison itself is built by compare.js from the same analysis the results page uses.
import { $, $$, API_VERSION, applyStaticText, bindSlashShortcut, enableWhenFilled, fetchFinancials, initialLang, useLang } from "./page.js";
import { resolveTicker, searchCompanies } from "./company-search.js";
import { bindSuggest } from "./suggest.js";
import { attention, caveats, checklistGrid, compareRows, glancePairs, indexedSeries, prepare } from "./compare.js";
import { getLang, getLocale, setLang, t } from "./i18n.js";
import { priceLinks } from "./views.js";

/** @type {{a: any, b: any}} API responses for the two slots */
const state = { a: null, b: null };
let charts = [];
const ICON = { pass: "✓", fail: "✗", na: "–", price: "$" };

const esc = (/** @type {string} */ s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const normalize = (/** @type {string} */ v) => v.trim().toUpperCase().replace(/[./]/g, "-");
const price = (/** @type {"a"|"b"} */ side) => parseFloat($(`price${side.toUpperCase()}`).value) || null;

/** Load one slot. @param {"a"|"b"} side @param {string} ticker */
async function load(side, ticker) {
  ticker = ticker.trim().toUpperCase();
  const other = state[side === "a" ? "b" : "a"];
  const status = $(`status${side.toUpperCase()}`);
  $(`ticker${side.toUpperCase()}`).value = ticker;
  syncButtons.forEach((sync) => sync()); // set in code: no input event
  if (!ticker) return;
  if (other && normalize(other.ticker) === normalize(ticker)) {
    status.textContent = t("cmp.app.sameTicker");
    status.className = "cmp-status error-text";
    return;
  }
  status.textContent = t("cmp.app.loading", { ticker });
  status.className = "cmp-status";
  try {
    state[side] = await fetchFinancials(ticker);
    status.textContent = `${state[side].name} (${state[side].ticker})`;
  } catch (e) {
    state[side] = null;
    status.textContent = /** @type {Error} */ (e).message;
    status.className = "cmp-status error-text";
  }
  render();
}

function render() {
  const { a, b } = state;
  $("backLink").href = `index.html?${new URLSearchParams({ ...(a ? { t: a.ticker } : {}), ...(getLang() !== "en" ? { lang: getLang() } : {}) })}`;
  updateUrl();
  const ready = Boolean(a && b);
  $("cmpResult").hidden = !ready;
  $("cmpEmpty").hidden = ready;
  if (!ready) return;

  const A = prepare(a, price("a")), B = prepare(b, price("b"));
  document.title = t("cmp.app.title", { a: a.ticker, b: b.ticker });
  const head = `<thead><tr><th scope="col">${t("cmp.app.measure")}</th><th scope="col">${esc(a.ticker)}</th><th scope="col">${esc(b.ticker)}</th></tr></thead>`;

  $("cmpCaveats").innerHTML = caveats(a, b).map((n) => `<p class="stale-note">${esc(n)}</p>`).join("");

  const asOf = (/** @type {any} */ d) => (d.dataAsOf ? new Date(d.dataAsOf).toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" }) : "");
  $("cmpCards").innerHTML = [a, b].map((d) => `<div class="card cmp-card" data-testid="company-card">
      <h2>${esc(d.name)} (${esc(d.ticker)})</h2>
      <div class="meta">${esc([d.secHistory && d.secHistory.industry, t("company.meta", { from: d.years[0], to: d.years[d.years.length - 1], cur: d.currency, cik: d.cik })].filter(Boolean).join(" · "))}</div>
      <div class="meta">${esc(asOf(d) ? t("company.asOf", { date: asOf(d) }) : "")}</div>
      <a href="index.html?${new URLSearchParams({ t: d.ticker, ...(getLang() !== "en" ? { lang: getLang() } : {}) })}">${t("cmp.app.openFull")}</a>
    </div>`).join("");

  const glanceCell = (/** @type {any} */ row) => (row
    ? `<td class="glance-cell ${row.sev}"><span class="st" aria-hidden="true">${row.icon}</span> ${esc(row.say)}</td>`
    : `<td class="muted">${t("cmp.na")}</td>`);
  $("cmpGlance").innerHTML = head + "<tbody>" + glancePairs(A, B).map((p) =>
    `<tr><th scope="row">${esc(p.what)}</th>${glanceCell(p.a)}${glanceCell(p.b)}</tr>`).join("") + "</tbody>";

  const fav = (/** @type {boolean} */ on) => (on ? ` <span class="fav-dot" aria-hidden="true">●</span><span class="sr-only">${t("cmp.app.more")}</span>` : "");
  let group = "";
  $("cmpTable").innerHTML = head + "<tbody>" + compareRows(A, B).map((r) => {
    const heading = r.group !== group ? `<tr class="group"><th colspan="3">${t(`cmp.group.${(group = r.group)}`)}</th></tr>` : "";
    return heading + `<tr><th scope="row">${esc(r.label)}</th><td class="${r.better === "a" ? "fav" : ""}">${esc(r.a)}${fav(r.better === "a")}</td>`
      + `<td class="${r.better === "b" ? "fav" : ""}">${esc(r.b)}${fav(r.better === "b")}</td></tr>`;
  }).join("") + "</tbody>";
  $("priceALabel").textContent = a.ticker;
  $("priceBLabel").textContent = b.ticker;
  $("linksA").innerHTML = priceLinks(a.ticker);
  $("linksB").innerHTML = priceLinks(b.ticker);

  const attn = (/** @type {any} */ ctx) => {
    const list = attention(ctx);
    return `<div class="card"><h3>${esc(ctx.d.ticker)} <span class="count">${list.length}</span></h3>${list.length
      ? `<ul class="cmp-flags">${list.map((f) => `<li class="${f.sev}"><span class="sev">${t(`flags.sev.${f.sev}`)}</span> ${esc(f.title)}<div class="why">${esc(f.why)}</div></li>`).join("")}</ul>`
      : `<p class="muted">${t("cmp.app.noneAttention")}</p>`}</div>`;
  };
  $("cmpAttention").innerHTML = attn(A) + attn(B);

  let who = "";
  $("cmpGrid").innerHTML = head + "<tbody>" + checklistGrid(A, B).map((r) => {
    const heading = r.who !== who ? `<tr class="group"><th colspan="3">${(who = r.who) === "graham" ? "Benjamin Graham" : "Warren Buffett"}</th></tr>` : "";
    const cell = (/** @type {string} */ st) => `<td class="check-cell ${st}"><span class="st" aria-hidden="true">${ICON[st]}</span> ${t(`vv.tag.${st}`)}</td>`;
    return heading + `<tr><th scope="row">${esc(r.name)}</th>${cell(r.a)}${cell(r.b)}</tr>`;
  }).join("") + "</tbody>";

  renderGrowth();
}

function renderGrowth() {
  charts.forEach((c) => c.destroy());
  charts = [];
  const { a, b } = state;
  const css = (/** @type {string} */ name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const series = { revenue: indexedSeries(a, b, "revenue"), eps: indexedSeries(a, b, "eps") };
  const first = series.revenue || series.eps;
  $("growthTitle").textContent = first ? t("cmp.app.growthTitle", { year: first.years[0] }) : t("cmp.app.growthTitleNone");
  for (const [key, canvasId, noteId] of [["revenue", "cmpRevenue", "revenueNote"], ["eps", "cmpEps", "epsNote"]]) {
    const s = series[key];
    $(noteId).textContent = s ? t("cmp.app.indexNote", { year: s.years[0] }) : t("cmp.app.noGrowth");
    if (!s) continue;
    const line = (/** @type {string} */ label, /** @type {(number|null)[]} */ data, /** @type {string} */ color) =>
      ({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 3, tension: 0.2, spanGaps: true });
    charts.push(new Chart(/** @type {HTMLCanvasElement} */ ($(canvasId)), {
      type: "line",
      data: { labels: s.years.map(String), datasets: [line(a.ticker, s.a, css("--series-1")), line(b.ticker, s.b, css("--series-2"))] },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: { legend: { labels: { color: css("--text-2") } },
                   tooltip: { callbacks: { label: (/** @type {any} */ it) => `${it.dataset.label}: ${it.raw == null ? "–" : Math.round(it.raw)}` } } },
        scales: { x: { grid: { display: false }, ticks: { color: css("--muted") } },
                  y: { grid: { color: css("--grid") }, ticks: { color: css("--muted") } } },
      },
    }));
  }
}

function updateUrl() {
  const q = new URLSearchParams();
  if (state.a) q.set("a", state.a.ticker);
  if (state.b) q.set("b", state.b.ticker);
  if (price("a")) q.set("pa", String(price("a")));
  if (price("b")) q.set("pb", String(price("b")));
  if (getLang() !== "en") q.set("lang", getLang());
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}`);
}

// ---------- events ----------
// Company suggestions under each box (as on the results page): picking one loads it, and a typed name becomes its ticker
const suggest = Object.fromEntries((/** @type {("a"|"b")[]} */ (["a", "b"])).map((side) => {
  const S = side.toUpperCase();
  return [side, bindSuggest(/** @type {HTMLInputElement} */ ($(`ticker${S}`)), $(`suggest${S}`), {
    fetchResults: (q) => searchCompanies(q, API_VERSION),
    onPick: (ticker) => { $(`price${S}`).value = ""; load(side, ticker); },
  })];
}));
function labelSuggestions() { for (const S of ["A", "B"]) $(`suggest${S}`).setAttribute("aria-label", t("search.suggestions")); }
for (const side of /** @type {("a"|"b")[]} */ (["a", "b"])) {
  const S = side.toUpperCase();
  $(`form${S}`).addEventListener("submit", async (/** @type {Event} */ e) => {
    e.preventDefault();
    suggest[side].close();
    $(`price${S}`).value = "";
    load(side, await resolveTicker($(`ticker${S}`).value, API_VERSION));
  });
}
$$(".chip[data-b]").forEach((chip) => chip.addEventListener("click", () => { $("priceB").value = ""; load("b", chip.dataset.b); }));
$("swap").addEventListener("click", () => {
  [state.a, state.b] = [state.b, state.a];
  [$("priceA").value, $("priceB").value] = [$("priceB").value, $("priceA").value];
  [$("tickerA").value, $("tickerB").value] = [state.a ? state.a.ticker : "", state.b ? state.b.ticker : ""];
  [$("statusA").textContent, $("statusB").textContent] = [$("statusB").textContent, $("statusA").textContent];
  render();
});
let priceTimer;
for (const id of ["priceA", "priceB"]) {
  $(id).addEventListener("input", () => { clearTimeout(priceTimer); priceTimer = setTimeout(render, 250); });
}
$$(".lang-switch [data-lang]").forEach((btn) => btn.addEventListener("click", () => {
  if (!useLang(btn.dataset.lang)) return;
  labelSuggestions();
  for (const side of /** @type {("a"|"b")[]} */ (["a", "b"])) {
    const d = state[side];
    if (d) $(`status${side.toUpperCase()}`).textContent = `${d.name} (${d.ticker})`;
  }
  render();
}));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => state.a && state.b && renderGrowth());
bindSlashShortcut("tickerB");
// The buttons start disabled in the HTML (a submit before this script runs would reload the page and lose the tickers),
// then need a ticker in their box.
const syncButtons = [enableWhenFilled("tickerA", "goA"), enableWhenFilled("tickerB", "goB")];

// ---------- start ----------
const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
labelSuggestions();
if (params.get("pa")) $("priceA").value = params.get("pa");
if (params.get("pb")) $("priceB").value = params.get("pb");
(async () => {
  if (params.get("a")) await load("a", params.get("a"));
  if (params.get("b")) await load("b", params.get("b"));
  if (!params.get("b")) $("tickerB").focus();
  render();
})();
