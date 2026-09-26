// HTML for the trend tiles, red flags, data table, checklists and footnote.
// Pure functions: data in, markup or text out. app.js puts the results on the page.
import { money, num, pct, perShare } from "./format.js";
import { classify, firstIdx, lastIdx } from "./series.js";
import { labelOf } from "./labels.js";

export function trendTile(title, arr, fmt, cur) {
  const c = classify(arr), i = lastIdx(arr), f = firstIdx(arr);
  const latest = i >= 0 ? fmt(arr[i], cur) : "–";
  const detail = c.g != null
    ? `${pct(c.g)} a year (CAGR) · ${fmt(arr[f], cur)} → ${latest}`
    : (i >= 0 ? `From ${fmt(arr[f], cur)} to ${latest}` : "Not reported");
  return `<div class="card tile">
    <div class="label">${title}</div>
    <div class="value">${latest}</div>
    <div class="trend ${c.cls}">${c.icon} ${c.label}</div>
    <div class="detail">${detail}</div></div>`;
}

export function flagCounts(flags) {
  const cnt = (k) => flags.filter((f) => f.sev === k).length;
  return `<span><b class="down">${cnt("critical")}</b> critical</span><span><b>${cnt("warning")}</b> warnings</span><span><b class="up">${cnt("good")}</b> strengths</span>`;
}

export function flagsList(flags) {
  const ICON = { critical: "!", warning: "!", good: "✓", info: "i" };
  const SEV = { critical: "Critical", warning: "Warning", good: "Strength", info: "Note" };
  return flags.map((f) => `<div class="card flag ${f.sev}">
      <div class="icon" aria-hidden="true">${ICON[f.sev]}</div>
      <div><div class="title"><span class="sev">${SEV[f.sev]}</span>${f.title}</div><div class="why">${f.why}</div></div></div>`).join("")
    || `<div class="card">No flags triggered.</div>`;
}

export function dataTable(d, r) {
  const s = d.series, cur = d.currency;
  const rows = [
    ["revenue", money], ["netIncome", money], ["operatingIncome", money], ["eps", perShare], ["dps", perShare],
    ["dividendsPaid", money], ["operatingCashFlow", money], ["capex", money], ["fcf", money], ["dilutedShares", (v) => num(v)],
    ["totalAssets", money], ["totalLiabilities", money], ["equity", money], ["cash", money], ["totalDebt", money], ["longTermDebt", money],
    ["currentAssets", money], ["currentLiabilities", money], ["goodwill", money], ["receivables", money], ["inventory", money], ["interestExpense", money],
  ];
  const get = (k) => k === "fcf" ? r.fcf : s[k];
  return `<thead><tr><th>Metric</th>${d.years.map((y) => `<th>${y}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(([k, f]) => `<tr><td>${labelOf(k)}</td>${get(k).map((v) => `<td>${f(v, cur)}</td>`).join("")}</tr>`).join("") + "</tbody>";
}

export function footnote(d) {
  const splitNote = d.splits.length ? ` Per-share figures adjusted for stock splits (${d.splits.map((x) => x.ratio >= 1 ? x.ratio + "-for-1" : "1-for-" + Math.round(1 / x.ratio)).join(", ")}).` : "";
  return `Source: SEC EDGAR XBRL company facts (10-K / 20-F / 40-F). Years are labeled by the calendar year the fiscal year ends. "Total debt" is long-term debt including the part due within a year, plus short-term borrowings (leases excluded). "Long-term debt" excludes the part due within a year.${splitNote}`;
}

export function valueView(d, price, v) {
  const cur = d.currency;
  const ps = (x) => perShare(x, cur);
  const vs = (x) => !price || x == null ? "" : `<div class="trend ${price <= x ? "up" : "down"}">Price is ${price <= x ? pct(1 - price / x, 0) + " below" : pct(price / x - 1, 0) + " above"}</div>`;
  const tileV = (label, value, detail, extra = "") => `<div class="card tile"><div class="label">${label}</div><div class="value">${value}</div>${extra}<div class="detail">${detail}</div></div>`;
  const tiles = [
    tileV("Graham Number", v.grahamNumber ? ps(v.grahamNumber) : "–", "√(22.5 × EPS × book value per share): Graham's ceiling price for a defensive investor", vs(v.grahamNumber)),
    tileV("Owner-earnings value", v.iv ? ps(v.iv) : "–", v.iv ? `Free cash flow ${ps(v.oe)}/share, growing ${pct(v.g, 0)} for 10 years, then 3%, discounted at 10%` : "Needs positive free cash flow", vs(v.iv)),
    tileV("Book value per share", v.bvps != null ? ps(v.bvps) : "–", v.pb ? `Price to book ${v.pb.toFixed(2)}` : "Equity ÷ shares outstanding"),
    tileV("P/E on 3-year average EPS", v.pe3 ? v.pe3.toFixed(1) : "–", price ? (v.pe3 ? "Graham's limit is 15" : "Average earnings are negative") : "Enter a price to calculate"),
  ].join("");

  const ICON = { pass: "✓", fail: "✗", na: "–", price: "$" };
  const TAG = { pass: "Met", fail: "Not met", na: "N/A", price: "Needs price" };
  const list = (rows) => rows.map((c) => `<div class="check ${c.status}">
      <div class="st" aria-hidden="true">${ICON[c.status]}</div>
      <div><div class="name">${c.name}<span class="tag">${TAG[c.status]}</span></div><div class="rule">${c.rule}</div><div class="actual">${c.actual}</div></div></div>`).join("");
  const score = (rows) => {
    const n = (k) => rows.filter((c) => c.status === k).length, judged = n("pass") + n("fail");
    const extra = [n("price") && `${n("price")} need a price`, n("na") && `${n("na")} not applicable`].filter(Boolean).join(", ");
    return `Meets <b>${n("pass")}</b> of ${judged} criteria${extra ? ` <span class="muted">(${extra})</span>` : ""}`;
  };

  const so = d.sharesOutstanding;
  const priceHint = cur === "USD"
    ? "Needed for the valuation tests. Look it up on any quote site or your broker."
    : `Enter the price per ordinary share in ${cur}. ADRs often represent several shares, so an ADR price in USD won't match.`;
  const note = `Book value per share uses ${so ? `${num(so.value)} shares outstanding as of ${so.asOf}` : "the latest diluted share count"}. Thresholds follow Graham's and Buffett's published rules of thumb, simplified to what annual filings report. The value estimates are rough models that depend heavily on their assumptions; they are not price targets.`;
  return {
    tiles, priceHint, note,
    graham: list(v.graham), grahamScore: score(v.graham),
    buffett: list(v.buffett), buffettScore: score(v.buffett),
  };
}
