# Stock Trend Analyzer

Type a stock ticker and get 10 years of revenue, earnings, and dividend trends, plus an automated check of the balance sheet and cash flows for red flags. All data comes from the company's own annual filings through the free **SEC EDGAR** API.

![Apple analysis](docs/screenshot.png)

## Features

- **10-year trends** for revenue, net income, EPS, and dividend per share, with CAGR and a trend label (growing, flat, declining, volatile).
- **Red-flag engine** that grades 20+ checks as *critical*, *warning*, or *strength*:
  - Growth: shrinking or inconsistent revenue, margin compression, falling EPS
  - Profitability: recent or past net losses
  - Leverage and liquidity: debt/equity, debt growing faster than revenue, current ratio, interest coverage, negative equity, large goodwill
  - Earnings quality: operating cash flow below net income, negative free cash flow, receivables or inventory growing faster than sales
  - Shareholders: dilution vs buybacks, dividend cuts or suspension, payout above 100%, dividends not covered by free cash flow
- **SEC filing history** from the company's EDGAR record: restatement warnings (8-K item 4.02), auditor changes (8-K item 4.01), late-filing notices (NT 10-K / NT 10-Q), amended annual reports, and SEC staff comment letters with the company's replies. Each entry links to the original document, and the serious ones also feed the red flags.
- **Value investing checklists** that score the company against Benjamin Graham's defensive-investor criteria (*The Intelligent Investor*, ch. 14: size, current ratio, debt vs working capital, earnings stability, dividend record, EPS growth, P/E, P/B) and Buffett-style business-quality tests (consistent earnings, ROE, debt vs earnings, margins, capital needs, buybacks, margin of safety). The page also shows the Graham Number and a simple owner-earnings (free cash flow) value estimate. Enter an optional share price to run the valuation tests; it's kept in the URL (`?t=KO&p=68`). Results are shown as criteria met or not met, never as buy/sell ratings.
- **Growth over the period** table: first year vs latest year for revenue, earnings, EPS, dividends, cash flow, balance-sheet items and share count, with the change, total % growth and per-year growth (CAGR). Sign changes such as "from profit to loss" are spelled out.
- **Eight charts** (Chart.js) and a full data table, in light and dark mode.
- **Stock-split adjustment.** EDGAR never restates old per-share values, so the server detects splits from restated EPS in later filings and adjusts older EPS, dividends, and share counts.
- **Handles banks and insurers.** Leverage and liquidity rules that don't apply to them are skipped.
- **Foreign filers** (20-F / 40-F, IFRS) are pinned to their reporting currency, so USD convenience translations are never mixed in.

## Run it locally

Requires Python 3.9+. It has no third-party dependencies.

```bash
export SEC_USER_AGENT="StockTrendAnalyzer your-email@example.com"   # required by SEC's fair-access policy
python3 server.py
```

Open <http://localhost:8000>, or link straight to a ticker with `http://localhost:8000/?t=KO`.
To use a different port, run `PORT=8001 python3 server.py`.

## Deploy to Vercel (free)

1. Sign in at [vercel.com](https://vercel.com) with GitHub, click **Add New → Project**, and import this repo.
2. Leave the framework preset as **Other**. No build command is needed.
3. Under **Environment Variables**, add `SEC_USER_AGENT` = `StockTrendAnalyzer your-email@example.com`.
4. Click **Deploy**. Every push to `main` redeploys automatically.

API responses are cached on Vercel's CDN for a day (`s-maxage=86400`), so repeat lookups never reach SEC.

## Project structure

```
public/index.html     one-page UI: trends, red-flag rules, charts (Chart.js)
public/favicon.svg    icon; public/og.png is the link-preview image
api/financials.py     Vercel serverless function: GET /api/financials?ticker=AAPL
stock_data.py         SEC EDGAR fetching and normalization, shared by both servers
server.py             local development server (same API, serves public/)
vercel.json           function settings and security headers
```

## How it works

```
Browser (public/index.html) ──/api/financials?ticker=KO──▶ api/financials.py ──▶ SEC EDGAR
   trends, flags,                                         (or server.py locally)
   charts, table   ◀────────── normalized JSON ──────────  stock_data.py: ticker → CIK,
                                                           10-K facts → 10 fiscal years
```

- **`stock_data.py`** (used by `server.py` locally and `api/financials.py` on Vercel) maps the ticker to a CIK and downloads the XBRL *company facts*. For each metric it keeps only full-year values from annual reports and prefers the latest (restated) filing. It falls back through alternative XBRL tags, since companies label revenue and similar items differently. Responses are cached in memory and on the CDN. A small backend is needed because SEC's API doesn't allow direct browser (CORS) requests.
- **`public/index.html`** is a single page with plain JavaScript. It computes CAGRs, classifies trends, runs the red-flag rules, and renders the charts.

## Limitations

- Covers companies that file with the SEC only.
- Some companies don't tag every item (for example, Berkshire Hathaway has no EPS tag). Checks that need missing data are skipped, and the page says so.
- "Debt" uses the company's reported long-term debt tag, which may or may not include the current portion.
- This is an automated screen, **not investment advice**. Check the actual filings before making decisions.

## License

MIT
