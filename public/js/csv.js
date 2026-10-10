// CSV downloads: a company's figures (the Data tab) and the stock tables (My portfolio, the S&P 500 picks), as raw
// numbers a spreadsheet can use. Labels follow the page's language; numbers always use a dot for decimals.
import { DATA_GROUPS } from "./views.js";
import { labelOf } from "./labels.js";
import { money, perShare } from "./format.js";
import { COLUMNS } from "./portfolio.js";
import { t } from "./i18n.js";

/** One CSV text from rows of cells: quoted where needed (comma, quote, line break), lines ending in CRLF.
 * @param {(string|number|null|undefined)[][]} rows */
export function toCsv(rows) {
  const cell = (/** @type {any} */ v) => {
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/**
 * The Data tab as rows: Metric, Unit, then one column per fiscal year, with the figures as filed (no rounding).
 * @param {any} d an /api/financials response @param {{ fcf: (number|null)[] }} r its analysis (free cash flow)
 */
export function companyRows(d, r) {
  const unit = (/** @type {Function} */ f) => (f === money ? d.currency : f === perShare ? t("csv.perShare", { cur: d.currency }) : t("csv.shares"));
  const rows = [[t("table.metric"), t("csv.unit"), ...d.years]];
  for (const [, group] of DATA_GROUPS) {
    for (const [k, f] of group) {
      const arr = (k === "fcf" ? r.fcf : d.series[k]) || d.years.map(() => null);
      rows.push([labelOf(k), unit(f), ...arr]);
    }
  }
  return rows;
}

/**
 * A stock table (My portfolio, the S&P 500 picks) as rows: company, ticker, its years, then each column. Percentages
 * as numbers (7.3 for 7.3%), checklist scores as "met of judged", "n/a" when a figure can't be measured.
 * Stocks still loading or not found are left out. @param {import("./stock-table.js").Entry[]} entries
 */
export function tableRows(entries) {
  const rows = [[t("pf.company"), t("csv.ticker"), t("csv.from"), t("csv.to"), ...COLUMNS.map((c) => `${t(`pf.col.${c.key}`)}${c.kind === "score" ? "" : " (%)"}`)]];
  for (const e of entries) {
    if (!e.row) continue;
    const r = e.row;
    rows.push([r.name, r.ticker, r.from, r.to, ...COLUMNS.map((c) => {
      const v = r.cells[c.key];
      if (v.v == null) return t("cmp.na");
      return c.kind === "score" ? t("pf.score", { met: v.met, judged: v.judged }) : Math.round(v.v * 1000) / 10;
    })]);
  }
  return rows;
}

/**
 * Inside the Stock Value apps a web view can't save a file itself, so the app offers to: Android exposes
 * StockValueAndroid.saveFile(name, text), iOS a "saveFile" message handler. Both open the phone's share sheet.
 * Returns the app's saver, or null in a browser. @returns {((name: string, text: string) => void) | null}
 */
export function appFileSaver() {
  const w = /** @type {any} */ (globalThis);
  if (w.StockValueAndroid && typeof w.StockValueAndroid.saveFile === "function") return (name, text) => w.StockValueAndroid.saveFile(name, text);
  const ios = w.webkit && w.webkit.messageHandlers && w.webkit.messageHandlers.saveFile;
  if (ios) return (name, text) => ios.postMessage({ name, text });
  return null;
}

/** Offer a CSV file to save: the browser's download, or the app's share sheet. The byte-order mark lets Excel read
 * accented labels correctly. @param {string} filename @param {(string|number|null|undefined)[][]} rows */
export function downloadCsv(filename, rows) {
  const app = appFileSaver();
  if (app) { app(filename, `\uFEFF${toCsv(rows)}`); return; }
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
