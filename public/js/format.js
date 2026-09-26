// Number formatting for money, per-share values, percentages and share counts.

export function money(v, cur, digits = 1) {
  if (v == null || !isFinite(v)) return "–";
  const sym = cur === "USD" ? "$" : "";
  const suf = cur === "USD" ? "" : " " + cur;
  const a = Math.abs(v), sign = v < 0 ? "-" : "";
  const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [n, u] of units) if (a >= n) return `${sign}${sym}${(a / n).toFixed(digits)}${u}${suf}`;
  return `${sign}${sym}${a.toFixed(2)}${suf}`;
}

export const perShare = (v, cur) => v == null ? "–" : (v < 0 ? "-" : "") + (cur === "USD" ? "$" : "") + Math.abs(v).toFixed(2) + (cur === "USD" ? "" : " " + cur);
export const pct = (v, d = 1) => v == null || !isFinite(v) ? "–" : (v * 100).toFixed(d) + "%";
export const num = (v) => v == null ? "–" : (Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + "B" : (v / 1e6).toFixed(1) + "M");
