// HTML for the trend tiles, red flags, data table, checklists and footnote.
// Pure functions: data in, markup or text out. app.js puts the results on the page.
import { fixed, money, num, pct, perShare } from "./format.js";
import { getLocale, t, tn } from "./i18n.js";
import { classify, firstIdx, lastIdx } from "./series.js";
import { labelOf } from "./labels.js";
import { abbr } from "./help.js";
import { OTHER_SERIOUS } from "./history.js";

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

// R&D spending as a share of revenue, on the EU Industrial R&D Scoreboard's four bands. Neutral on purpose: what's
// normal depends on the industry, so it's no verdict. No tile at all when the company doesn't report R&D.
export function rdTile(d) {
  const s = d.series, rd = s.researchAndDevelopment || [];
  const share = rd.map((v, i) => (v != null && s.revenue[i] > 0 ? v / s.revenue[i] : null));
  const i = lastIdx(share), f = firstIdx(share);
  if (i < 0) return "";
  const x = share[i], band = x > 0.05 ? "high" : x >= 0.02 ? "mediumHigh" : x >= 0.01 ? "mediumLow" : "low";
  const since = f < i ? t("tile.rd.since", { first: pct(share[f]), year: d.years[f] }) : "";
  return `<div class="card tile" data-testid="rd-tile">
    <div class="label">${t("tile.rd")}</div>
    <div class="value">${pct(x)}</div>
    <div class="trend flat">${t(`tile.rd.${band}`)}</div>
    ${sparkline(share)}
    <div class="detail">${t("tile.rd.detail", { amount: money(rd[i], d.currency), year: d.years[i], since })}</div></div>`;
}

// "Latest 12 months": the newest quarterly report's income and cash-flow figures, set against the last fiscal year.
// Empty when no quarterly report is newer than the annual report (e.g. foreign filers, who don't file 10-Qs).
export function ttmView(d) {
  const tt = d.ttm;
  if (!tt) return "";
  const s = d.series, cur = d.currency, v = tt.values, fy = d.years[d.years.length - 1];
  const fyOf = (k) => (s[k] ? s[k][s[k].length - 1] : null);
  const fcf = (ocf, capex) => (ocf != null && capex != null ? ocf - capex : null);
  const date = new Date(`${tt.asOf}T00:00:00`).toLocaleDateString(getLocale(), { year: "numeric", month: "short", day: "numeric" });
  const rows = [
    ["revenue", v.revenue, fyOf("revenue"), money],
    ["netIncome", v.netIncome, fyOf("netIncome"), money],
    ["eps", v.eps, fyOf("eps"), perShare],
    ["fcf", fcf(v.operatingCashFlow, v.capex), fcf(fyOf("operatingCashFlow"), fyOf("capex")), money],
  ].filter(([, now]) => now != null);
  if (!rows.length) return "";
  const change = (now, then) => {
    if (then == null || then === 0) return "";
    const c = (now - then) / Math.abs(then);
    return ` <span class="trend ${c > 0.005 ? "up" : c < -0.005 ? "down" : "flat"}">${c >= 0 ? "+" : "−"}${pct(Math.abs(c))}</span>`;
  };
  return `<div class="card ttm" data-testid="ttm">
    <h3>${t("ttm.title", { date })}</h3>
    <div class="ttm-grid">${rows.map(([k, now, then, f]) => `<div class="ttm-item" data-testid="ttm-item">
      <div class="label">${labelOf(k)}</div><div class="value">${f(now, cur)}</div>
      <div class="detail">${then != null ? t("ttm.vsFy", { year: fy, value: f(then, cur) }) + change(now, then) : ""}</div></div>`).join("")}</div>
    <p class="note">${t("ttm.note", { year: fy })}</p></div>`;
}

