// Plain-English explanations: why each red flag matters, and short definitions of the jargon.

// Keyed by flag title (see flags.js). Notes ("info" flags) explain themselves and have no entry.
export const FLAG_HELP = {
  "Revenue is shrinking": "A business that sells less each year usually struggles to grow profits or dividends.",
  "Revenue slightly lower than 10 years ago": "Sales haven't grown in a decade, so any profit growth has to come from cost cuts or buybacks.",
  "Revenue is inconsistent": "Sales that rise and fall make future earnings harder to predict.",
  "Consistent revenue growth": "Steady sales growth is the base for growing profits and dividends.",
  "Recent net losses": "The company recently spent more than it earned; losses eat into cash and shareholders' equity.",
  "Past net losses": "Earlier losses show how the business copes in bad years, even though it's profitable now.",
  "Profitable every year": "Earning a profit through good and bad years is a sign of a resilient business.",
  "Profit margin is shrinking": "The company keeps less of each dollar of sales than before, often because of rising costs or price pressure.",
  "EPS falling over 5 years": "Earnings per share is what each share earns. When it falls, the share price usually follows.",
  "Negative shareholders' equity": "On paper the company owes more than it owns, so there's no accounting cushion if things go wrong.",
  "Very high debt vs equity": "Debt must be repaid whatever happens. Heavy borrowing makes a company fragile when profits dip.",
  "Elevated debt vs equity": "Debt must be repaid whatever happens. More borrowing means more risk if profits fall.",
  "Low leverage": "Little debt gives the company room to ride out downturns and keep investing.",
  "Debt growing faster than revenue": "Borrowing is rising faster than the business itself, which can't continue forever.",
  "Weak short-term liquidity": "Bills due within a year are well above the cash and assets available to pay them.",
  "Current ratio below 1": "Bills due within a year are larger than the cash and assets available to pay them.",
  "Interest not covered": "Operations lost money, so interest on the debt had to be paid from elsewhere.",
  "Interest barely covered": "Operating profit only just pays the interest on the debt, leaving almost no margin.",
  "Thin interest coverage": "Operating profit pays the interest, but a bad year could make that difficult.",
  "Net cash position": "It could pay off all its debt with the cash it already has.",
  "Earnings not backed by cash": "Profits that don't turn into cash can signal aggressive accounting, or money tied up in unpaid invoices and stock.",
  "High-quality earnings": "Reported profits turn into real cash, a sign they're genuine.",
  "Negative free cash flow": "After investing in the business, it spent more cash than it brought in.",
  "Receivables outpacing sales": "Customers owe more relative to sales. They may be paying slower, or sales may be booked early.",
  "Inventory building up": "Unsold stock is piling up faster than sales grow, which can lead to discounts or write-downs.",
  "Large goodwill balance": "Goodwill is the premium paid for acquisitions. If those deals disappoint, it gets written off.",
  "Shareholder dilution": "New shares shrink each existing shareholder's slice of the profits.",
  "Share buybacks": "Buying back shares grows each remaining shareholder's slice of the profits.",
  "Dividend cut": "Companies cut dividends when cash is tight, and it often comes with bad news.",
  "Dividend cut, then suspended": "Companies stop dividends when cash is tight, and it often comes with bad news.",
  "Dividend exceeds earnings": "Paying out more than it earns can't last without borrowing or a cut.",
  "High payout ratio": "Most profits go out as dividends, leaving little buffer if earnings fall.",
  "Dividend not covered by free cash flow": "Dividends are partly funded by borrowing or savings rather than cash the business generated.",
  "Growing dividend": "Regular raises show management's confidence in future cash flow.",
  "Financial statements were restated": "The company said earlier numbers were wrong, a serious warning about its accounting.",
  "Auditor changed": "Auditor changes can be routine, but sometimes follow disagreements over the accounts.",
  "Late SEC filings": "Missing filing deadlines often means trouble closing the books.",
  "Clean filing record": "No accounting warnings in the company's SEC record.",
};

// Short definitions, shown as hover text on abbreviations.
export const TERMS = {
  CAGR: "Compound annual growth rate: the steady yearly growth that would turn the first value into the latest one",
  EPS: "Earnings per share: net income divided by the number of shares",
  "P/E": "Price-to-earnings: share price divided by earnings per share. Lower means cheaper for each dollar of profit",
  "P/B": "Price-to-book: share price divided by book value (assets minus liabilities) per share",
  ROE: "Return on equity: net income as a percentage of shareholders' equity",
  FCF: "Free cash flow: cash from operations minus capital spending",
};

export const abbr = (term) => `<abbr title="${TERMS[term]}">${term}</abbr>`;
