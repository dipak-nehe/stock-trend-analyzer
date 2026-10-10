# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). The public API is `/api/financials` and `/api/insiders`; its response shape is versioned separately by `apiVersion`.

## [Unreleased]

### Fixed
- My portfolio showed an out-of-date list after coming Back from saving S&P 500 picks (it trusted its old address, `?t=KO`, over the saved list) and then saved that over the new picks. It now always shows the list saved in the browser, re-reads it on Back and when another tab saves, and keeps the list out of its address. Opening a shared link no longer replaces your own list: it's shown read-only with *Add these to My portfolio*; *Copy link to share* makes such a link.

### Changed
- The footer's site links (How we calculate, Disclaimer, Source on GitHub) are in the link colour, like the author link; the SEC EDGAR credit stays muted.
- The business-rule unit tests (financial figures, filing history, API responses, insider trades; 80 tests) are now behave (Gherkin) scenarios in `tests/features/`, replacing `tests/test_stock_data.py` and `tests/test_insiders.py`. Same cases, same coverage; they appear in Allure as "1 · Unit" by feature.

### Added
- Company pages (`/stock/KO`): the analysis with the company's own title, description, canonical address and share preview, filled in on the server from the company's name alone (`backend/pages.py`, `api/page.py`); `sitemap.xml` with every S&P 500 company page (rebuilt with the monthly list) and `robots.txt`. `?t=KO` links keep working.
- How we calculate (`methodology.html`, footer link on every page): data sources, growth and trend rules, all 44 red-flag rules with severities, every checklist test and portfolio column, the thresholds that are our own choices, and a link to report wrong numbers. Generated from the same strings as the results pages; English and Spanish.
- Download CSV on the Data tab (every figure as filed, with units), My portfolio and the S&P 500 picks (the table, percentages as numbers). Inside the mobile apps the file is handed to the app's share sheet.
- A fifth balance-sheet check, *Treasury stock held* (shares bought back and kept), on the Durable advantage tab and in the portfolio's balance-sheet column; it doesn't apply when none is held, since many companies cancel bought-back shares. Only checks that can be measured without assumptions were added. *Balance-sheet terms explained* (balance sheet, equity, total liabilities, debt to equity as these checks define it, long-term debt, retained earnings, treasury stock, preferred stock) under the Durable checks, My portfolio and the S&P 500 picks, in English and Spanish.
- S&P 500 pages: `sp500.html` lists the index's ~500 companies (search, sector filter) and lets you pick up to 10; `sp500-view.html` shows the picks side by side in My portfolio's table (live, read-only, Change selection, Save to My portfolio). The list is rebuilt monthly and on demand from Wikipedia and SEC's ticker list (`scripts/build_sp500.py`, *S&P 500 list* workflow). Header button on every page; English and Spanish; unit, builder, browser and accessibility tests.
- My portfolio and the S&P 500 picks: a Buffett criteria column (the Graham & Buffett tab's tests that can be judged without a price, e.g. "7 of 7") and a balance-sheet checks column (the Durable advantage tab's four), shown as "3 of 4" with what wasn't met on hover; sortable, coloured and in the median row.
- My portfolio (`portfolio.html`): a table of your stocks with ten 10-year measures in % (growth in revenue, EPS, dividends, free cash flow and book value per share; net margin, return on equity, return on tangible capital, free-cash-flow margin; share count change per year), sortable, with a median row and colour yardsticks. Saved in the browser and the address; reached from a new header button and *+ Add to my portfolio* on results. English and Spanish; unit, browser and accessibility tests.
- Peter Lynch's growth-at-a-reasonable-price checklist on the Graham & Buffett tab: EPS growth of 10–25% a year over the last 5 years, the PEG ratio, growth plus dividend yield against the P/E, price against his fair value (EPS × growth), and debt at most a third of equity. Uses the same price box; the price tests are N/A above 25% growth. English and Spanish.
- A demo GIF at the top of the README.
- A k6 load test (`load/ramp.js`, `npm run load`): 5 → 10 → 15 visitors, then ramp down.
- A k6 browser load test (`load/ui-ramp.js`, `npm run load:ui`): 5 → 10 → 15 headless Chromium users search a ticker and check the company heading.
- Test coverage in CI: pytest-cov for the Python (minimum 90%) and Node's coverage for the JavaScript logic (minimum 95% of lines), with the numbers in the README.

## [1.0.0] - 2026-09-28

The first release: every feature below is live at <https://stock-value-analysis.vercel.app>.

### Analysis
- 10 years of annual figures from SEC EDGAR XBRL company facts. The latest restated value wins, alternative XBRL tags are tried in turn, and stock splits and foreign reporting currencies are handled.
- An at-a-glance summary plus tabs: Overview, Red flags, SEC history, Insiders, Graham & Buffett, Charts and Data.
- Balance-sheet red flags: falling equity, rising debt, negative free cash flow, dilution and more.
- Graham and Buffett value-investing checklists, and a growth table for the whole period.
- SEC filing history: restatements, auditor changes, late filings, comment letters, and 8-K events (bankruptcy, exchange notices, cyber incidents, write-downs) shown with their official SEC item titles.
- Insider trades from Form 4 filings: open-market buys and sales in the last 12 months, including pre-planned (10b5-1) sales. Loaded only when the Insiders tab is opened.
- A compare page for two stocks side by side.

### Site
- English and Spanish (Spain). The chosen language stays on across every page.
- An investment risk disclaimer page. The search buttons stay disabled until a ticker is entered, and an unknown ticker shows a clear error.
- WCAG checks with axe-core, cookieless Vercel Web Analytics, and share-preview images.

### Backend
- Python standard library only. It runs as a local server and as Vercel serverless functions.
- Results are stored in Upstash Redis, so each ticker is fetched from SEC once and re-checked cheaply after that. Requests are kept within SEC's rate limit.
- `backend/` is split into `stock_data`, `xbrl`, `filings`, `insiders` and `store`. It is fully type-hinted and checked with strict mypy.

### Quality
- About 380 automated tests: pytest (unit, regression on saved SEC filings, HTTP), Node unit tests for the JavaScript, and Playwright (TypeScript, page objects) browser and accessibility tests.
- An Allure report with a screenshot for every step and a video of every browser test.
- CI runs ESLint, Ruff, TypeScript (checkJs), mypy and every test layer. Dependabot keeps dependencies current, and a scheduled check watches the live site.
- Docs: an architecture overview, a test plan, and a list of every end-to-end test.

[Unreleased]: https://github.com/dipak-nehe/stock-trend-analyzer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/dipak-nehe/stock-trend-analyzer/releases/tag/v1.0.0
