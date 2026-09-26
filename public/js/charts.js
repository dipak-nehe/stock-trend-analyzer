// The eight Chart.js charts. Chart.js is loaded as a global from the CDN <script> in index.html.
import { money, pct, perShare } from "./format.js";
import { ratio } from "./series.js";
import { t } from "./i18n.js";
import { labelOf } from "./labels.js";

let charts = [];

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function makeChart(years, id, type, datasets, yFmt, opts = {}) {
  const ctx = /** @type {HTMLCanvasElement} */ (document.getElementById(id));
  const multi = datasets.length > 1;
  const c = new Chart(ctx, {
    type,
    data: { labels: years.map(String), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: multi, position: "top", align: "start", labels: { color: css("--text-2"), boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 } },
        tooltip: { callbacks: { label: (it) => `${it.dataset.label}: ${yFmt(it.raw)}` } },
      },
      scales: {
        x: { grid: { display: false }, border: { color: css("--axis") }, ticks: { color: css("--muted") } },
        y: { grid: { color: css("--grid") }, border: { display: false }, ticks: { color: css("--muted"), callback: (v) => yFmt(v) }, ...(opts.y || {}) },
      },
    },
  });
  charts.push(c);
}

function bars(label, data, color) {
  return { label, data, backgroundColor: color, borderRadius: 4, borderSkipped: "start", maxBarThickness: 28, categoryPercentage: 0.7, barPercentage: 0.9 };
}
function line(label, data, color) {
  return { label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.2, spanGaps: true };
}

export function renderCharts(d, r) {
  charts.forEach((c) => c.destroy()); charts = [];
  const s = d.series, cur = d.currency;
  const s1 = css("--series-1"), s2 = css("--series-2"), s3 = css("--series-3");
  const m = (v) => money(v, cur), ps = (v) => perShare(v, cur), pc = (v) => pct(v, 0);
  makeChart(d.years, "cRevenue", "bar", [bars(labelOf("revenue"), s.revenue, s1), bars(labelOf("netIncome"), s.netIncome, s2)], m);
  makeChart(d.years, "cEps", "line", [line(t("chart.eps"), s.eps, s1)], ps);
  makeChart(d.years, "cDps", "bar", [bars(labelOf("dps"), s.dps, s1)], ps);
  makeChart(d.years, "cPayout", "line", [line(t("chart.payout"), ratio(s.dividendsPaid, s.netIncome), s1)], pc);
  makeChart(d.years, "cBalance", "bar", [bars(t("chart.assets"), s.totalAssets, s1), bars(t("chart.liabilities"), s.totalLiabilities, s2), bars(t("chart.equity"), s.equity, s3)], m);
  makeChart(d.years, "cDebt", "line", [line(labelOf("totalDebt"), s.totalDebt, s2), line(t("chart.cash"), s.cash, s1)], m);
  makeChart(d.years, "cCash", "line", [line(labelOf("operatingCashFlow"), s.operatingCashFlow, s1), line(labelOf("netIncome"), s.netIncome, s2), line(labelOf("fcf"), r.fcf, s3)], m);
  makeChart(d.years, "cMargin", "line", [line(t("chart.operatingMargin"), ratio(s.operatingIncome, s.revenue), s1), line(t("chart.netMargin"), r.nm, s2)], pc);
}
