// The Funds page (funds.html): add up to four US mutual funds or ETFs by ticker and see their costs, returns and
// portfolios side by side. The funds are kept in the address (?f=VOO,FXAIX) so the page can be bookmarked and shared.
// The measures and comparison rules are in funds.js; the figures come from /api/fund.
import { $, $$, applyStaticText, bindSlashShortcut, enableWhenFilled, errorText, initialLang, targetOf, useLang } from "./page.js";
import { EXAMPLES, MAX_FUNDS, breakdownRows, compareRows, parseFunds, reportDate } from "./funds.js";
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
  if (shown.length) { drawTable(shown); drawMix(shown); }
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
