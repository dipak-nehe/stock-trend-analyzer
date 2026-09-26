// Display names for the metrics returned by the API.

export const LABELS = {
  revenue: "Revenue", netIncome: "Net income", operatingIncome: "Operating income", eps: "EPS (diluted)",
  dps: "Dividend / share", dividendsPaid: "Dividends paid", operatingCashFlow: "Operating cash flow",
  capex: "Capital expenditure", fcf: "Free cash flow", interestExpense: "Interest expense", dilutedShares: "Diluted shares",
  totalAssets: "Total assets", totalLiabilities: "Total liabilities", equity: "Shareholders' equity",
  currentAssets: "Current assets", currentLiabilities: "Current liabilities", cash: "Cash & equivalents",
  totalDebt: "Total debt", longTermDebt: "Long-term debt", goodwill: "Goodwill", receivables: "Receivables", inventory: "Inventory",
};

export const labelOf = (k) => LABELS[k] || k;
