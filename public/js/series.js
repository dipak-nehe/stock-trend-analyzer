// Helpers for yearly series: arrays with one value per fiscal year, null where not reported.

export const lastIdx = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; };
export const firstIdx = (arr) => arr.findIndex((v) => v != null);
export const lastValue = (arr) => { const i = lastIdx(arr); return i < 0 ? null : arr[i]; };
export const ratio = (a, b) => a.map((v, i) => (v != null && b[i] != null && b[i] !== 0) ? v / b[i] : null);
export const lastN = (arr, n) => arr.slice(-n).filter((v) => v != null);

// Compound annual growth rate. span = number of years back from the latest value (default: full range).
export function cagr(arr, span) {
  const e = lastIdx(arr); if (e < 0) return null;
  let s = span ? Math.max(0, e - span) : firstIdx(arr);
  while (s < e && arr[s] == null) s++;
  const a = arr[s], b = arr[e], n = e - s;
  if (n < 1 || a == null || a <= 0 || b <= 0) return null;
  return Math.pow(b / a, 1 / n) - 1;
}

export function yoy(arr) {
  return arr.map((v, i) => (i && v != null && arr[i - 1] != null && arr[i - 1] !== 0) ? (v - arr[i - 1]) / Math.abs(arr[i - 1]) : null);
}

// Least-squares slope relative to the mean: a growth-rate stand-in when CAGR is undefined (losses).
export function slopeSign(arr) {
  const pts = arr.map((v, i) => [i, v]).filter((p) => p[1] != null);
  if (pts.length < 3) return 0;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const sl = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  return sl / (Math.abs(my) || 1);
}

export function classify(arr) {
  const vals = arr.filter((v) => v != null);
  if (vals.length < 3) return { label: "Not enough data", cls: "flat", icon: "·", g: null };
  const g = cagr(arr);
  const ups = yoy(arr).filter((v) => v != null);
  const downs = ups.filter((v) => v < -0.02).length;
  const rate = g != null ? g : slopeSign(arr);
  let label, cls, icon;
  if (rate >= 0.10) { label = "Strong growth"; cls = "up"; icon = "▲"; }
  else if (rate >= 0.03) { label = "Growing"; cls = "up"; icon = "▲"; }
  else if (rate > -0.03) { label = "Flat"; cls = "flat"; icon = "▶"; }
  else { label = "Declining"; cls = "down"; icon = "▼"; }
  if (downs >= 3 && cls !== "down") label += ", volatile";
  if (vals.some((v) => v < 0)) label += " (had losses)";
  return { label, cls, icon, g, downs, n: ups.length };
}
