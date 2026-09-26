// HTML for the trend tiles, red flags, data table, checklists and footnote.
// Pure functions: data in, markup or text out. app.js puts the results on the page.
import { money, num, pct, perShare } from "./format.js";
import { classify, firstIdx, lastIdx } from "./series.js";
import { labelOf } from "./labels.js";
import { FLAG_HELP, abbr } from "./help.js";

// A small trend line of the yearly values (decorative: the tile's text carries the meaning).
export function sparkline(arr) {
  const pts = arr.map((v, i) => [i, v]).filter((p) => p[1] != null);
  if (pts.length < 2) return "";
  const W = 120, H = 32, pad = 3, n = arr.length - 1 || 1;
  const vals = pts.map((p) => p[1]), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const xy = pts.map(([i, v]) => [pad + (i / n) * (W - 2 * pad), H - pad - ((v - lo) / span) * (H - 2 * pad)]);
  const d = xy.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const zero = lo < 0 && hi > 0 ? `<line x1="0" x2="${W}" y1="${(H - pad - ((0 - lo) / span) * (H - 2 * pad)).toFixed(1)}" y2="${(H - pad - ((0 - lo) / span) * (H - 2 * pad)).toFixed(1)}" class="zero"/>` : "";
  const [lx, ly] = xy[xy.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${zero}<path d="${d}"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.5"/></svg>`;
}

export function trendTile(title, arr, fmt, cur) {
  const c = classify(arr), i = lastIdx(arr), f = firstIdx(arr);
  const latest = i >= 0 ? fmt(arr[i], cur) : "–";
  const detail = c.g != null
    ? `${pct(c.g)} a year (${abbr("CAGR")}) · ${fmt(arr[f], cur)} → ${latest}`
    : (i >= 0 ? `From ${fmt(arr[f], cur)} to ${latest}` : "Not reported");
  return `<div class="card tile">
    <div class="label">${title}</div>
    <div class="value">${latest}</div>
    <div class="trend ${c.cls}">${c.icon} ${c.label}</div>
    ${sparkline(arr)}
    <div class="detail">${detail}</div></div>`;
}

export function flagCounts(flags) {
  const cnt = (k) => flags.filter((f) => f.sev === k).length;
  return `<span><b class="down">${cnt("critical")}</b> critical</span><span><b>${cnt("warning")}</b> warnings</span><span><b class="up">${cnt("good")}</b> strengths</span>`;
}

export function flagsList(flags) {
  const ICON = { critical: "!", warning: "!", good: "✓", info: "i" };
  const SEV = { critical: "Critical", warning: "Warning", good: "Strength", info: "Note" };
  const card = (f) => `<div class="card flag ${f.sev}">
      <div class="icon" aria-hidden="true">${ICON[f.sev]}</div>
      <div><div class="title"><span class="sev">${SEV[f.sev]}</span>${f.title}</div><div class="why">${f.why}</div>${
        FLAG_HELP[f.title] ? `<div class="help"><strong>Why it matters:</strong> ${FLAG_HELP[f.title]}</div>` : ""}</div></div>`;
  const group = (title, list, empty) => (list.length || empty)
    ? `<div class="flag-group"><h3>${title}${list.length ? ` <span class="count">${list.length}</span>` : ""}</h3>${list.length ? list.map(card).join("") : `<div class="card empty-group">${empty}</div>`}</div>`
    : "";
  return group("Needs attention", flags.filter((f) => f.sev === "critical" || f.sev === "warning"), "Nothing needs attention: no critical items or warnings.")
    + group("Going well", flags.filter((f) => f.sev === "good"))
    + group("Notes", flags.filter((f) => f.sev === "info"));
}

export const DATA_GROUPS = [
  ["Income statement", [["revenue", money], ["operatingIncome", money], ["netIncome", money], ["interestExpense", money]]],
  ["Per share", [["eps", perShare], ["dps", perShare], ["dilutedShares", (v) => num(v)]]],
  ["Cash flow", [["operatingCashFlow", money], ["capex", money], ["fcf", money], ["dividendsPaid", money]]],
  ["Balance sheet", [["totalAssets", money], ["totalLiabilities", money], ["equity", money], ["cash", money], ["totalDebt", money],
    ["longTermDebt", money], ["currentAssets", money], ["currentLiabilities", money], ["goodwill", money], ["receivables", money], ["inventory", money]]],
];

export function dataTable(d, r) {
  const s = d.series, cur = d.currency, last = d.years.length - 1;
  const get = (k) => k === "fcf" ? r.fcf : s[k];
  const cls = (i) => i === last ? ' class="latest"' : "";
  const head = `<thead><tr><th>Metric</th>${d.years.map((y, i) => `<th${cls(i)}>${y}</th>`).join("")}</tr></thead>`;
  const body = DATA_GROUPS.map(([name, rows]) => `<tr class="group"><th colspan="${d.years.length + 1}">${name}</th></tr>`
    + rows.map(([k, f]) => `<tr><td>${labelOf(k)}</td>${get(k).map((v, i) => `<td${cls(i)}>${f(v, cur)}</td>`).join("")}</tr>`).join("")).join("");
  return `${head}<tbody>${body}</tbody>`;
}

export function footnote(d) {
  const first = d.periodEnds ? d.periodEnds[0] : "";
  const splits = d.splits.filter((x) => !x.detectedInFiling || x.detectedInFiling > first);
  const splitNote = splits.length ? ` Per-share figures adjusted for stock splits (${splits.map((x) => x.ratio >= 1 ? x.ratio + "-for-1" : "1-for-" + Math.round(1 / x.ratio)).join(", ")}).` : "";
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
    const share = judged ? Math.round((n("pass") / judged) * 100) : 0;
    return `Meets <b>${n("pass")}</b> of ${judged} criteria${extra ? ` <span class="muted">(${extra})</span>` : ""}`
      + `<div class="meter" role="img" aria-label="${n("pass")} of ${judged} criteria met"><span style="width:${share}%"></span></div>`;
  };

  const so = d.sharesOutstanding;
  const priceHint = cur === "USD"
    ? "Needed for the valuation tests. Look it up on any quote site or your broker."
    : `Enter the price per ordinary share in ${cur}. ADRs often represent several shares, so an ADR price in USD won't match.`;
  const note = `Book value per share uses ${so ? `${num(so.value)} shares outstanding as of ${so.asOf}` : "the latest diluted share count"}. Thresholds follow Graham's and Buffett's published rules of thumb, simplified to what annual filings report. The value estimates are rough models that depend heavily on their assumptions; they are not price targets. Not affiliated with or endorsed by Warren Buffett, Berkshire Hathaway or the Graham estate.`;
  return {
    tiles, priceHint, note,
    graham: list(v.graham), grahamScore: score(v.graham),
    buffett: list(v.buffett), buffettScore: score(v.buffett),
  };
}

