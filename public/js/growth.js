// "Growth over the period": first year vs latest year for key metrics.
import { money, num, pct, perShare } from "./format.js";
import { firstIdx, lastIdx } from "./series.js";
import { labelOf } from "./labels.js";

// Returns { table: <thead>/<tbody> HTML, intro: plain text }.
export function growthView(d, r) {
  const s = d.series, cur = d.currency, Y = d.years, y0 = Y[0], yN = Y[Y.length - 1];
  const rows = [
    ["revenue", money], ["netIncome", money], ["operatingIncome", money], ["eps", perShare], ["dps", perShare],
    ["operatingCashFlow", money], ["fcf", money], ["totalAssets", money], ["equity", money],
    ["totalDebt", money], ["cash", money], ["dilutedShares", (v) => num(v)],
  ];
  const PROFIT = new Set(["netIncome", "operatingIncome", "eps"]);
  const body = rows.map(([k, fmt]) => {
    const arr = k === "fcf" ? r.fcf : s[k];
    const i = firstIdx(arr), j = lastIdx(arr);
    if (i < 0 || i === j) return `<tr><td>${labelOf(k)}</td><td>–</td><td>–</td><td class="nm" colspan="3">Not enough data</td></tr>`;
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
      const why = a === 0 ? (b > 0 ? "Started from zero" : "From zero")
        : a < 0 && b > 0 ? (p ? "From loss to profit" : "From negative to positive")
        : a > 0 && b === 0 ? "Fell to zero"
        : a > 0 && b < 0 ? (p ? "From profit to loss" : "From positive to negative")
        : (p ? "Loss in both years" : "Negative in both years");
      total = `<span class="nm">${why}</span>`; perYear = `<span class="nm">n/m</span>`;
    }
    return `<tr><td>${labelOf(k)}</td><td>${cell(a, i, y0)}</td><td>${cell(b, j, yN)}</td><td>${changeTxt}</td><td>${total}</td><td>${perYear}</td></tr>`;
  }).join("");
  const table = `<thead><tr><th>Metric</th><th>${y0}</th><th>${yN}</th><th>Change</th><th>Total growth</th><th>Per year (CAGR)</th></tr></thead><tbody>${body}</tbody>`;
  const intro = `How much each figure changed from fiscal ${y0} to fiscal ${yN}. A year in brackets means the company first or last reported that item in a different year. Percentages aren't meaningful (n/m) when a value is zero or negative.`;
  return { table, intro };
}
