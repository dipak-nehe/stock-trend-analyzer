# End-to-end tests: 10-Year Stock Value Analysis (web app)

Every browser test in `e2e/`, by feature. They drive the real pages in Chromium (Playwright Test, TypeScript) against the real Python server running on saved SEC filings, so they're offline and repeatable. Each test's named steps carry screenshots, and every test has a video, in the [Allure report](https://stock-trend-test-report.vercel.app). How these fit with the other test layers: [test-plan.md](test-plan.md).

**123 tests:** 72 in `e2e/ui.spec.ts` (start, results and disclaimer pages), 16 in `e2e/compare.spec.ts` (compare page), 35 in `e2e/accessibility.spec.ts` (WCAG and keyboard). Test companies: AAPL, KO, INTC, JPM (a bank), SMCI (restatement, late filings, exchange notices).

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

### Graham & Buffett and price-based valuation (8)

| # | Test |
|---|---|
| 40 | price runs valuation tests and is kept in the URL |
| 41 | price from link is applied on load |
| 42 | new search clears the previous price |
| 43 | checklist scores add up |
| 44 | checklist scores have a bar |
| 45 | bank-specific rules are skipped |
| 46 | value tab is named after Graham and Buffett |
| 47 | price box links to public quote pages |

### Guide, layout and trust (7)

| # | Test |
|---|---|
| 48 | guide explains the results before a search |
| 49 | guide collapses after a search and can be reopened |
| 50 | guide card before a search shows an example on that tab |
| 51 | guide card after a search opens its tab for that company |
| 52 | guide toggle looks and reads like a control |
| 53 | disclaimer is always visible |
| 54 | phone layout has no horizontal scroll |

### Full disclaimer (3)

| # | Test |
|---|---|
| 55 | the short notice and the footer link to the full disclaimer |
| 56 | the compare page links to the full disclaimer too |
| 57 | the disclaimer reads in Spanish, from Spanish pages and by switching |

### Language (English and Spanish) (10)

| # | Test |
|---|---|
| 58 | Spanish link shows the whole page in Spanish |
| 59 | a Spanish browser › gets Spanish automatically |
| 60 | English browser gets English |
| 61 | switching language keeps tab and price and updates the link |
| 62 | language choice is remembered |
| 63 | errors are translated |
| 64 | no English left in Spanish results |
| 65 | Spanish stays on across every page after pressing ES |
| 66 | Spanish stays on across every page after a Spanish link |
| 67 | switching back to English is remembered the same way |

### Home button (3)

| # | Test |
|---|---|
| 68 | Home button returns to a fresh landing page |
| 69 | Home keeps the language |
| 70 | Home button appears only after a lookup |

### Privacy (2)

| # | Test |
|---|---|
| 71 | page loads nothing from other sites |
| 72 | analytics script is not loaded locally |

## Compare page (`e2e/compare.spec.ts`, 16)

| # | Test |
|---|---|
| 73 | compare link appears only after a result |
| 74 | compare link opens with the first stock loaded |
| 75 | second stock is fetched and compared |
| 76 | chip loads the second stock |
| 77 | marks follow direction and sizes get none |
| 78 | valuation rows need prices |
| 79 | deep link with prices restores everything |
| 80 | swap switches sides and prices |
| 81 | same ticker is rejected |
| 82 | unknown second ticker keeps the first |
| 83 | language carries over and switches |
| 84 | bank shows n/a for current ratio |
| 85 | phone width has no sideways scroll |
| 86 | Home leaves the compare page |
| 87 | Compare and Load need a ticker in their box |
| 88 | a quick submit before the script loads is not lost |

## Accessibility (`e2e/accessibility.spec.ts`, 35)

axe-core checks every state below against WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus best practices; a test fails on any violation and attaches the full axe output. The keyboard tests use only the keyboard.

| # | Test |
|---|---|
| 89 | landing page (desktop, light) |
| 90 | landing page (desktop, dark) |
| 91 | landing page (phone, light) |
| 92 | landing page (phone, dark) |
| 93 | results tab: overview (light) |
| 94 | results tab: overview (dark) |
| 95 | results tab: flags (light) |
| 96 | results tab: flags (dark) |
| 97 | results tab: history (light) |
| 98 | results tab: history (dark) |
| 99 | results tab: value (light) |
| 100 | results tab: value (dark) |
| 101 | results tab: charts (light) |
| 102 | results tab: charts (dark) |
| 103 | results tab: data (light) |
| 104 | results tab: data (dark) |
| 105 | phone-width results: overview |
| 106 | phone-width results: data |
| 107 | Spanish page |
| 108 | error state |
| 109 | guide before and after a search |
| 110 | search and results work with the keyboard |
| 111 | wide tables can be scrolled with the keyboard |
| 112 | every interactive element has a name |
| 113 | compare page: one-side (light) |
| 114 | compare page: one-side (dark) |
| 115 | compare page: both-priced (light) |
| 116 | compare page: both-priced (dark) |
| 117 | compare page: spanish (light) |
| 118 | compare page: spanish (dark) |
| 119 | compare page at phone width |
| 120 | disclaimer page (en, light) |
| 121 | disclaimer page (en, dark) |
| 122 | disclaimer page (es, light) |
| 123 | disclaimer page (es, dark) |
