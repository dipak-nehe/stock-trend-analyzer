# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). The public API is `/api/financials` and `/api/insiders`; its response shape is versioned separately by `apiVersion`.

## [Unreleased]

### Added
- A demo GIF at the top of the README.
- A k6 load test (`load/ramp.js`, `npm run load`): 5 → 10 → 15 visitors, then ramp down.
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
