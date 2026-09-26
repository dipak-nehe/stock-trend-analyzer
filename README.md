# Stock Trend Analyzer

[![tests](https://github.com/dipak-nehe/stock-trend-analyzer/actions/workflows/tests.yml/badge.svg)](https://github.com/dipak-nehe/stock-trend-analyzer/actions/workflows/tests.yml)

**Live site: [stock-value-analysis.vercel.app](https://stock-value-analysis.vercel.app/)** · try [AAPL](https://stock-value-analysis.vercel.app/?t=AAPL), [KO](https://stock-value-analysis.vercel.app/?t=KO), [SMCI](https://stock-value-analysis.vercel.app/?t=SMCI)

Type a stock ticker and get 10 years of revenue, earnings, and dividend trends, plus an automated check of the balance sheet and cash flows for red flags. All data comes from the company's own annual filings through the free **SEC EDGAR** API.

![Apple analysis](docs/screenshot.png)

## Features

- **At a glance, then tabs.** Results open with six one-line verdicts (revenue, earnings, dividend, red flags, SEC record, value checklists). The detail sits in tabs: Overview, Red flags, SEC history, Graham & Buffett, Charts and Data. Each tab ends with Previous/Next buttons, the landing-page guide is organised by the same tabs, and the link remembers the tab, e.g. `?t=SMCI#flags`.
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
- **Plain-English explanations:** every red flag says why it matters; flags are grouped into *Needs attention*, *Going well* and *Notes*; jargon has hover definitions and a "Terms explained" glossary; trend tiles show a 10-year sparkline; tables are grouped by statement with the latest year highlighted.
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

## Tests

191 automated tests run on every push (GitHub Actions). They never call SEC: they use trimmed real filings saved in `tests/fixtures/`, so they're fast, offline and repeatable.

| Layer | What it covers |
|---|---|
| **Unit** (`tests/test_stock_data.py`, 46 tests) | Hand-built filings for the tricky rules: restated values, stock splits (forward and reverse), foreign currency, liabilities with minority interest, debt when tags change between years, dividend fallbacks, filing classification, input validation, error handling, cache headers |
| **Regression** (`tests/test_regression.py`, 42 tests) | Real Apple, Coca-Cola, Intel, JPMorgan and Super Micro filings. Figures are pinned to values cross-checked against published financials for fiscal 2021–2025. |
| **HTTP** (`tests/test_server.py`, 19 tests) | Local server and Vercel function give identical responses. Source files can't be downloaded. Bad input is rejected. |
| **JavaScript unit** (`tests/js/`, 41 tests) | The browser-side logic, run in Node with no dependencies: formatting, CAGR and trend labels, every red-flag rule, the Graham/Buffett checklists and value estimate, the growth table and filing-history views |
| **End-to-end** (`tests/e2e/`, 43 tests) | Playwright drives the real page in Chromium: the results guide, the at-a-glance card and tabs (including keyboard navigation and links to a tab), search, charts, red flags, filing-history filters, price-based valuation, bank handling, errors, disclaimer, phone layout, and no JavaScript errors. |

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m playwright install chromium

.venv/bin/pytest                 # everything, about 6 seconds
.venv/bin/pytest -m "not e2e"    # skip the browser tests
node --test tests/js/*.test.js   # JavaScript unit tests (Node 20+)
```

To refresh the saved filings, run `SEC_USER_AGENT="App you@example.com" python3 tests/make_fixtures.py`. Then update any pinned values that changed.

## Project structure

```
public/index.html     page layout and styles
public/vendor/        Chart.js 4.4.1 (MIT), served from the site so no third-party request can block the page
public/js/            ES modules: app.js wires the page; flags.js (red-flag rules),
                      valuation.js (Graham/Buffett), growth.js, history.js, views.js and
                      charts.js; format.js, series.js and labels.js hold shared helpers
public/favicon.svg    icon; public/og.png is the link-preview image
api/financials.py     Vercel serverless function: GET /api/financials?ticker=AAPL
stock_data.py         SEC EDGAR fetching and normalization, shared by both servers
server.py             local development server (same API, serves public/)
vercel.json           function settings and security headers
tests/                unit, regression, HTTP and Playwright end-to-end tests (+ saved SEC fixtures)
.github/workflows/    CI: runs the tests on every push
```

## How it works

```
Browser (public/index.html) ──/api/financials?ticker=KO──▶ api/financials.py ──▶ SEC EDGAR
   trends, flags,                                         (or server.py locally)
   charts, table   ◀────────── normalized JSON ──────────  stock_data.py: ticker → CIK,
                                                           10-K facts → 10 fiscal years
```

- **`stock_data.py`** (used by `server.py` locally and `api/financials.py` on Vercel) maps the ticker to a CIK and downloads the XBRL *company facts*. For each metric it keeps only full-year values from annual reports and prefers the latest (restated) filing. It falls back through alternative XBRL tags, since companies label revenue and similar items differently. Responses are cached in memory and on the CDN. A small backend is needed because SEC's API doesn't allow direct browser (CORS) requests.
- **`public/js/`** holds plain-JavaScript ES modules with no build step. The analysis modules are pure functions (data in, results or HTML out), so they're unit-tested in Node. Only `app.js` and `charts.js` touch the page.

## Limitations

- Covers companies that file with the SEC only.
- Some companies don't tag every item (for example, Berkshire Hathaway has no EPS tag). Checks that need missing data are skipped, and the page says so.
- "Total debt" is long-term debt (including the part due within a year) plus short-term borrowings; lease liabilities are not included, so it can be lower than totals on sites that add leases.
- This is an automated screen, **not investment advice**. Check the actual filings before making decisions.

## License

MIT