// ---------- "At a glance": one line per area, each linking to its tab ----------
const GLANCE_ICON = { good: "✓", warning: "!", critical: "✗", info: "–" };
const TREND_ICON = { up: "▲", flat: "▶", down: "▼" };

function trendRow(what, arr, tab) {
  const c = classify(arr);
  const recentLoss = arr.slice(-3).some((x) => x != null && x < 0);
  const sev = recentLoss ? "critical" : c.cls === "up" ? "good" : c.cls === "down" ? "warning" : "info";
  const say = c.g != null ? `${c.label}, ${pct(c.g)} a year` : c.label;
  return { what, say, sev, icon: TREND_ICON[c.cls] || GLANCE_ICON[sev], tab };
}

// Filing-record counts that count against a company (routine SEC letters don't).
export function filingProblems(h) {
  if (!h) return null;
  const n = (t) => h.counts[t] || 0;
  const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const parts = [
    n("non_reliance") && plural(n("non_reliance"), "restatement", "restatements"),
    n("auditor_change") && plural(n("auditor_change"), "auditor change", "auditor changes"),
    n("late_filing") && plural(n("late_filing"), "late filing", "late filings"),
  ].filter(Boolean);
  const total = n("non_reliance") + n("auditor_change") + n("late_filing");
  const sev = !total ? "good" : n("non_reliance") || n("late_filing") >= 3 ? "critical" : "warning";
  return { total, sev, text: parts.join(" · ") };
}

export function glanceRows(d, r, v) {
  const s = d.series, rows = [];
  rows.push(trendRow("Revenue", s.revenue, "overview"));
  rows.push(trendRow("Earnings", s.netIncome, "overview"));

  const dps = s.dps.filter((x) => x != null);
  if (!dps.some((x) => x > 0)) rows.push({ what: "Dividend", say: "No dividend paid", sev: "info", icon: "–", tab: "overview" });
  else if (dps[dps.length - 1] === 0) rows.push({ what: "Dividend", say: "Cut to zero (suspended)", sev: "critical", icon: "✗", tab: "overview" });
  else rows.push(trendRow("Dividend", s.dps, "overview"));

  const cnt = (k) => r.flags.filter((f) => f.sev === k).length;
  const crit = r.flags.filter((f) => f.sev === "critical");
  const flagSev = crit.length ? "critical" : cnt("warning") ? "warning" : "good";
  rows.push({ what: "Red flags", sev: flagSev, icon: GLANCE_ICON[flagSev], tab: "flags",
              say: `${crit.length} critical · ${cnt("warning")} warnings · ${cnt("good")} strengths${crit.length ? ` — ${crit[0].title}` : ""}` });

  const fp = filingProblems(d.secHistory);
  if (fp) rows.push({ what: "SEC record", sev: fp.sev, icon: GLANCE_ICON[fp.sev], tab: "history",
                      say: fp.total ? fp.text : `Clean since ${d.secHistory.since.slice(0, 4)}` });

  const score = (list) => {
    const met = list.filter((c) => c.status === "pass").length, judged = list.filter((c) => c.status === "pass" || c.status === "fail").length;
    return { met, judged, needPrice: list.some((c) => c.status === "price") };
  };
  const g = score(v.graham), b = score(v.buffett);
  rows.push({ what: "Graham & Buffett", sev: "info", icon: "★", tab: "value",
              say: `Graham ${g.met} of ${g.judged} · Buffett ${b.met} of ${b.judged}${g.needPrice || b.needPrice ? " · add a price for valuation tests" : ""}` });
  return rows;
}

export function glanceView(d, r, v) {
  return glanceRows(d, r, v).map((row) => `<button type="button" class="glance-row ${row.sev}" data-tab="${row.tab}">
      <span class="st" aria-hidden="true">${row.icon}</span><span class="what">${row.what}</span>
      <span class="say">${row.say}</span><span class="go">Details →</span></button>`).join("");
}
