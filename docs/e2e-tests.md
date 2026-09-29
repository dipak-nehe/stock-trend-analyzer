# End-to-end tests: 10-Year Stock Value Analysis (web app)

Every browser test in `e2e/`, by feature. They drive the real pages in Chromium (Playwright Test, TypeScript) against the real Python server running on saved SEC filings, so they're offline and repeatable. Each test's named steps carry screenshots, and every test has a video, in the [Allure report](https://stock-trend-test-report.vercel.app). How these fit with the other test layers: [test-plan.md](test-plan.md).

**131 tests:** 78 in `e2e/ui.spec.ts` (start, results and disclaimer pages), 16 in `e2e/compare.spec.ts` (compare page), 37 in `e2e/accessibility.spec.ts` (WCAG and keyboard). Test companies: AAPL, KO, INTC, JPM (a bank), SMCI (restatement, late filings, exchange notices).

Regenerate the list with `npx playwright test --list`. Run one test with `npx playwright test -g "<name>"`.

## Start and results page (`e2e/ui.spec.ts`)

### Search and results (7)

| # | Test |
|---|---|
| 1 | search shows company trends and charts |
| 2 | chips load a company |
| 3 | growth table compares first and latest year |
| 4 | loss-making company is described in words |
| 5 | trend tiles show a sparkline |
| 6 | jargon is explained |
| 7 | company header says when the data was fetched |

### Search input and errors (12)

| # | Test |
|---|---|
| 8 | Analyze needs a ticker: it stays disabled while the search box is empty |
| 9 | Analyze is ready right away when the page opens with a ticker, and after a lookup |
| 10 | search button waits for the script |
| 11 | a wrong ticker typed on the start page shows its error on screen |
| 12 | a wrong ticker after a result replaces it, and the address follows |
| 13 | switching language after a wrong ticker translates the error and never brings back the old result |
| 14 | a badly formed ticker shows its error on screen |
| 15 | unknown ticker shows a friendly error |
| 16 | invalid input is rejected |
| 17 | saved-copy notice when SEC is unreachable |
| 18 | search box has a visible label and works by label |
| 19 | slash jumps to search but not while typing elsewhere |

### At a glance and tabs (15)

| # | Test |
|---|---|
| 20 | tab tour: each tab opens alone, updates the address and shows its content |
| 21 | each tab has a short explanation |
| 22 | glance has a title and hint |
| 23 | glance summarises each area in one line |
| 24 | glance rows open their tab |
| 25 | clean company glance and badges |
| 26 | badges count serious problems |
| 27 | link with a tab opens that tab |
| 28 | tabs work with the keyboard |
| 29 | charts are drawn only when their tab opens |
| 30 | new search stays on the current tab |
| 31 | previous and next buttons walk through the tabs |
| 32 | previous/next buttons sit at the bottom of every tab |
| 33 | tabs carry the same icons as the guide |
| 34 | phone tab bar keeps the active tab in view |

### Red flags and SEC filing history (5)

| # | Test |
|---|---|
| 35 | restatements and late filings are flagged |
| 36 | red flags are grouped with explanations |
| 37 | clean filer gets a strength |
| 38 | filing history filters and expands |
| 39 | "Show all" keeps the price and raises no errors |

### Insider trades (6)

| # | Test |
|---|---|
| 40 | insider trades: open-market buys and sales in the last 12 months, with the filings |
| 41 | several insiders buying is called out in the Insiders tab |
| 42 | insider trades in Spanish |
| 43 | insider trades load only when the Insiders tab is opened, and only once |
| 44 | a link to the Insiders tab loads them straight away |
| 45 | insider trades that fail to load can be tried again |

### Graham & Buffett and price-based valuation (8)

| # | Test |
|---|---|
| 46 | price runs valuation tests and is kept in the URL |
| 47 | price from link is applied on load |
| 48 | new search clears the previous price |
| 49 | checklist scores add up |
| 50 | checklist scores have a bar |
| 51 | bank-specific rules are skipped |
| 52 | value tab is named after Graham and Buffett |
| 53 | price box links to public quote pages |

### Guide, layout and trust (7)

| # | Test |
|---|---|
| 54 | guide explains the results before a search |
| 55 | guide collapses after a search and can be reopened |
| 56 | guide card before a search shows an example on that tab |
| 57 | guide card after a search opens its tab for that company |
| 58 | guide toggle looks and reads like a control |
| 59 | disclaimer is always visible |
| 60 | phone layout has no horizontal scroll |

### Full disclaimer (3)

| # | Test |
|---|---|
| 61 | the short notice and the footer link to the full disclaimer |
| 62 | the compare page links to the full disclaimer too |
| 63 | the disclaimer reads in Spanish, from Spanish pages and by switching |

### Language (English and Spanish) (10)

| # | Test |
|---|---|
| 64 | Spanish link shows the whole page in Spanish |
| 65 | a Spanish browser › gets Spanish automatically |
| 66 | English browser gets English |
| 67 | switching language keeps tab and price and updates the link |
| 68 | language choice is remembered |
| 69 | errors are translated |
| 70 | no English left in Spanish results |
| 71 | Spanish stays on across every page after pressing ES |
| 72 | Spanish stays on across every page after a Spanish link |
| 73 | switching back to English is remembered the same way |

### Home button (3)

| # | Test |
|---|---|
| 74 | Home button returns to a fresh landing page |
| 75 | Home keeps the language |
| 76 | Home button appears only after a lookup |

### Privacy (2)

| # | Test |
|---|---|
| 77 | page loads nothing from other sites |
| 78 | analytics script is not loaded locally |

## Compare page (`e2e/compare.spec.ts`, 16)

| # | Test |
|---|---|
| 79 | compare link appears only after a result |
| 80 | compare link opens with the first stock loaded |
| 81 | second stock is fetched and compared |
| 82 | chip loads the second stock |
| 83 | marks follow direction and sizes get none |
| 84 | valuation rows need prices |
| 85 | deep link with prices restores everything |
| 86 | swap switches sides and prices |
| 87 | same ticker is rejected |
| 88 | unknown second ticker keeps the first |
| 89 | language carries over and switches |
| 90 | bank shows n/a for current ratio |
| 91 | phone width has no sideways scroll |
| 92 | Home leaves the compare page |
| 93 | Compare and Load need a ticker in their box |
| 94 | a quick submit before the script loads is not lost |

## Accessibility (`e2e/accessibility.spec.ts`, 37)

axe-core checks every state below against WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus best practices; a test fails on any violation and attaches the full axe output. The keyboard tests use only the keyboard.

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
| 118 | search and results work with the keyboard |
| 119 | wide tables can be scrolled with the keyboard |
| 120 | every interactive element has a name |
| 121 | compare page: one-side (light) |
| 122 | compare page: one-side (dark) |
| 123 | compare page: both-priced (light) |
| 124 | compare page: both-priced (dark) |
| 125 | compare page: spanish (light) |
| 126 | compare page: spanish (dark) |
| 127 | compare page at phone width |
| 128 | disclaimer page (en, light) |
| 129 | disclaimer page (en, dark) |
| 130 | disclaimer page (es, light) |
| 131 | disclaimer page (es, dark) |
