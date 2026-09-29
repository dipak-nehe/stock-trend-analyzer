// HTML for the trend tiles, red flags, data table, checklists and footnote.
// Pure functions: data in, markup or text out. app.js puts the results on the page.
import { fixed, money, num, pct, perShare } from "./format.js";
import { t, tn } from "./i18n.js";
import { classify, firstIdx, lastIdx } from "./series.js";
import { labelOf } from "./labels.js";
import { abbr } from "./help.js";
import { OTHER_SERIOUS } from "./history.js";
import { insiderSummary } from "./insiders.js";

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
    ? t("tile.growth", { rate: pct(c.g), cagr: abbr("CAGR"), first: fmt(arr[f], cur), latest })
    : (i >= 0 ? t("tile.fromTo", { first: fmt(arr[f], cur), latest }) : t("tile.notReported"));
  return `<div class="card tile" data-testid="tile">
    <div class="label">${title}</div>
    <div class="value">${latest}</div>
    <div class="trend ${c.cls}">${c.icon} ${c.label}</div>
    ${sparkline(arr)}
    <div class="detail">${detail}</div></div>`;
}

export function flagCounts(flags) {
  const cnt = (k) => flags.filter((f) => f.sev === k).length;
  return `<span><b class="down">${cnt("critical")}</b> ${t("flags.count.critical")}</span><span><b>${cnt("warning")}</b> ${t("flags.count.warning")}</span><span><b class="up">${cnt("good")}</b> ${t("flags.count.good")}</span>`;
}

export function flagsList(flags) {
  const ICON = { critical: "!", warning: "!", good: "✓", info: "i" };
  const card = (f) => `<div class="card flag ${f.sev}" data-testid="flag">
      <div class="icon" aria-hidden="true">${ICON[f.sev]}</div>
      <div><div class="title" data-testid="flag-title"><span class="sev">${t(`flags.sev.${f.sev}`)}</span>${f.title}</div><div class="why">${f.why}</div>${
        f.help ? `<div class="help" data-testid="flag-help"><strong>${t("flags.whyItMatters")}</strong> ${f.help}</div>` : ""}</div></div>`;
  const group = (title, list, empty) => (list.length || empty)
    ? `<div class="flag-group"><h3>${title}${list.length ? ` <span class="count">${list.length}</span>` : ""}</h3>${list.length ? list.map(card).join("") : `<div class="card empty-group">${empty}</div>`}</div>`
    : "";
  return group(t("flags.group.attention"), flags.filter((f) => f.sev === "critical" || f.sev === "warning"), t("flags.none"))
    + group(t("flags.group.good"), flags.filter((f) => f.sev === "good"))
    + group(t("flags.group.notes"), flags.filter((f) => f.sev === "info"));
}

/** @type {[string, [string, (v: number, cur?: string) => string][]][]} Group key, then [metric, formatter] rows. */
export const DATA_GROUPS = [
  ["group.income", [["revenue", money], ["operatingIncome", money], ["netIncome", money], ["interestExpense", money]]],
  ["group.perShare", [["eps", perShare], ["dps", perShare], ["dilutedShares", (v) => num(v)]]],
  ["group.cashFlow", [["operatingCashFlow", money], ["capex", money], ["fcf", money], ["dividendsPaid", money]]],
  ["group.balance", [["totalAssets", money], ["totalLiabilities", money], ["equity", money], ["cash", money], ["totalDebt", money],
    ["longTermDebt", money], ["currentAssets", money], ["currentLiabilities", money], ["goodwill", money], ["receivables", money], ["inventory", money]]],
];

export function dataTable(d, r) {
  const s = d.series, cur = d.currency, last = d.years.length - 1;
  const get = (k) => k === "fcf" ? r.fcf : s[k];
  const cls = (i) => i === last ? ' class="latest"' : "";
  const head = `<thead><tr><th>${t("table.metric")}</th>${d.years.map((y, i) => `<th${cls(i)}>${y}</th>`).join("")}</tr></thead>`;
  const body = DATA_GROUPS.map(([name, rows]) => `<tr class="group"><th colspan="${d.years.length + 1}">${t(name)}</th></tr>`
    + rows.map(([k, f]) => `<tr><td>${labelOf(k)}</td>${get(k).map((v, i) => `<td${cls(i)}>${f(v, cur)}</td>`).join("")}</tr>`).join("")).join("");
  return `${head}<tbody>${body}</tbody>`;
}

