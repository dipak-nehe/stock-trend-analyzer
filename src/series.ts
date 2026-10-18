// Helpers for yearly series: arrays with one value per fiscal year, null where not reported.
import { t } from "./i18n.ts";
import type { Series } from "./types.ts";

/** A value that's there and above zero (the old code compared null > 0, which is false). */
export const positive = (v: number | null | undefined): v is number => v != null && v > 0;

export const lastIdx = (arr: Series): number => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; };
export const firstIdx = (arr: Series): number => arr.findIndex((v) => v != null);
export const lastValue = (arr: Series): number | null => { const i = lastIdx(arr); return i < 0 ? null : arr[i]; };
export const ratio = (a: Series, b: Series): Series => a.map((v, i) => (v != null && b[i] != null && b[i] !== 0) ? v / (b[i] as number) : null);
export const lastN = (arr: Series, n: number): number[] => arr.slice(-n).filter((v): v is number => v != null);

// Compound annual growth rate. span = number of years back from the latest value (default: full range).
export function cagr(arr: Series, span?: number): number | null {
  const e = lastIdx(arr); if (e < 0) return null;
  let s = span ? Math.max(0, e - span) : firstIdx(arr);
  while (s < e && arr[s] == null) s++;
  const a = arr[s], b = arr[e], n = e - s;
  if (n < 1 || a == null || b == null || a <= 0 || b <= 0) return null;
  return Math.pow(b / a, 1 / n) - 1;
}

export function yoy(arr: Series): Series {
  return arr.map((v, i) => {
    const prev = i ? arr[i - 1] : null;
    return v != null && prev != null && prev !== 0 ? (v - prev) / Math.abs(prev) : null;
  });
}

// Least-squares slope relative to the mean: a growth-rate stand-in when CAGR is undefined (losses).
export function slopeSign(arr: Series): number {
  const pts = arr.map((v, i): [number, number | null] => [i, v]).filter((p): p is [number, number] => p[1] != null);
  if (pts.length < 3) return 0;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const sl = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  return sl / (Math.abs(my) || 1);
}

export function classify(arr: Series) {
  const vals = arr.filter((v): v is number => v != null);
  if (vals.length < 3) return { label: t("trend.notEnough"), cls: "flat" as const, icon: "·", g: null, downs: 0, n: 0 };
  const g = cagr(arr);
  const ups = yoy(arr).filter((v): v is number => v != null);
  const downs = ups.filter((v) => v < -0.02).length;
  const rate = g != null ? g : slopeSign(arr);
  let label: string, cls: "up" | "flat" | "down", icon: string;
  if (rate >= 0.10) { label = t("trend.strong"); cls = "up"; icon = "▲"; }
  else if (rate >= 0.03) { label = t("trend.growing"); cls = "up"; icon = "▲"; }
  else if (rate > -0.03) { label = t("trend.flat"); cls = "flat"; icon = "▶"; }
  else { label = t("trend.declining"); cls = "down"; icon = "▼"; }
  if (downs >= 3 && cls !== "down") label = t("trend.volatile", { label });
  if (vals.some((v) => v < 0)) label = t("trend.losses", { label });
  return { label, cls, icon, g, downs, n: ups.length };
}
