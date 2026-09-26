// The eight Chart.js charts. Chart.js is loaded as a global from the CDN <script> in index.html.
import { money, pct, perShare } from "./format.js";
import { ratio } from "./series.js";

let charts = [];

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function makeChart(years, id, type, datasets, yFmt, opts = {}) {
  const ctx = document.getElementById(id);
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
  makeChart(d.years, "cRevenue", "bar", [bars("Revenue", s.revenue, s1), bars("Net income", s.netIncome, s2)], m);
  makeChart(d.years, "cEps", "line", [line("EPS", s.eps, s1)], ps);
  makeChart(d.years, "cDps", "bar", [bars("Dividend / share", s.dps, s1)], ps);
  makeChart(d.years, "cPayout", "line", [line("Payout ratio", ratio(s.dividendsPaid, s.netIncome), s1)], pc);
  makeChart(d.years, "cBalance", "bar", [bars("Assets", s.totalAssets, s1), bars("Liabilities", s.totalLiabilities, s2), bars("Equity", s.equity, s3)], m);
  makeChart(d.years, "cDebt", "line", [line("Total debt", s.totalDebt, s2), line("Cash", s.cash, s1)], m);
  makeChart(d.years, "cCash", "line", [line("Operating cash flow", s.operatingCashFlow, s1), line("Net income", s.netIncome, s2), line("Free cash flow", r.fcf, s3)], m);
  makeChart(d.years, "cMargin", "line", [line("Operating margin", ratio(s.operatingIncome, s.revenue), s1), line("Net margin", r.nm, s2)], pc);
}