export function footnote(d) {
  const first = d.periodEnds ? d.periodEnds[0] : "";
  const splits = d.splits.filter((x) => !x.detectedInFiling || x.detectedInFiling > first);
  const list = splits.map((x) => x.ratio >= 1 ? t("split.forward", { n: x.ratio }) : t("split.reverse", { n: Math.round(1 / x.ratio) })).join(", ");
  return t("footnote") + (splits.length ? t("footnote.splits", { list }) : "");
}

// Links to look up today's price on public quote pages. The site doesn't fetch or show prices itself:
// free price feeds only allow personal use, so the visitor looks the price up and types it in.
export function priceLinks(ticker) {
  const sym = encodeURIComponent(ticker);
  const q = encodeURIComponent(t("vv.lookup.query", { ticker }));
  return `${t("vv.lookup")} <a href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener noreferrer">Google ↗</a>`
    + ` · <a href="https://finance.yahoo.com/quote/${sym}/" target="_blank" rel="noopener noreferrer">Yahoo Finance ↗</a>`;
}

export function valueView(d, price, v) {
  const cur = d.currency;
  const ps = (x) => perShare(x, cur);
  const vs = (x) => !price || x == null ? "" : `<div class="trend ${price <= x ? "up" : "down"}">${
    price <= x ? t("vv.priceBelow", { pct: pct(1 - price / x, 0) }) : t("vv.priceAbove", { pct: pct(price / x - 1, 0) })}</div>`;
  const tileV = (label, value, detail, extra = "") => `<div class="card tile" data-testid="tile"><div class="label">${label}</div><div class="value">${value}</div>${extra}<div class="detail">${detail}</div></div>`;
  const tiles = [
    tileV(t("vv.graham.label"), v.grahamNumber ? ps(v.grahamNumber) : "–", t("vv.graham.detail"), vs(v.grahamNumber)),
    tileV(t("vv.oe.label"), v.iv ? ps(v.iv) : "–", v.iv ? t("vv.oe.detail", { fcf: ps(v.oe), g: pct(v.g, 0) }) : t("vv.oe.none"), vs(v.iv)),
    tileV(t("vv.bvps.label"), v.bvps != null ? ps(v.bvps) : "–", v.pb ? t("vv.bvps.pb", { pb: fixed(v.pb, 2) }) : t("vv.bvps.detail")),
    tileV(t("vv.pe.label"), v.pe3 ? fixed(v.pe3, 1) : "–", price ? (v.pe3 ? t("vv.pe.limit") : t("vv.pe.negative")) : t("vv.pe.enter")),
  ].join("");

  const ICON = { pass: "✓", fail: "✗", na: "–", price: "$" };

  const list = (rows) => rows.map((c) => `<div class="check ${c.status}" data-testid="check">
      <div class="st" aria-hidden="true">${ICON[c.status]}</div>
      <div><div class="name">${c.name}<span class="tag">${t(`vv.tag.${c.status}`)}</span></div><div class="rule">${c.rule}</div><div class="actual">${c.actual}</div></div></div>`).join("");
  const score = (rows) => {
    const n = (k) => rows.filter((c) => c.status === k).length, judged = n("pass") + n("fail");
    const extra = [n("price") && tn("vv.score.needPrice", n("price")), n("na") && tn("vv.score.na", n("na"))].filter(Boolean).join(", ");
    const share = judged ? Math.round((n("pass") / judged) * 100) : 0;
    return t("vv.score", { met: n("pass"), judged }) + (extra ? ` <span class="muted">(${extra})</span>` : "")
      + `<div class="meter" role="img" aria-label="${t("vv.score.aria", { met: n("pass"), judged })}"><span style="width:${share}%"></span></div>`;
  };

  const so = d.sharesOutstanding;
  const priceHint = cur === "USD" ? t("vv.hint.usd") : t("vv.hint.foreign", { cur });
  const note = t("vv.note", { shares: so ? t("vv.note.shares", { n: num(so.value), date: so.asOf }) : t("vv.note.diluted") });
  return {
    tiles, priceHint, note, links: priceLinks(d.ticker),
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
  const say = c.g != null ? t("glance.trend", { label: c.label, rate: pct(c.g) }) : c.label;
  return { what, say, sev, icon: TREND_ICON[c.cls] || GLANCE_ICON[sev], tab };
}

// Filing-record counts that count against a company (routine SEC letters don't).
export function filingProblems(h) {
  if (!h) return null;
  const n = (type) => h.counts[type] || 0;
  const other = OTHER_SERIOUS.reduce((sum, k) => sum + n(k), 0);
  const parts = [
    n("non_reliance") && tn("problems.restatement", n("non_reliance")),
    n("auditor_change") && tn("problems.auditor", n("auditor_change")),
    n("late_filing") && tn("problems.late", n("late_filing")),
    other && tn("problems.other", other), // bankruptcy, exchange notices, cyber incidents, write-downs: one item
  ].filter(Boolean);
  const total = n("non_reliance") + n("auditor_change") + n("late_filing") + other;
  const serious = n("non_reliance") || n("bankruptcy") || n("late_filing") >= 3 || n("delisting_notice") >= 3;
  const sev = !total ? "good" : serious ? "critical" : "warning";
  return { total, sev, text: parts.join(" · ") };
}

export function glanceRows(d, r, v) {
  const s = d.series, rows = [];
  rows.push(trendRow(t("glance.revenue"), s.revenue, "overview"));
  rows.push(trendRow(t("glance.earnings"), s.netIncome, "overview"));
  const DIV = t("glance.dividend");

  const dps = s.dps.filter((x) => x != null);
  if (!dps.some((x) => x > 0)) rows.push({ what: DIV, say: t("glance.noDividend"), sev: "info", icon: "–", tab: "overview" });
  else if (dps[dps.length - 1] === 0) rows.push({ what: DIV, say: t("glance.suspended"), sev: "critical", icon: "✗", tab: "overview" });
  else rows.push(trendRow(DIV, s.dps, "overview"));

  const cnt = (k) => r.flags.filter((f) => f.sev === k).length;
  const crit = r.flags.filter((f) => f.sev === "critical");
  const flagSev = crit.length ? "critical" : cnt("warning") ? "warning" : "good";
  rows.push({ what: t("glance.flags"), sev: flagSev, icon: GLANCE_ICON[flagSev], tab: "flags",
              say: t("glance.flagCounts", { c: crit.length, w: cnt("warning"), g: cnt("good") }) + (crit.length ? ` — ${crit[0].title}` : "") });

  const fp = filingProblems(d.secHistory);
  if (fp) rows.push({ what: t("glance.sec"), sev: fp.sev, icon: GLANCE_ICON[fp.sev], tab: "history",
                      say: fp.total ? fp.text : t("glance.clean", { year: d.secHistory.since.slice(0, 4) }) });
  const ins = insiderSummary(d.insiders, d.insidersState);
  if (ins) rows.push({ what: t("glance.insiders"), sev: ins.sev, icon: GLANCE_ICON[ins.sev], tab: "insiders", say: ins.text });

  const score = (list) => {
    const met = list.filter((c) => c.status === "pass").length, judged = list.filter((c) => c.status === "pass" || c.status === "fail").length;
    return { met, judged, needPrice: list.some((c) => c.status === "price") };
  };
  const g = score(v.graham), b = score(v.buffett);
  rows.push({ what: t("glance.value"), sev: "info", icon: "★", tab: "value",
              say: t("glance.scores", { g: g.met, gj: g.judged, b: b.met, bj: b.judged }) + (g.needPrice || b.needPrice ? t("glance.addPrice") : "") });
  return rows;
}

export function glanceView(d, r, v) {
  return glanceRows(d, r, v).map((row) => `<button type="button" class="glance-row ${row.sev}" data-tab="${row.tab}">
      <span class="st" aria-hidden="true">${row.icon}</span><span class="what" data-testid="glance-what">${row.what}</span>
      <span class="say">${row.say}</span><span class="go">${t("glance.details")}</span></button>`).join("");
}
