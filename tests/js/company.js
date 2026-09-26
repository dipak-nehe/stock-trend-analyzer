// Builds a synthetic API response (ten fiscal years) for the JavaScript unit tests.
// Defaults describe a steady, healthy company; pass overrides for the series a test cares about.

// A fixed decade (not "the last 10 years from today"), so expected text such as "Net loss in: 2025" never
// changes with the calendar. The app itself always takes the latest 10 fiscal years from the filings.
export const FIRST_YEAR = 2016;
export const YEARS = Array.from({ length: 10 }, (_, i) => FIRST_YEAR + i);
const grow = (start, rate) => YEARS.map((_, i) => Math.round(start * Math.pow(1 + rate, i)));
const nulls = () => YEARS.map(() => null);

export function company(overrides = {}, extra = {}) {
  const series = {
    revenue: grow(1000e6, 0.06),
    netIncome: grow(100e6, 0.08),
    operatingIncome: grow(150e6, 0.08),
    grossProfit: grow(450e6, 0.06),
    eps: grow(100, 0.08).map((v) => v / 100),
    dps: grow(40, 0.05).map((v) => v / 100),
    dividendsPaid: grow(40e6, 0.05),
    operatingCashFlow: grow(130e6, 0.08),
    capex: grow(30e6, 0.06),
    interestExpense: YEARS.map(() => 10e6),
    dilutedShares: YEARS.map((_, i) => 100e6 - i * 1e6),
    totalAssets: grow(2000e6, 0.05),
    totalLiabilities: grow(1000e6, 0.05),
    equity: grow(1000e6, 0.05),
    currentAssets: YEARS.map(() => 600e6),
    currentLiabilities: YEARS.map(() => 250e6),
    cash: YEARS.map(() => 200e6),
    totalDebt: YEARS.map(() => 300e6),
    longTermDebt: YEARS.map(() => 250e6),
    goodwill: YEARS.map(() => 100e6),
    receivables: grow(100e6, 0.06),
    inventory: grow(80e6, 0.06),
    ...overrides,
  };
  return {
    ticker: "TEST", name: "Test Co", cik: 1, currency: "USD", years: YEARS,
    series, splits: [], sharesOutstanding: { value: 91e6, asOf: "2026-01-31" },
    secHistory: { since: "2016-01-01", events: [], counts: {}, industry: "Widgets", filingsUrl: "https://www.sec.gov/x" },
    secUrl: "https://www.sec.gov/y",
    ...extra,
  };
}

export const events = (...list) => list.map(([type, date]) => ({ type, date, form: "8-K", description: type, url: "https://www.sec.gov/z" }));
export const history = (evts) => {
  const counts = {};
  for (const e of evts) counts[e.type] = (counts[e.type] || 0) + 1;
  return { since: "2016-01-01", events: evts, counts, industry: "Widgets", filingsUrl: "https://www.sec.gov/x" };
};
export { nulls };
