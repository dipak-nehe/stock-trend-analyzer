// The Funds page (funds.html): add up to four US mutual funds or ETFs by ticker and see their costs, returns and
// portfolios side by side. The funds are kept in the address (?f=VOO,FXAIX) so the page can be bookmarked and shared.
// The measures and comparison rules are in funds.js; the figures come from /api/fund.
import { $, $$, applyStaticText, bindSlashShortcut, enableWhenFilled, errorText, initialLang, targetOf, useLang } from "./page.js";
import { EXAMPLES, MAX_FUNDS, benchmark, breakdownRows, compareRows, dollars, holdingRows, indexName, overlapPairs, parseFunds, reportDate } from "./funds.js";
import { esc, langQuery } from "./stock-table.js";
import { pct } from "./format.js";
import { setLang, t } from "./i18n.js";

/** @typedef {{ ticker: string, status: "loading" | "ok" | "error", data?: any, error?: string }} Fund */
/** @type {Fund[]} */
let funds = [];

const status = (/** @type {string} */ text) => { $("fundStatus").textContent = text; };

function updateUrl() {
  const q = new URLSearchParams({ ...(funds.length ? { f: funds.map((f) => f.ticker).join(",") } : {}), ...langQuery() });
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}`);
}

/** Fetch one fund; throws an Error with a message ready to show. @param {string} ticker */
async function fetchFund(ticker) {
  const res = await fetch(`/api/fund?ticker=${encodeURIComponent(ticker)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(getLangMessage(res.status, body.error || `HTTP ${res.status}`, ticker));
  return body;
}

