// "Growth over the period": first year vs latest year for key metrics.
import { money, num, pct, perShare } from "./format.js";
import { firstIdx, lastIdx } from "./series.js";
import { labelOf } from "./labels.js";
import { abbr } from "./help.js";
import { t } from "./i18n.js";

// Returns { table: <thead>/<tbody> HTML, intro: plain text }.
export function growthView(d, r) {
  const s = d.series, cur = d.currency, Y = d.years, y0 = Y[0], yN = Y[Y.length - 1];
  /** @typedef {(v: number, cur?: string) => string} Fmt */
  /** @type {(string | [string, Fmt])[]} Group headings (strings) and [metric, formatter] rows. */
  const rows = [
    "group.income", ["revenue", money], ["operatingIncome", money], ["netIncome", money],
    "group.perShare", ["eps", perShare], ["dps", perShare], ["dilutedShares", (v) => num(v)],
    "group.cashFlow", ["operatingCashFlow", money], ["fcf", money],
    "group.balance", ["totalAssets", money], ["equity", money], ["totalDebt", money], ["cash", money],
  ];
  const PROFIT = new Set(["netIncome", "operatingIncome", "eps"]);
  const body = rows.map((row) => {
    if (typeof row === "string") return `<tr class="group"><th colspan="6">${t(row)}</th></tr>`;
    const [k, fmt] = row;
    const arr = k === "fcf" ? r.fcf : s[k];
    const i = firstIdx(arr), j = lastIdx(arr);
    if (i < 0 || i === j) return `<tr><td>${labelOf(k)}</td><td>–</td><td>–</td><td class="nm" colspan="3">${t("growth.notEnough")}</td></tr>`;
    const a = arr[i], b = arr[j], n = j - i;
    const cell = (v, idx, headerYear) => `${fmt(v, cur)}${Y[idx] !== headerYear ? `<span class="yr">(${Y[idx]})</span>` : ""}`;
    const change = b - a;
    const changeTxt = k === "dilutedShares" ? (change >= 0 ? "+" : "-") + num(Math.abs(change)) : (change >= 0 ? "+" : "") + fmt(change, cur);
    let total, perYear;
    if (a > 0 && b > 0) {
      const g = b / a - 1;
      total = `${g >= 0 ? "▲" : "▼"} ${pct(Math.abs(g), g >= -0.995 && Math.abs(g) < 10 ? 1 : 0)}`;
      perYear = `${pct(Math.pow(b / a, 1 / n) - 1)}`;
    } else {
      const p = PROFIT.has(k);
      const why = a === 0 ? (b > 0 ? "startedZero" : "fromZero")
        : a < 0 && b > 0 ? (p ? "lossToProfit" : "negToPos")
        : a > 0 && b === 0 ? "fellToZero"
        : a > 0 && b < 0 ? (p ? "profitToLoss" : "posToNeg")
        : (p ? "lossBoth" : "negBoth");
      total = `<span class="nm">${t(`growth.${why}`)}</span>`; perYear = `<span class="nm">${t("growth.nm")}</span>`;
    }
    return `<tr><td>${labelOf(k)}</td><td>${cell(a, i, y0)}</td><td class="latest">${cell(b, j, yN)}</td><td>${changeTxt}</td><td>${total}</td><td>${perYear}</td></tr>`;
  }).join("");
  const table = `<thead><tr><th>${t("table.metric")}</th><th>${y0}</th><th class="latest">${yN}</th><th>${t("growth.change")}</th><th>${t("growth.total")}</th><th>${t("growth.perYear", { cagr: abbr("CAGR") })}</th></tr></thead><tbody>${body}</tbody>`;
  const intro = t("growth.intro", { y0, yN });
  return { table, intro };
}
