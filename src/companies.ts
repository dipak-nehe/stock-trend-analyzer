// The All companies page (companies.html): every US-listed company SEC knows a ticker for, with its exchange and
// industry, from public/data/companies.json (rebuilt monthly by scripts/build_companies.py). Search, filter, sort and
// show a page at a time. No page code here, so it can be unit-tested; companies-app.ts puts it on the page.

/** [ticker, name, exchange, 4-digit SIC or ""]: compact, as there are about 10,400. */
export type Row = [string, string, string, string];
export type Directory = { generated: string; source?: string; count: number; industries: Record<string, string>; companies: Row[] };
export type SortKey = "name" | "ticker" | "exchange" | "industry";
export type Query = { text?: string; industry?: string; exchange?: string; sort?: SortKey; dir?: 1 | -1 };

export const PAGE_SIZE = 100;

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The rows matching a query: the search text matches a ticker that starts with it or a name containing every word of
 * it; industry is a SIC code, or a 2-digit major group ("28" = chemicals and drugs); exchange as in the file. Sorted by
 * the chosen column (names A-Z by default); ties keep name order. An exact ticker match comes first.
 */
export function findCompanies(dir: Directory, q: Query = {}): Row[] {
  const text = (q.text ?? "").trim(), words = fold(text) ? fold(text).split(" ") : [];
  const asTicker = text.toUpperCase().replace(/[./]/g, "-");
  const ind = q.industry ?? "";
  const rows = dir.companies.filter(([t, n, ex, sic]) =>
    (!q.exchange || ex === q.exchange)
    && (!ind || (ind.length === 2 ? sic.startsWith(ind) : sic === ind))
    && (!words.length || t.replace(/[./]/g, "-").startsWith(asTicker) || words.every((w) => fold(n).includes(w))));
  const key = q.sort ?? "name", sign = q.dir ?? 1;
  const value = (r: Row): string => key === "ticker" ? r[0] : key === "exchange" ? r[2] : key === "industry" ? industryOf(dir, r) : r[1].toLowerCase();
  const sorted = key === "name" && sign === 1 ? rows : [...rows].sort((a, b) => {
    const x = value(a), y = value(b);
    if (!x !== !y) return x ? -1 : 1;   // blanks (no industry) last, whichever the direction
    return sign * x.localeCompare(y);
  });
  if (asTicker) {
    const exact = sorted.findIndex((r) => r[0] === asTicker);
    if (exact > 0) sorted.unshift(...sorted.splice(exact, 1));
  }
  return sorted;
}

export const industryOf = (dir: Directory, row: Row): string => (row[3] ? dir.industries[row[3]] ?? "" : "");

/** The industries for the filter, A-Z by name: [code, name, how many companies]. */
export function industryOptions(dir: Directory): [string, string, number][] {
  const n = new Map<string, number>();
  for (const r of dir.companies) if (r[3]) n.set(r[3], (n.get(r[3]) ?? 0) + 1);
  return [...n.entries()].map(([code, count]): [string, string, number] => [code, dir.industries[code] ?? code, count])
    .sort((a, b) => a[1].localeCompare(b[1]));
}

/** The exchanges in the file, the largest first: [exchange, how many]. */
export function exchangeOptions(dir: Directory): [string, number][] {
  const n = new Map<string, number>();
  for (const r of dir.companies) n.set(r[2], (n.get(r[2]) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** The next sort after clicking a column: a new column starts A-Z, the same column reverses. */
export const nextSort = (cur: { sort: SortKey; dir: 1 | -1 }, key: SortKey): { sort: SortKey; dir: 1 | -1 } =>
  cur.sort === key ? { sort: key, dir: cur.dir === 1 ? -1 : 1 } : { sort: key, dir: 1 };
