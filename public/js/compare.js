// Side-by-side comparison of two companies. Pure logic: data in, rows out (compare-app.js puts them on the page).
//
// Neutral marks: a row gets `better: "a" | "b"` only when the measure has a clear direction (e.g. lower debt/equity,
// higher margin) and both values exist. Sizes (revenue, net income) and dividend amounts never get a mark, and no
// overall winner is computed: this is an educational comparison, not a recommendation.
import { analyze } from "./flags.js";
import { durableChecks } from "./durable.js";
import { valueChecks } from "./valuation.js";
import { cagr, lastValue, ratio } from "./series.js";
import { fixed, money, pct, perShare } from "./format.js";
import { glanceRows } from "./views.js";
import { t } from "./i18n.js";

/** Everything the comparison needs about one company. @param {any} d API response @param {number|null} price */
export function prepare(d, price = null) {
  const r = analyze(d);
  return { d, r, v: valueChecks(d, price, r), price };
}

const avg = (/** @type {number[]} */ a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const vals = (/** @type {(number|null)[]} */ a) => /** @type {number[]} */ (a.filter((x) => x != null));
const signed = (/** @type {number|null} */ v) => (v == null ? null : (v > 0 ? "+" : "") + pct(v));

/** Raw numbers for one company (null when not reported or not meaningful). @param {ReturnType<typeof prepare>} ctx */
export function measures(ctx) {
  const { d, r, v, price } = ctx, s = d.series, L = lastValue;
  const equityNonPositive = vals(s.equity).some((x) => x <= 0);
  const eq = L(s.equity), debt = L(s.totalDebt), rev = L(s.revenue);
  const fcf = L(r.fcf);
  const sh = vals(s.dilutedShares);
  const score = (/** @type {any[]} */ list) => {
    const met = list.filter((c) => c.status === "pass").length, judged = list.filter((c) => c.status === "pass" || c.status === "fail").length;
    return { met, judged, share: judged ? met / judged : null };
  };
  const count = (/** @type {string} */ sev) => r.flags.filter((f) => f.sev === sev).length;
  return {
    revenue: rev,
    netIncome: L(s.netIncome),
    revenueCagr: cagr(s.revenue),
    epsCagr: cagr(s.eps),
    dpsCagr: vals(s.dps).some((x) => x > 0) ? cagr(s.dps) : null,
    opMargin: L(ratio(s.operatingIncome, s.revenue)),
    netMargin: L(r.nm),
    avgRoe: equityNonPositive ? null : avg(vals(ratio(s.netIncome, s.equity))),
    rotc: r.financial ? null : v.rotcOverall,
    fcfMargin: fcf != null && rev ? fcf / rev : null,
    debtToEquity: r.financial || eq == null || eq <= 0 || debt == null ? null : debt / eq,
    currentRatio: r.financial ? null : L(ratio(s.currentAssets, s.currentLiabilities)),
    sharesChange: sh.length >= 2 ? sh[sh.length - 1] / sh[0] - 1 : null,
    dps: L(s.dps),
    critical: count("critical"),
    warnings: count("warning"),
    strengths: count("good"),
    graham: score(v.graham),
    buffett: score(v.buffett),
    piotroski: score(v.piotroski),
    durable: score(durableChecks(d, r)),
    pe3: v.pe3,
    pb: v.pb,
    priceVsGraham: price && v.grahamNumber ? price / v.grahamNumber - 1 : null,
    priceVsValue: price && v.iv ? price / v.iv - 1 : null,
    divYield: v.divYield,
    fcfYield: v.fcfYield,
    evFcf: v.evFcf,
  };
}

// [group, key, format, direction]: direction "higher" / "lower" is more favourable; null = no mark.
const HIGHER = "higher", LOWER = "lower";
const ROWS = [
  ["size", "revenue", "money", null],
  ["size", "netIncome", "money", null],
  ["growth", "revenueCagr", "pct", HIGHER],
  ["growth", "epsCagr", "pct", HIGHER],
  ["growth", "dpsCagr", "pct", HIGHER],
  ["profit", "opMargin", "pct", HIGHER],
  ["profit", "netMargin", "pct", HIGHER],
  ["profit", "avgRoe", "pct", HIGHER],
  ["profit", "rotc", "pct", HIGHER],
  ["profit", "fcfMargin", "pct", HIGHER],
  ["balance", "debtToEquity", "ratio", LOWER],
  ["balance", "currentRatio", "ratio", HIGHER],
  ["holders", "sharesChange", "signed", LOWER],
  ["holders", "dps", "perShare", null],
  ["flags", "critical", "count", LOWER],
  ["flags", "warnings", "count", LOWER],
  ["flags", "strengths", "count", HIGHER],
  ["checklists", "graham", "score", HIGHER],
  ["checklists", "buffett", "score", HIGHER],
  ["checklists", "piotroski", "score", HIGHER],
  ["checklists", "durable", "score", HIGHER],
  ["valuation", "pe3", "ratio1", LOWER],
  ["valuation", "pb", "ratio", LOWER],
  ["valuation", "priceVsGraham", "signed", LOWER],
  ["valuation", "priceVsValue", "signed", LOWER],
  ["valuation", "divYield", "pct", HIGHER],
  ["valuation", "fcfYield", "pct", HIGHER],
  ["valuation", "evFcf", "ratio1", LOWER],  // the whole business, debt included: fair between companies that borrow differently
];
export const DIRECTIONS = Object.fromEntries(ROWS.map(([, key, , dir]) => [key, dir]));

/** @param {any} value @param {string} kind @param {string} cur */
function show(value, kind, cur) {
  if (kind === "score") return value.judged ? t("cmp.score", { met: value.met, judged: value.judged }) : t("cmp.na");
  if (value == null || (typeof value === "number" && !isFinite(value))) return t("cmp.na");
  switch (kind) {
    case "money": return money(value, cur);
    case "perShare": return perShare(value, cur);
    case "pct": return pct(value);
    case "signed": return signed(value);
    case "ratio": return t("cmp.ratio", { x: fixed(value, 2) });
    case "ratio1": return fixed(value, 1);
    default: return String(value);
  }
}

/** Which side is more favourable on a measure, or null. Exported for tests. */
export function favourable(a, b, direction) {
  const num = (/** @type {any} */ x) => (x && typeof x === "object" ? x.share : x);
  const x = num(a), y = num(b);
  if (!direction || x == null || y == null || !isFinite(x) || !isFinite(y) || Math.abs(x - y) < 1e-9) return null;
  return (direction === HIGHER) === (x > y) ? "a" : "b";
}

/**
 * Comparison rows grouped by section. Valuation rows appear only when at least one price is entered.
 * @param {ReturnType<typeof prepare>} A @param {ReturnType<typeof prepare>} B
 */
export function compareRows(A, B) {
  const ma = measures(A), mb = measures(B);
  const withPrices = Boolean(A.price || B.price);
  return ROWS.filter(([group]) => group !== "valuation" || withPrices).map(([group, key, kind, direction]) => ({
    group, key,
    label: t(`cmp.metric.${key}`),
    a: A.price || group !== "valuation" ? show(ma[key], kind, A.d.currency) : t("cmp.needPrice"),
    b: B.price || group !== "valuation" ? show(mb[key], kind, B.d.currency) : t("cmp.needPrice"),
    better: group === "valuation" && !(A.price && B.price) ? null : favourable(ma[key], mb[key], direction),
  }));
}

/**
 * A metric indexed to 100 in the first fiscal year both companies report with a positive value, so companies
 * of very different size can share one chart. Years where a value is missing or not positive are null.
 * @param {any} dA @param {any} dB @param {string} metric
 */
export function indexedSeries(dA, dB, metric) {
  const byYear = (/** @type {any} */ d) => new Map(d.years.map((/** @type {number} */ y, /** @type {number} */ i) => [y, d.series[metric][i]]));
  const a = byYear(dA), b = byYear(dB);
  const years = dA.years.filter((/** @type {number} */ y) => b.has(y));
  const start = years.findIndex((y) => a.get(y) > 0 && b.get(y) > 0);
  if (start < 0) return null;
  const span = years.slice(start), baseA = a.get(span[0]), baseB = b.get(span[0]);
  const index = (/** @type {Map<number, number|null>} */ m, /** @type {number} */ base) =>
    span.map((y) => (m.get(y) > 0 ? (m.get(y) / base) * 100 : null));
  return { years: span, a: index(a, baseA), b: index(b, baseB) };
}

/** At-a-glance lines paired by topic. @param {ReturnType<typeof prepare>} A @param {ReturnType<typeof prepare>} B */
export function glancePairs(A, B) {
  const ga = glanceRows(A.d, A.r, A.v), gb = glanceRows(B.d, B.r, B.v);
  const topics = [...new Set([...ga, ...gb].map((row) => row.tab + "|" + row.what))];
  const find = (/** @type {any[]} */ rows, /** @type {string} */ topic) => rows.find((row) => row.tab + "|" + row.what === topic) || null;
  return topics.map((topic) => ({ what: topic.split("|")[1], a: find(ga, topic), b: find(gb, topic) }));
}

/** Graham and Buffett criteria as a grid of statuses. @param {ReturnType<typeof prepare>} A @param {ReturnType<typeof prepare>} B */
export function checklistGrid(A, B) {
  const rows = (/** @type {"graham"|"buffett"} */ who) => A.v[who].map((c, i) => ({ who, name: c.name, a: c.status, b: B.v[who][i].status }));
  return [...rows("graham"), ...rows("buffett")];
}

/** The "needs attention" findings of each company (critical first). @param {ReturnType<typeof prepare>} ctx */
export const attention = (ctx) => ctx.r.flags.filter((f) => f.sev === "critical" || f.sev === "warning");

/** Notes about comparing these two companies (different currency or fiscal year ends). */
export function caveats(dA, dB) {
  const notes = [];
  if (dA.currency !== dB.currency) notes.push(t("cmp.caveat.currency", { a: dA.currency, b: dB.currency }));
  const month = (/** @type {any} */ d) => (d.periodEnds && d.periodEnds.length ? d.periodEnds[d.periodEnds.length - 1].slice(5, 7) : null);
  if (month(dA) && month(dB) && month(dA) !== month(dB)) notes.push(t("cmp.caveat.fiscal"));
  return notes;
}
