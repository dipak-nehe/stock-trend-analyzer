// Number formatting for money, per-share values, percentages and share counts, in the current language.
// English output is hand-built ($416.2B); Spanish follows Spain's conventions (416,2 mil M US$).
import { getLang, getLocale } from "./i18n.js";

const es = () => getLang() === "es";
const dec = (v, d) => new Intl.NumberFormat(getLocale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const suffix = (cur) => (cur === "USD" ? " US$" : ` ${cur}`);

export function money(v, cur, digits = 1) {
  if (v == null || !isFinite(v)) return "–";
  const a = Math.abs(v), sign = v < 0 ? "-" : "";
  if (es()) {
    /** @type {[number, string][]} */
    const units = [[1e12, "B"], [1e9, "mil M"], [1e6, "M"], [1e3, "mil"]];
    for (const [n, u] of units) if (a >= n) return `${sign}${dec(a / n, digits)} ${u}${suffix(cur)}`;
    return `${sign}${dec(a, 2)}${suffix(cur)}`;
  }
  const sym = cur === "USD" ? "$" : "";
  const suf = cur === "USD" ? "" : " " + cur;
  /** @type {[number, string][]} */
  const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [n, u] of units) if (a >= n) return `${sign}${sym}${(a / n).toFixed(digits)}${u}${suf}`;
  return `${sign}${sym}${a.toFixed(2)}${suf}`;
}

export function perShare(v, cur) {
  if (v == null) return "–";
  const sign = v < 0 ? "-" : "";
  if (es()) return `${sign}${dec(Math.abs(v), 2)}${suffix(cur)}`;
  return sign + (cur === "USD" ? "$" : "") + Math.abs(v).toFixed(2) + (cur === "USD" ? "" : " " + cur);
}

export function pct(v, d = 1) {
  if (v == null || !isFinite(v)) return "–";
  return es() ? `${dec(v * 100, d)} %` : (v * 100).toFixed(d) + "%";
}

export function num(v) {
  if (v == null) return "–";
  if (es()) return Math.abs(v) >= 1e9 ? `${dec(v / 1e9, 2)} mil M` : `${dec(v / 1e6, 1)} M`;
  return Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + "B" : (v / 1e6).toFixed(1) + "M";
}

// A plain decimal such as a ratio: 1.41 in English, 1,41 in Spanish.
export const fixed = (v, d) => (es() ? dec(v, d) : v.toFixed(d));
