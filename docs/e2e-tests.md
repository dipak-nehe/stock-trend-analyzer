# End-to-end tests: 10-Year Stock Value Analysis (web app)

Every browser test in `e2e/`, by feature. The sections below are the `test.describe` groups in the spec files, in the same order, and the same groups appear in the Allure report (under each spec file). They drive the real pages in Chromium (Playwright Test, TypeScript) against the real Python server running on saved SEC filings, so they're offline and repeatable. Each test's named steps carry screenshots, and every test has a video, in the [Allure report](https://stock-trend-test-report.vercel.app). How these fit with the other test layers: [test-plan.md](test-plan.md).

**131 tests:** 78 in `e2e/ui.spec.ts` (start, results and disclaimer pages), 16 in `e2e/compare.spec.ts` (compare page), 37 in `e2e/accessibility.spec.ts` (WCAG and keyboard). Test companies: AAPL, KO, INTC, JPM (a bank), SMCI (restatement, late filings, exchange notices).

Regenerate the list with `npx playwright test --list`. Run one group with `npx playwright test -g "<group name>"` (e.g. `-g "insider trades"`). Run one test with `npx playwright test -g "<name>"`.

## Start and results page (`e2e/ui.spec.ts`, 78)

### Search (7)

| # | Test |
|---|---|
| 1 | search shows company trends and charts |
| 2 | chips load a company |
| 3 | search box has a visible label and works by label |
| 4 | slash jumps to search but not while typing elsewhere |
| 5 | Analyze needs a ticker: it stays disabled while the search box is empty |
| 6 | Analyze is ready right away when the page opens with a ticker, and after a lookup |
| 7 | search button waits for the script |

### Wrong tickers and errors (6)

| # | Test |
|---|---|
| 8 | a wrong ticker typed on the start page shows its error on screen |
| 9 | a wrong ticker after a result replaces it, and the address follows |
| 10 | switching language after a wrong ticker translates the error and never brings back the old result |
| 11 | a badly formed ticker shows its error on screen |
| 12 | unknown ticker shows a friendly error |
| 13 | invalid input is rejected |

### Results guide (5)

| # | Test |
|---|---|
| 14 | guide explains the results before a search |
| 15 | guide collapses after a search and can be reopened |
| 16 | guide card before a search shows an example on that tab |
| 17 | guide card after a search opens its tab for that company |
| 18 | guide toggle looks and reads like a control |

### At a glance (5)

| # | Test |
|---|---|
| 19 | glance summarises each area in one line |
| 20 | glance rows open their tab |
| 21 | clean company glance and badges |
| 22 | badges count serious problems |
| 23 | glance has a title and hint |

### Tabs (10)

| # | Test |
|---|---|
| 24 | tab tour: each tab opens alone, updates the address and shows its content |
| 25 | each tab has a short explanation |
| 26 | link with a tab opens that tab |
| 27 | tabs work with the keyboard |
| 28 | charts are drawn only when their tab opens |
| 29 | new search stays on the current tab |
| 30 | previous and next buttons walk through the tabs |
| 31 | tabs carry the same icons as the guide |
| 32 | previous/next buttons sit at the bottom of every tab |
| 33 | phone tab bar keeps the active tab in view |

### Overview and trends (4)

| # | Test |
|---|---|
| 34 | growth table compares first and latest year |
| 35 | loss-making company is described in words |
| 36 | trend tiles show a sparkline |
| 37 | jargon is explained |

### Red flags and SEC history (5)

| # | Test |
|---|---|
| 38 | restatements and late filings are flagged |
| 39 | filing history filters and expands |
| 40 | clean filer gets a strength |
| 41 | "Show all" keeps the price and raises no errors |
| 42 | red flags are grouped with explanations |

### Graham & Buffett and the share price (8)

| # | Test |
|---|---|
| 43 | price runs valuation tests and is kept in the URL |
| 44 | price from link is applied on load |
| 45 | new search clears the previous price |
| 46 | checklist scores add up |
| 47 | bank-specific rules are skipped |
| 48 | checklist scores have a bar |
| 49 | value tab is named after Graham and Buffett |
| 50 | price box links to public quote pages |

### Insider trades (Form 4) (6)

| # | Test |
|---|---|
| 51 | insider trades: open-market buys and sales in the last 12 months, with the filings |
| 52 | several insiders buying is called out in the Insiders tab |
| 53 | insider trades in Spanish |
| 54 | insider trades load only when the Insiders tab is opened, and only once |
| 55 | a link to the Insiders tab loads them straight away |
| 56 | insider trades that fail to load can be tried again |

### Spanish and language choice (10)

| # | Test |
|---|---|
| 57 | Spanish link shows the whole page in Spanish |
| 58 | English browser gets English |
| 59 | switching language keeps tab and price and updates the link |
| 60 | language choice is remembered |
| 61 | Spanish stays on across every page after pressing ES |
| 62 | Spanish stays on across every page after a Spanish link |
| 63 | switching back to English is remembered the same way |
| 64 | errors are translated |
| 65 | no English left in Spanish results |
| 66 | gets Spanish automatically |

### Home button (3)

| # | Test |
|---|---|
| 67 | Home button returns to a fresh landing page |
| 68 | Home keeps the language |
| 69 | Home button appears only after a lookup |

### Disclaimer (4)

| # | Test |
|---|---|
| 70 | disclaimer is always visible |
| 71 | the short notice and the footer link to the full disclaimer |
| 72 | the compare page links to the full disclaimer too |
| 73 | the disclaimer reads in Spanish, from Spanish pages and by switching |

### Page basics: layout, privacy and data freshness (5)

| # | Test |
|---|---|
| 74 | phone layout has no horizontal scroll |
| 75 | page loads nothing from other sites |
| 76 | analytics script is not loaded locally |
| 77 | company header says when the data was fetched |
| 78 | saved-copy notice when SEC is unreachable |

## Compare page (`e2e/compare.spec.ts`, 16)

### Opening from a result (2)

| # | Test |
|---|---|
| 79 | compare link appears only after a result |
| 80 | compare link opens with the first stock loaded |

### Loading and comparing (4)

| # | Test |
|---|---|
| 81 | second stock is fetched and compared |
| 82 | chip loads the second stock |
| 83 | marks follow direction and sizes get none |
| 84 | bank shows n/a for current ratio |

### Prices and links (3)

| # | Test |
|---|---|
| 85 | valuation rows need prices |
| 86 | deep link with prices restores everything |
| 87 | swap switches sides and prices |

### Errors and input (4)

| # | Test |
|---|---|
| 88 | same ticker is rejected |
| 89 | unknown second ticker keeps the first |
| 90 | Compare and Load need a ticker in their box |
| 91 | a quick submit before the script loads is not lost |

### Language, layout and navigation (3)

| # | Test |
|---|---|
| 92 | language carries over and switches |
| 93 | phone width has no sideways scroll |
| 94 | Home leaves the compare page |

## Accessibility (`e2e/accessibility.spec.ts`, 37)

axe-core checks every state below against WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus best practices; a test fails on any violation and attaches the full axe output. The keyboard tests use only the keyboard.

### Axe: start and results pages (23)

| # | Test |
|---|---|
| 95 | landing page (desktop, light) |
| 96 | landing page (desktop, dark) |
| 97 | landing page (phone, light) |
| 98 | landing page (phone, dark) |
| 99 | results tab: overview (light) |
| 100 | results tab: overview (dark) |
| 101 | results tab: flags (light) |
| 102 | results tab: flags (dark) |
| 103 | results tab: history (light) |
| 104 | results tab: history (dark) |
| 105 | results tab: insiders (light) |
| 106 | results tab: insiders (dark) |
| 107 | results tab: value (light) |
| 108 | results tab: value (dark) |
| 109 | results tab: charts (light) |
| 110 | results tab: charts (dark) |
| 111 | results tab: data (light) |
| 112 | results tab: data (dark) |
| 113 | phone-width results: overview |
| 114 | phone-width results: data |
| 115 | Spanish page |
| 116 | error state |
| 117 | guide before and after a search |

### Keyboard only (3)

| # | Test |
|---|---|
| 118 | search and results work with the keyboard |
| 119 | wide tables can be scrolled with the keyboard |
| 120 | every interactive element has a name |

### Axe: compare page (7)

| # | Test |
|---|---|
| 121 | compare page: one-side (light) |
| 122 | compare page: one-side (dark) |
| 123 | compare page: both-priced (light) |
| 124 | compare page: both-priced (dark) |
| 125 | compare page: spanish (light) |
| 126 | compare page: spanish (dark) |
| 127 | compare page at phone width |

### Axe: disclaimer page (4)

| # | Test |
|---|---|
| 128 | disclaimer page (en, light) |
| 129 | disclaimer page (en, dark) |
| 130 | disclaimer page (es, light) |
| 131 | disclaimer page (es, dark) |