// "Compared with its industry" card (rows from industry.js). Neutral wording: higher isn't always better.
export function industryView(d, cmp) {
  if (!cmp) return "";
  const name = (d.secHistory && d.secHistory.industry) || "";
  const fmt = (k, v) => (k === "currentRatio" ? fixed(v, 2) : pct(v));
  const label = cmp.level === 4 ? t("ind.group4", { name, code: cmp.code })
    : t("ind.groupWider", { name, code: cmp.code + "x".repeat(4 - cmp.level) });
  return `<div class="card industry" data-testid="industry">
    <h3>${t("ind.title")}</h3>
    <p class="ind-group">${t("ind.sub", { label, n: cmp.group.companies, year: cmp.year })}</p>
    <div class="ind-wrap" role="region" tabindex="0" aria-label="${t("ind.title")}"><table class="ind-table"><thead><tr><th>${t("ind.measure")}</th><th>${t("ind.thisCompany")}</th><th>${t("ind.median")}</th><th>${t("ind.position")}</th></tr></thead><tbody>
    ${cmp.rows.map((r) => `<tr data-testid="industry-row"><th scope="row">${t(`ind.r.${r.ratio}`)}</th><td data-label="${t("ind.thisCompany")}">${fmt(r.ratio, r.value)}</td>
      <td data-label="${t("ind.median")}">${fmt(r.ratio, r.median)}</td><td><span class="ind-pos ${r.position}">${t(`ind.pos.${r.position}`)}</span></td></tr>`).join("")}
    </tbody></table></div>
    <p class="note">${t("ind.note", { year: cmp.year, fy: d.years[d.years.length - 1] })}</p></div>`;
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
  ["group.income", [["revenue", money], ["researchAndDevelopment", money], ["operatingIncome", money], ["pretaxIncome", money], ["incomeTax", money], ["netIncome", money],
    ["interestExpense", money]]],
  ["group.perShare", [["eps", perShare], ["dps", perShare], ["dilutedShares", (v) => num(v)]]],
  ["group.cashFlow", [["operatingCashFlow", money], ["capex", money], ["fcf", money], ["dividendsPaid", money]]],
  ["group.balance", [["totalAssets", money], ["totalLiabilities", money], ["equity", money], ["cash", money], ["totalDebt", money],
    ["longTermDebt", money], ["currentAssets", money], ["currentLiabilities", money], ["goodwill", money], ["intangibles", money], ["receivables", money], ["inventory", money]]],
];

