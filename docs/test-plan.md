# Test plan: 10-Year Stock Value Analysis (web app)

How the web app is tested: what is covered, at which level, with what data, and what "done" means. The companion list of every browser test is [e2e-tests.md](e2e-tests.md). The Android and iOS apps have their own plan in [stock-value-mobile](https://github.com/dipak-nehe/stock-value-mobile/blob/main/docs/test-plan.md).

**At a glance:** 384 automated tests in five layers, all run on every push by GitHub Actions in about 3 minutes. None of them calls SEC: they use trimmed real filings saved in `tests/fixtures/`. Latest report: https://stock-trend-test-report.vercel.app.

## 1. Scope

**In scope**
- The Python backend (`backend/`, `server.py`, `api/financials.py`): reading SEC filings, building ten-year series, split and restatement handling, filing history (8-K items, late filings, amendments, SEC letters), the stored-results cache, the HTTP API.
- The page's JavaScript (`public/js/`): formatting, trends, red-flag rules, Graham and Buffett checklists, value estimates, the filing-history view, the compare rules, translations.
- The pages as a person uses them (`index.html`, `compare.html`, `disclaimer.html`): search, results tabs, charts, price-based valuation, compare, language switching, Home, errors, phone layout.
- Accessibility (WCAG 2.0/2.1/2.2 A and AA) and keyboard use.

**Out of scope here**
- The Android and iOS apps (tested in the mobile repo, including the web pages *inside* the apps).
- Browsers other than Chromium, load and performance testing, visual pixel comparison (see §9).
- SEC itself: the live site is checked separately every 6 hours (§7).

## 2. Risks the tests address

| Risk | Why it matters | Covered by |
|---|---|---|
| Wrong numbers | Investors act on them; SEC tags change between years and companies | Unit rules + regression values pinned against published financials |
| Misleading labels | A "red flag" or wording that says more than the filing does | JS rule tests, wording checks in browser tests |
| Stale or mixed data after a deploy | Browser/CDN caches, stored results in an old format | Cache-header and store tests, versioned API |
| Broken page for real users | Search, tabs, errors, phone layout, language | Browser tests (Playwright) |
| Excluding people | Screen readers, keyboard-only use, contrast in dark mode | axe-core on every state + keyboard tests |
| Leaking the server's code or failing badly | Public site | HTTP tests: source files blocked, bad input rejected, friendly errors |

## 3. Test levels

| Layer | Tool | Files | Tests | What it proves |
|---|---|---|---|---|
| 0 · JavaScript unit | Node's built-in test runner | `tests/js/*.test.js` | 69 | Formatting, CAGR and trend labels, every red-flag rule, checklists and value estimate, history and compare views, translations |
| 1 · Unit: business rules | behave (Gherkin) | `tests/features/*.feature` | 80 | Hand-built filings for tricky rules, as Given / When / Then scenarios: restatements, splits, currency, minority interest, debt tags, 8-K item classification, insider trades (Form 4), input validation, errors, cache headers |
| 1 · Unit: storage | pytest | `tests/test_store.py` | 32 | Stored results in memory, files and Redis (fake Upstash server): expiry, keys, failures as a miss |
| 2 · Regression | pytest | `tests/test_regression.py` | 47 | Real Apple, Coca-Cola, Intel, JPMorgan and Super Micro filings; figures pinned to values checked against published financials (fiscal 2021–2025) |
| 3 · HTTP | pytest | `tests/test_server.py` | 25 | Local server and Vercel function answer identically; source files can't be downloaded; bad input rejected |
| 4 · End-to-end | Playwright Test (TypeScript), Chromium | `e2e/ui.spec.ts`, `e2e/compare.spec.ts` | 94 | The two pages driven like a person, against the real server on saved filings |
| 5 · Accessibility | Playwright + axe-core | `e2e/accessibility.spec.ts` | 37 | No WCAG A/AA violations on every page state, light and dark, English and Spanish, desktop and phone; keyboard-only use |
| | | | **384** | |

Static checks run first: ESLint and TypeScript (checkJs) for the JavaScript, Ruff for the Python, strict TypeScript for the browser tests (`npm run check`).

## 4. Environments and test data

- **Offline and repeatable:** `tests/fixtures/` holds trimmed real SEC data for five companies, plus their Form 4 filings for the 12 months to 26 September 2026 (the tests fix "today" to that date with `STOCK_DATA_TODAY`, so the insider window never moves) chosen for coverage: AAPL (large, splits), KO (clean record, dividends), INTC (losses, minority interest, acquisitions), JPM (a bank: different rules), SMCI (restatement, auditor changes, 13 late filings, 14 exchange notices). Refresh with `tests/make_fixtures.py`, then update pinned values.
- **Browser tests** start the real Python server with SEC replaced by the fixtures and an in-memory store (`tests/e2e_server.py`, via `playwright.config.ts`). Chromium, 1280 × 720 by default; phone tests at 375 px.
- **Regression values** were cross-checked by hand against a public financial site before being pinned; a changed value needs a reason (e.g. a restatement), not just an update.

## 5. Approach and conventions

- **Page objects:** every element the browser tests use is defined once in `e2e/pages/` (`BasePage`, `AnalysisPage`, `ComparePage`); specs contain no selectors.
- **Locator order:** role or label (in English or Spanish) → text → `data-testid` for content → `#id` when a control's name is incidental text → commented CSS for decorative parts → never XPath.
- **Named steps with screenshots:** each step of a browser test attaches a screenshot; every browser test also has a video (640 × 360). Failures add a Playwright trace and, for accessibility, the full axe output.
- **Prove a regression test works:** a test written for a bug is run against the old code first and must fail (e.g. the off-screen error and the empty-search tests).
- **Test what a person sees:** errors must be *in the viewport*, not just present; lookups are tested by typing, not only by opening a URL.
- **One behaviour per test, descriptive names:** the test name says the expected behaviour ("a wrong ticker after a result replaces it, and the address follows").

## 6. Traceability: features and their tests

| Feature | Unit / JS | Browser (e2e) | Accessibility |
|---|---|---|---|
| Search, examples, input validation | ticker rules (unit) | search, chips, invalid input, empty box disabled, Enter does nothing, script-load race | search by keyboard |
| Errors (unknown / malformed ticker, SEC down) | error mapping (unit, HTTP) | error under the search box and in view, address follows, translated, saved-copy notice | error state |
| At a glance and tabs | views (JS) | tab tour, notes, badges, glance rows, deep links, keyboard, previous/next | every tab, light and dark |
| Ten-year figures and growth | series, splits, restatements (unit), pinned values (regression) | trends, growth table, loss-making wording | — |
| Red flags | every rule (JS) | grouped flags with explanations, SMCI critical flags | flags tab |
| SEC filing history | 8-K classification, multi-item filings (unit), real counts (regression) | tiles, filters, official SEC titles, exchange notices | history tab |
| Graham & Buffett, price valuation | checklists and estimates (JS) | price in URL, cleared on new search, scores add up, bank rules | value tab |
| Compare page | compare rules (JS) | link, pre-load, marks, prices, swap, deep links, same/unknown ticker, empty boxes, phone width | compare states |
| Language (EN/ES) | i18n (JS) | Spanish link, browser language, switching keeps state, remembered choice (from the button or a link) across every page, no English left | Spanish page |
| Caching and stored results | cache headers, store versions and fallback (unit) | data-fetched time | — |
| Disclaimer (short notice and full page) | — | notice always visible, links from both pages, Spanish, language switch | disclaimer page, EN/ES, light/dark |
| Insider trades (Form 4) | parsing, codes, roles, pre-planned flag, 12-month window, cap and partial summaries, stored filings, other-issuer filings ignored, its own endpoint that the main results never wait for, a failed summary never stored (unit, HTTP); real counts for KO, INTC, AAPL, SMCI, JPM (regression); the tab's section, loading/error states and buying note; never a red flag (JS) | loaded only when the Insiders tab opens (and once), a link straight to the tab, totals, trades and links for KO, Try again after a failure, the buying note for INTC, Spanish | Insiders tab |
| Security and privacy | source files blocked (HTTP) | nothing loaded from other sites, analytics off locally | — |

## 7. CI and reporting

- **`.github/workflows/tests.yml`** on every push and pull request: static checks, then all five layers; each layer runs even if an earlier one failed, so the report is complete.
- **Allure report** (single HTML file): groups 0–5 as above, screenshots per step, video per browser test. Published to https://stock-trend-test-report.vercel.app from `main`, and kept as the `allure-report` artifact on every run.
- **Live site check** (`health.yml`, every 6 hours): the real site and a real SEC lookup.
- **Dependabot** opens grouped updates weekly; CI must pass before merging.

## 8. Entry and exit criteria

- **Before pushing:** `npm run check`, the JavaScript tests, pytest and the Playwright suite pass locally.
- **Done (merge or release):** CI green on all layers, zero axe violations, and any new behaviour has a test that names it. A bug fix includes a test that failed on the old code.
- **Numbers:** a changed pinned value needs an explanation in the commit (restatement, new filing, definition change).

## 9. Known gaps and next steps

- **Chromium only:** Firefox and WebKit (Safari) aren't run. Safari's engine is exercised indirectly by the iOS app's tests.
- **No visual regression:** layout is checked by assertions (e.g. no horizontal scroll, elements in view) and screenshots in the report, not by pixel comparison.
- **No load test:** the CDN and stored results carry the load; SEC's limit is 10 requests per second.
- **Fixtures age:** real companies file new reports; refresh the fixtures a few times a year.
- **Human review:** a native Spanish speaker should review the financial wording.

## 10. Running the tests

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
npm install && npx playwright install chromium

npm run check                    # lint and type checks
node --test tests/js/*.test.js   # 0 · JavaScript unit
.venv/bin/pytest                 # 1–3 · unit, regression, HTTP
npm run test:e2e                 # 4–5 · browser and accessibility
npm run report                   # Allure report (after running with results, see README)
```
