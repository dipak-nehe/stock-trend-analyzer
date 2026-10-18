// The shapes of the data the page gets from the server (backend/*.py), in one place. If the API changes a field, the
// type check points at every place in the page that uses it. Types only: nothing here exists at runtime.

/** One figure per fiscal year, oldest first; null where the filings don't give it. */
export type Series = (number | null)[];

/** The yearly figures the analysis uses (the API sends a few more, read only where named). */
export type SeriesKey =
  | "revenue" | "netIncome" | "grossProfit" | "operatingIncome" | "eps" | "dps" | "dividendsPaid"
  | "operatingCashFlow" | "capex" | "interestExpense" | "researchAndDevelopment" | "depreciation" | "pretaxIncome"
  | "incomeTax" | "dilutedShares" | "totalAssets" | "totalLiabilities" | "equity" | "liabilitiesAndEquity"
  | "currentAssets" | "currentLiabilities" | "cash" | "goodwill" | "receivables" | "retainedEarnings"
  | "treasuryStock" | "preferredStock" | "inventory" | "sga" | "intangibles" | "totalDebt" | "longTermDebt";

/** A serious filing event (8-K items, late-filing notices, auditor changes…). */
export type FilingEvent = { date: string; type: string; form: string; description: string; url: string; title?: string };

export type SecHistory = {
  since: string;
  events: FilingEvent[];
  counts: Record<string, number>;
  industry?: string;
  filingsUrl?: string;
};

/** GET /api/financials?ticker=KO: ten fiscal years of one company's figures. */
export type Financials = {
  ticker: string;
  name: string;
  cik: number;
  currency: string;
  years: number[];
  periodEnds?: string[];
  series: Record<SeriesKey, Series> & Record<string, Series>;
  sources?: Record<string, string[]>;
  splits?: { ratio: number; detectedInFiling?: string }[];
  secHistory?: SecHistory | null;
  sic?: string;
  latestReport?: { form: string; date: string; accession?: string; url: string } | null;
  sharesOutstanding?: { value: number; asOf: string; source?: string } | null;
  /** The latest twelve months, from the newest quarterly reports. */
  ttm?: { asOf: string; values: Partial<Record<SeriesKey, number | null>> } | null;
  secUrl?: string;
  dataAsOf?: string;
  /** Set when SEC couldn't be reached and an older stored copy was served. */
  stale?: boolean;
};

export type InsiderTrade = {
  date: string; type: "buy" | "sell"; shares: number; price: number | null; value: number | null;
  name: string; role: string; planned: boolean; filed: string; url: string;
};

/** GET /api/insiders?ticker=KO: open-market trades by insiders in the last 12 months. */
export type Insiders = {
  since: string;
  until: string;
  filings: number;
  totalFilings: number;
  read: number;
  partial: boolean;
  timedOut: boolean;
  buys: { count: number; shares: number; value: number; insiders: number; planned?: number };
  sells: { count: number; shares: number; value: number; insiders: number; planned?: number };
  trades: InsiderTrade[];
};

/** A fund's return over 1, 5 and 10 years, keyed "1" | "5" | "10" (0.1478 = 14.78% a year). */
export type Returns = Partial<Record<string, number>>;
export type ChartPoint = [string, number];

/** GET /api/fund?ticker=VOO: a mutual fund or ETF from its shareholder report and holdings report. */
export type Fund = {
  ticker: string;
  fund: string;
  shareClass?: string;
  cik: number;
  seriesId: string;
  classId: string;
  form: string;
  filed: string;
  reportUrl: string;
  periodEnd?: string;
  asOf?: string;
  expenseRatio?: number | null;
  costPer10k?: number | null;
  netAssets?: number | null;
  holdings?: number | null;
  turnover?: number | null;
  advisoryFees?: number | null;
  returns: Returns;
  returnsAfterSalesCharge?: Returns | null;
  indexes: { name: string; kind: "broad" | "additional"; returns: Returns }[];
  breakdown?: { by: string; rows: [string, number][] } | null;
  topHoldings?: { count: number; pct: number } | null;
  topTen?: {
    asOf: string; count: number; pct: number;
    rows: { name: string; pct: number; securities: number }[];
    /** [issuer key, % of the fund, name], largest first: for overlap between funds */
    weights: [string, number, string][];
  } | null;
  growth?: { fund: ChartPoint[] | null; index: { name: string; points: ChartPoint[] } | null; inconsistent?: boolean } | null;
  stale?: boolean;
};