export function dataTable(d, r) {
  const s = d.series, cur = d.currency, last = d.years.length - 1;
  const get = (k) => (k === "fcf" ? r.fcf : s[k]) || d.years.map(() => null);  // older responses lack newer figures
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

// A checklist's rows ({ status, name, rule, actual }) and its "Meets N of M" score with a meter; shared by the value
// checklists and the Durable advantage tab.
const ICON = { pass: "✓", fail: "✗", na: "–", price: "$" };
export const checklist = (rows) => rows.map((c) => `<div class="check ${c.status}" data-testid="check">
      <div class="st" aria-hidden="true">${ICON[c.status]}</div>
      <div><div class="name">${c.name}<span class="tag">${t(`vv.tag.${c.status}`)}</span></div><div class="rule">${c.rule}</div><div class="actual">${c.actual}</div></div></div>`).join("");
export function checklistScore(rows) {
  const n = (k) => rows.filter((c) => c.status === k).length, judged = n("pass") + n("fail");
  const extra = [n("price") && tn("vv.score.needPrice", n("price")), n("na") && tn("vv.score.na", n("na"))].filter(Boolean).join(", ");
  const share = judged ? Math.round((n("pass") / judged) * 100) : 0;
  return t("vv.score", { met: n("pass"), judged }) + (extra ? ` <span class="muted">(${extra})</span>` : "")
    + `<div class="meter" role="img" aria-label="${t("vv.score.aria", { met: n("pass"), judged })}"><span style="width:${share}%"></span></div>`;
}

export function valueView(d, price, v) {
  const cur = d.currency;
  const ps = (x) => perShare(x, cur);
  const vs = (x) => !price || x == null ? "" : `<div class="trend ${price <= x ? "up" : "down"}">${
    price <= x ? t("vv.priceBelow", { pct: pct(1 - price / x, 0) }) : t("vv.priceAbove", { pct: pct(price / x - 1, 0) })}</div>`;
  const tileV = (label, value, detail, extra = "") => `<div class="card tile" data-testid="tile"><div class="label">${label}</div><div class="value">${value}</div>${extra}<div class="detail">${detail}</div></div>`;
  // What the business might be worth, from the filings alone: no price needed
  const tiles = [
    tileV(t("vv.oe.label"), v.iv ? ps(v.iv) : "–", v.iv ? t("vv.oe.detail", { fcf: ps(v.oe), g: pct(v.g, 1), tg: pct(v.tg, 1), disc: pct(v.disc, 1) })
      : v.oe > 0 ? t("vv.oe.badRates") : t("vv.oe.none")),
    tileV(t("vv.graham.label"), v.grahamNumber ? ps(v.grahamNumber) : "–", t("vv.graham.detail")),
    tileV(t("vv.bvps.label"), v.bvps != null ? ps(v.bvps) : "–", t("vv.bvps.detail")),
  ].join("");

  // Valuation at the entered price, last on the tab: the business is judged first, then the price. Owner earnings
  // and the margin of safety lead, as in Buffett's approach.
  const ENTER = t("vv.pe.enter");
  const priceTiles = [
    tileV(t("vv.fcfYield.label"), v.fcfYield != null ? pct(v.fcfYield) : "–",
      v.fcfPs == null ? t("vv.fcfYield.none") : price ? t("vv.fcfYield.detail", { fcf: ps(v.fcfPs) }) : ENTER),
    tileV(t("vv.mos.label"), price && v.iv ? (price <= v.iv ? t("vv.mos.below", { pct: pct(1 - price / v.iv, 0) }) : t("vv.mos.above", { pct: pct(price / v.iv - 1, 0) })) : "–",
      !v.iv ? t("vv.mos.none") : price ? t("vv.mos.detail", { iv: ps(v.iv) }) : ENTER),
    tileV(t("vv.ev.label"), v.evFcf != null ? fixed(v.evFcf, 1) : "–",
      v.fcfPs == null ? t("vv.fcfYield.none") : !(v.fcfL > 0) ? t("vv.ev.none") : price ? t("vv.ev.detail", { ev: money(v.ev, cur), fcf: money(v.fcfL, cur) }) : ENTER),
    tileV(t("vv.pe.label"), v.pe3 ? fixed(v.pe3, 1) : "–", price ? (v.pe3 ? t("vv.pe.limit") : t("vv.pe.negative")) : ENTER),
    tileV(t("vv.pb.label"), v.pb ? fixed(v.pb, 2) : "–", !(v.bvps > 0) ? t("vv.pb.none") : price ? t("vv.pb.detail", { bvps: ps(v.bvps) }) : ENTER),
    tileV(t("vv.gn.label"), price && v.grahamNumber ? ps(price) : "–",
      !v.grahamNumber ? t("vv.gn.none") : price ? t("vv.gn.detail", { gn: ps(v.grahamNumber) }) : ENTER, vs(v.grahamNumber)),
    tileV(t("vv.divYield.label"), v.divYield != null ? pct(v.divYield) : "–",
      !v.dpsL ? t("vv.divYield.none") : price ? t("vv.divYield.detail", { dps: ps(v.dpsL) }) : ENTER),
  ].join("");

  const list = checklist, score = checklistScore;

  const so = d.sharesOutstanding;
  const priceHint = cur === "USD" ? t("vv.hint.usd") : t("vv.hint.foreign", { cur });
  const note = t("vv.note", { shares: so ? t("vv.note.shares", { n: num(so.value), date: so.asOf }) : t("vv.note.diluted") });
  return {
    tiles, priceTiles, priceHint, note, links: priceLinks(d.ticker),
    graham: list(v.graham), grahamScore: score(v.graham),
    buffett: list(v.buffett), buffettScore: score(v.buffett),
    lynch: list(v.lynch), lynchScore: score(v.lynch),
    piotroski: list(v.piotroski), piotroskiScore: score(v.piotroski),
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

  const score = (list) => {
    const met = list.filter((c) => c.status === "pass").length, judged = list.filter((c) => c.status === "pass" || c.status === "fail").length;
    return { met, judged, needPrice: list.some((c) => c.status === "price") };
  };
  const g = score(v.graham), b = score(v.buffett);
  rows.push({ what: t("glance.value"), sev: "info", icon: "★", tab: "value",
              say: t("glance.scores", { g: g.met, gj: g.judged, b: b.met, bj: b.judged }) + (g.needPrice || b.needPrice ? t("glance.addPrice") : "") });
  // Price last, after the business: only once a price is entered
  if (v.price) {
    const parts = [
      v.fcfYield != null && t("glance.price.oey", { pct: pct(v.fcfYield) }),
      v.iv && (v.price <= v.iv ? t("glance.price.below", { pct: pct(1 - v.price / v.iv, 0) }) : t("glance.price.above", { pct: pct(v.price / v.iv - 1, 0) })),
      v.evFcf != null && t("glance.price.ev", { x: fixed(v.evFcf, 1) }),
    ].filter(Boolean);
    if (parts.length) rows.push({ what: t("glance.price"), sev: "info", icon: "¤", tab: "value",
                                  say: t("glance.price.at", { price: perShare(v.price, d.currency) }) + parts.join(" · ") });
  }
  return rows;
}

export function glanceView(d, r, v) {
  return glanceRows(d, r, v).map((row) => `<button type="button" class="glance-row ${row.sev}" data-tab="${row.tab}">
      <span class="st" aria-hidden="true">${row.icon}</span><span class="what" data-testid="glance-what">${row.what}</span>
      <span class="say">${row.say}</span><span class="go">${t("glance.details")}</span></button>`).join("");
}