// The server's messages are English: translate the fund-specific ones, the rest as on the stock pages
function getLangMessage(/** @type {number} */ code, /** @type {string} */ message, /** @type {string} */ ticker) {
  if (code === 404 && /isn't in SEC's list/.test(message)) return t("fund.error.notFund", { ticker });
  if (code === 404 && /doesn't file/.test(message)) return t("fund.error.notCovered", { ticker });
  if (code === 502 && /report couldn't be loaded/.test(message)) return t("fund.error.upstream", { ticker });
  return errorText(code, message, ticker);
}

// ---------- adding and removing ----------
/** @param {string} raw */
function add(raw) {
  const [ticker] = parseFunds(raw);
  if (!ticker) { status(t("fund.status.bad")); return; }
  if (funds.some((f) => f.ticker === ticker)) { status(t("fund.status.already", { ticker })); return; }
  if (funds.length >= MAX_FUNDS) { status(t("fund.status.full", { max: MAX_FUNDS })); return; }
  funds.push({ ticker, status: "loading" });
  status(t("fund.status.loading", { ticker }));
  load(funds[funds.length - 1]);
  render();
}

/** @param {Fund} f */
async function load(f) {
  try {
    f.data = await fetchFund(f.ticker);
    f.status = "ok";
    status(t("fund.status.added", { name: `${f.data.fund} (${f.ticker})` }));
  } catch (e) {
    f.error = /** @type {Error} */ (e).message;
    f.status = "error";
    status(f.error);
  }
  if (funds.includes(f)) render();
}

/** @param {string} ticker */
function remove(ticker) {
  funds = funds.filter((f) => f.ticker !== ticker);
  status(t("fund.status.removed", { ticker }));
  render();
  $("fundInput").focus();
}

// ---------- drawing ----------
function drawChips() {
  $("fundExamples").innerHTML = `<span>${esc(t("chips.try"))}</span>`
    + EXAMPLES.map((tk) => `<button class="chip" type="button" data-example="${tk}"${funds.some((f) => f.ticker === tk) ? " disabled" : ""}>${tk}</button>`).join("");
  $("fundChips").innerHTML = funds.map((f) => `<button type="button" class="chip sp-chip" data-remove="${esc(f.ticker)}" data-testid="fund-chip"`
    + ` aria-label="${esc(t("fund.remove", { ticker: f.ticker }))}">${esc(f.ticker)}${f.status === "loading" ? " …" : f.status === "error" ? " !" : ""} ✕</button>`).join("");
}

function drawTable(/** @type {any[]} */ shown) {
  const head = `<thead><tr><th scope="col">${esc(t("fund.measure"))}</th>${shown.map((d) => `<th scope="col" data-testid="fund-col">`
    + `<span class="fund-tk">${esc(d.ticker)}</span><span class="fund-name">${esc(d.fund)}</span>`
    + `${d.shareClass && d.shareClass !== d.fund ? `<span class="muted fund-class">${esc(d.shareClass)}</span>` : ""}</th>`).join("")}</tr></thead>`;
  const { rows, caveat } = compareRows(shown);
  let group = "", body = "";
  for (const r of rows) {
    if (r.group !== group) {
      group = r.group;
      body += `<tr class="group"><th colspan="${shown.length + 1}" scope="colgroup">${esc(t(`fund.group.${group}`))}</th></tr>`;
    }
    body += `<tr data-testid="fund-row" data-key="${r.key}"><th scope="row">${esc(r.label)}</th>${r.cells.map((c) =>
      `<td${c.best ? ' class="fav"' : ""}>${c.text}${c.best ? ` <span class="fav-dot" aria-hidden="true">●</span><span class="sr-only">${esc(t("cmp.app.more"))}</span>` : ""}</td>`).join("")}</tr>`;
  }
  // Where the figures come from: the report, its date and a link to it on SEC
  body += `<tr class="group"><th colspan="${shown.length + 1}" scope="colgroup">${esc(t("fund.group.report"))}</th></tr>`
    + `<tr data-testid="fund-row" data-key="report"><th scope="row">${esc(t("fund.row.report"))}</th>${shown.map((d) =>
      `<td>${esc(t(d.form === "N-CSR" ? "fund.annual" : "fund.semiAnnual", { date: reportDate(d.periodEnd || d.asOf || d.filed) }))}<br>`
      + `<a href="${esc(d.reportUrl)}" target="_blank" rel="noopener">${esc(t("fund.onSec"))}</a></td>`).join("")}</tr>`;
  $("fundTable").innerHTML = head + `<tbody>${body}</tbody>`;
  $("fundCaveat").hidden = !caveat;
  $("fundCaveat").textContent = caveat;
  $("fundMarks").hidden = shown.length < 2;
}

// Overlap between every pair shown: a bar, the share in common, and the largest holdings they share
function drawOverlap(/** @type {any[]} */ shown) {
  const pairs = shown.length > 1 ? overlapPairs(shown) : [];
  $("fundOverlapWrap").hidden = !pairs.length;
  $("fundOverlap").innerHTML = pairs.map((p) => `<div class="fund-overlap-row" data-testid="fund-overlap-pair">`
    + `<div class="fund-overlap-head"><strong>${esc(p.a)} &amp; ${esc(p.b)}</strong> <span>${esc(t("fund.overlapPct", { pct: pct(p.pct, 0) }))}</span></div>`
    + `<span class="fund-bar" aria-hidden="true"><span style="width:${Math.round(p.pct * 100)}%"></span></span>`
    + `<p class="muted">${p.same ? esc(t("fund.overlapSame")) : p.top.length ? esc(t("fund.overlapTop", { n: p.count, list: p.top.map((h) => `${h.name} ${pct(h.pct / 100, 1)}`).join(", ") })) : esc(t("fund.overlapNone"))}</p></div>`).join("");
}

/** A small line chart: the fund (solid) and its index (dashed), scaled together. @param {any} d */
function growthSvg(d) {
  const fund = d.growth.fund, index = d.growth.index && d.growth.index.points;
  const all = [...fund, ...(index || [])];
  const times = all.map(([date]) => Date.parse(date)), values = all.map(([, v]) => v);
  const t0 = Math.min(...times), t1 = Math.max(...times), v0 = Math.min(...values, 10000), v1 = Math.max(...values);
  const W = 300, H = 120, pad = 4;
  const xy = (/** @type {[string, number]} */ [date, v]) =>
    `${(pad + ((Date.parse(date) - t0) / (t1 - t0 || 1)) * (W - 2 * pad)).toFixed(1)},${(H - pad - ((v - v0) / (v1 - v0 || 1)) * (H - 2 * pad)).toFixed(1)}`;
  const base = H - pad - ((10000 - v0) / (v1 - v0 || 1)) * (H - 2 * pad);
  return `<svg class="fund-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`
    + `<line x1="0" x2="${W}" y1="${base.toFixed(1)}" y2="${base.toFixed(1)}" class="fund-chart-base"/>`
    + (index ? `<polyline class="fund-chart-index" points="${index.map(xy).join(" ")}"/>` : "")
    + `<polyline class="fund-chart-fund" points="${fund.map(xy).join(" ")}"/></svg>`;
}

function drawGrowth(/** @type {any[]} */ shown) {
  $("fundGrowth").innerHTML = shown.map((d) => {
    if (!d.growth || !d.growth.fund || d.growth.fund.length < 2) {
      const why = d.growth && d.growth.inconsistent ? "fund.growthInconsistent" : "fund.noGrowth";
      return `<div class="fund-mix-card" data-testid="fund-growth-card"><h4>${esc(d.ticker)}</h4><p class="muted">${esc(t(why))}</p></div>`;
    }
    const fund = d.growth.fund, end = fund[fund.length - 1], index = d.growth.index;
    const idxEnd = index && index.points[index.points.length - 1];
    const idxName = index ? (index.name || indexName(benchmark(d) || { kind: "broad", name: "" })) : "";
    const summary = t("fund.growthSummary", { ticker: d.ticker, value: dollars(end[1]), date: reportDate(end[0]) })
      + (idxEnd ? ` ${t("fund.growthIndex", { index: idxName, value: dollars(idxEnd[1]) })}` : "");
    return `<figure class="fund-mix-card" data-testid="fund-growth-card"><h4>${esc(d.ticker)} <span class="muted">${esc(t("fund.growthEnd", { date: reportDate(end[0]) }))}</span></h4>`
      + growthSvg(d)
      + `<figcaption><span class="fund-key fund">${esc(d.ticker)} ${esc(dollars(end[1]))}</span>`
      + (idxEnd ? ` <span class="fund-key index">${esc(idxName)} ${esc(dollars(idxEnd[1]))}</span>` : "")
      + (fund[0][1] < 9900 ? `<span class="muted fund-key-note">${esc(t("fund.growthCharge"))}</span>` : "")
      + `<span class="sr-only">${esc(summary)}</span></figcaption></figure>`;
  }).join("");
}

// Each fund's ten largest holdings, from its latest N-PORT filing; bars are scaled to the fund's largest holding
function drawTop(/** @type {any[]} */ shown) {
  $("fundTop").innerHTML = shown.map((d) => {
    const rows = holdingRows(d);
    if (!rows.length) return `<div class="fund-mix-card" data-testid="fund-top-card"><h4>${esc(d.ticker)}</h4><p class="muted">${esc(t("fund.noTop"))}</p></div>`;
    const max = rows[0].share;
    return `<div class="fund-mix-card" data-testid="fund-top-card"><h4>${esc(d.ticker)} <span class="muted">${
      esc(t("fund.topAsOf", { pct: pct(d.topTen.pct / 100, 1), date: reportDate(d.topTen.asOf) }))}</span></h4>`
      + `<ol class="fund-bars fund-holdings">${rows.map((r) => `<li data-testid="fund-holding"><span class="fund-bar-label">${esc(r.name)}`
        + `${r.securities > 1 ? ` <span class="muted">${esc(t("fund.securities", { n: r.securities }))}</span>` : ""}</span>`
        + `<span class="fund-bar" aria-hidden="true"><span style="width:${Math.max(2, Math.round((r.share / max) * 100))}%"></span></span>`
        + `<span class="fund-bar-pct">${pct(r.share, 2)}</span></li>`).join("")}</ol></div>`;
  }).join("");
}

function drawMix(/** @type {any[]} */ shown) {
  $("fundMix").innerHTML = shown.map((d) => {
    const rows = breakdownRows(d);
    const by = d.breakdown ? t(`fund.by.${d.breakdown.by}`) : "";
    return `<div class="fund-mix-card" data-testid="fund-mix-card"><h4>${esc(d.ticker)} <span class="muted">${esc(by)}</span></h4>`
      + (rows.length
        ? `<ul class="fund-bars">${rows.map((r) => `<li><span class="fund-bar-label">${esc(r.label)}</span>`
          + `<span class="fund-bar" aria-hidden="true"><span style="width:${Math.max(1, Math.round(r.share * 100))}%"></span></span>`
          + `<span class="fund-bar-pct">${pct(r.share, 1)}</span></li>`).join("")}</ul>`
        : `<p class="muted">${esc(t("fund.noMix"))}</p>`)
      + "</div>";
  }).join("");
}

function render() {
  drawChips();
  const shown = funds.filter((f) => f.status === "ok").map((f) => f.data);
  $("fundResult").hidden = !shown.length;
  if (shown.length) { drawTable(shown); drawOverlap(shown); drawGrowth(shown); drawTop(shown); drawMix(shown); }
  $("fundAdd").toggleAttribute("disabled", !$("fundInput").value.trim() || funds.length >= MAX_FUNDS);
  updateUrl();
}

// ---------- events ----------
$("fundForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = /** @type {HTMLInputElement} */ ($("fundInput"));
  add(input.value);
  input.value = "";
  render();
});
$("fundExamples").addEventListener("click", (e) => {
  const b = /** @type {HTMLElement | null} */ (targetOf(e).closest("[data-example]"));
  if (b) add(b.dataset.example || "");
});
$("fundChips").addEventListener("click", (e) => {
  const b = /** @type {HTMLElement | null} */ (targetOf(e).closest("[data-remove]"));
  if (b) remove(b.dataset.remove || "");
});
$$(".lang-switch [data-lang]").forEach((b) => b.addEventListener("click", () => {
  if (useLang(b.dataset.lang || "en")) { status(""); render(); }
}));

const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
enableWhenFilled("fundInput", "fundAdd");
bindSlashShortcut("fundInput");
for (const ticker of parseFunds(params.get("f"))) {
  funds.push({ ticker, status: "loading" });
  load(funds[funds.length - 1]);
}
render();
