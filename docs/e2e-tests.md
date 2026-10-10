# End-to-end tests: 10-Year Stock Value Analysis (web app)

Every browser test in `e2e/`, by feature. The sections below are the `test.describe` groups in the spec files, in the same order, and the same groups appear in the Allure report (under each spec file). They drive the real pages in Chromium (Playwright Test, TypeScript) against the real Python server running on saved SEC filings, so they're offline and repeatable. Each test's named steps carry screenshots, and every test has a video, in the [Allure report](https://stock-trend-test-report.vercel.app). How these fit with the other test layers: [test-plan.md](test-plan.md).

**171 tests:** 95 in `e2e/ui.spec.ts` (start, results and disclaimer pages), 18 in `e2e/compare.spec.ts` (compare page), 13 in `e2e/portfolio.spec.ts` (My portfolio), 45 in `e2e/accessibility.spec.ts` (WCAG and keyboard). Test companies: AAPL, KO, INTC, JPM (a bank), SMCI (restatement, late filings, exchange notices).

Regenerate the list with `npx playwright test --list`. Run one group with `npx playwright test -g "<group name>"` (e.g. `-g "insider trades"`). Run one test with `npx playwright test -g "<name>"`.

## Start and results page (`e2e/ui.spec.ts`, 95)

### Search (8)

| # | Test |
|---|---|
| 1 | search shows company trends and charts |
| 2 | chips load a company |
| 3 | search box has a visible label and works by label |
| 4 | slash jumps to search but not while typing elsewhere |
| 5 | Analyze with an empty box shows a hint instead of looking anything up |
| 6 | the empty-box hint is in Spanish too |
| 7 | Analyze is ready right away when the page opens with a ticker, and after a lookup |
| 8 | search button waits for the script |

### Start-page quote of the day (4)

| # | Test |
|---|---|
| 9 | a Buffett quote shows on the start page, chosen by the day of the month |
| 10 | another day brings another quote |
| 11 | the quote is translated into Spanish, and follows a language switch |
| 12 | the quote makes way once a company is shown |

### Smart search (4)

| # | Test |
|---|---|
| 13 | a company name suggests tickers; arrow keys and Enter look one up |
| 14 | Analyze with a company name looks up the best match |
| 15 | clicking a suggestion loads it, and Escape closes the list |
| 16 | typing a ticker still works exactly as before |

### Wrong tickers and errors (6)

| # | Test |
|---|---|
| 17 | a wrong ticker typed on the start page shows its error on screen |
| 18 | a wrong ticker after a result replaces it, and the address follows |
| 19 | switching language after a wrong ticker translates the error and never brings back the old result |
| 20 | a badly formed ticker shows its error on screen |
| 21 | unknown ticker shows a friendly error |
| 22 | invalid input is rejected |

### Results guide (5)

| # | Test |
|---|---|
| 23 | guide starts collapsed, with a gently pulsing "Show guide", and explains the results |
| 24 | guide collapses after a search and can be reopened |
| 25 | guide card before a search shows an example on that tab |
| 26 | guide card after a search opens its tab for that company |
| 27 | guide toggle looks and reads like a control |

### At a glance (5)

| # | Test |
|---|---|
| 28 | glance summarises each area in one line |
| 29 | glance rows open their tab |
| 30 | clean company glance and badges |
| 31 | badges count serious problems |
| 32 | glance has a title and hint |

### Tabs (10)

| # | Test |
|---|---|
| 33 | tab tour: each tab opens alone, updates the address and shows its content |
| 34 | each tab has a short explanation |
| 35 | link with a tab opens that tab |
| 36 | tabs work with the keyboard |
| 37 | charts are drawn only when their tab opens |
| 38 | new search stays on the current tab |
| 39 | previous and next buttons walk through the tabs |
| 40 | tabs carry the same icons as the guide |
| 41 | previous/next buttons sit at the bottom of every tab |
| 42 | phone tab bar keeps the active tab in view |

### Overview and trends (4)

| # | Test |
|---|---|
| 43 | growth table compares first and latest year |
| 44 | loss-making company is described in words |
| 45 | trend tiles show a sparkline |
| 46 | jargon is explained |

### Red flags and SEC history (5)

| # | Test |
|---|---|
| 47 | restatements and late filings are flagged |
| 48 | filing history filters and expands |
| 49 | clean filer gets a strength |
| 50 | "Show all" keeps the price and raises no errors |
| 51 | red flags are grouped with explanations |

### Graham & Buffett and the share price (16)

| # | Test |
|---|---|
| 52 | price runs valuation tests and is kept in the URL |
| 53 | price from link is applied on load |
| 54 | new search clears the previous price |
| 55 | Peter Lynch: PEG, dividend-adjusted, fair value and debt, from 5 years of EPS growth |
| 56 | checklist scores add up |
| 57 | the latest 12 months from quarterly reports show on the Overview, against the last fiscal year |
| 58 | the Overview compares the company with its industry |
| 59 | a small industry falls back to related industries, and banks get only growth and return on equity |
| 60 | R&D spending shows on the Overview for companies that report it, and not otherwise |
| 61 | the value estimate can be recalculated with your own assumptions, and reset |
| 62 | the Durable advantage tab scores the statements, with the figures behind each test |
| 63 | return on tangible capital, the Piotroski F-score and the yields show on the value tab |
| 64 | bank-specific rules are skipped |
| 65 | checklist scores have a bar |
| 66 | value tab is named after Graham and Buffett |
| 67 | price box links to public quote pages |

### Insider trades (Form 4) (6)

| # | Test |
|---|---|
| 68 | insider trades: open-market buys and sales in the last 12 months, with the filings |
| 69 | several insiders buying is called out in the Insiders tab |
| 70 | insider trades in Spanish |
| 71 | insider trades load only when the Insiders tab is opened, and only once |
| 72 | a link to the Insiders tab loads them straight away |
| 73 | insider trades that fail to load can be tried again |

### Spanish and language choice (10)

| # | Test |
|---|---|
| 74 | Spanish link shows the whole page in Spanish |
| 75 | English browser gets English |
| 76 | switching language keeps tab and price and updates the link |
| 77 | language choice is remembered |
| 78 | Spanish stays on across every page after pressing ES |
| 79 | Spanish stays on across every page after a Spanish link |
| 80 | switching back to English is remembered the same way |
| 81 | errors are translated |
| 82 | no English left in Spanish results |
| 83 | gets Spanish automatically |

### Home button (3)

| # | Test |
|---|---|
| 84 | Home button returns to a fresh landing page |
| 85 | Home keeps the language |
| 86 | Home button appears only after a lookup |

### Disclaimer (4)

| # | Test |
|---|---|
| 87 | disclaimer is always visible, at the bottom of the page |
| 88 | the short notice and the footer link to the full disclaimer |
| 89 | the compare page links to the full disclaimer too |
| 90 | the disclaimer reads in Spanish, from Spanish pages and by switching |

### Page basics: layout, privacy and data freshness (5)

| # | Test |
|---|---|
| 91 | phone layout has no horizontal scroll |
| 92 | page loads nothing from other sites |
| 93 | analytics scripts are not loaded locally |
| 94 | company header says when the data was fetched |
| 95 | saved-copy notice when SEC is unreachable |

## Compare page (`e2e/compare.spec.ts`, 18)

### Opening from a result (2)

| # | Test |
|---|---|
| 96 | compare link appears only after a result |
| 97 | compare link opens with the first stock loaded |

### Loading and comparing (6)

| # | Test |
|---|---|
| 98 | second stock is fetched and compared |
| 99 | the comparison includes the newer measures |
| 100 | both boxes suggest companies by name, and a typed name loads its best match |
| 101 | chip loads the second stock |
| 102 | marks follow direction and sizes get none |
| 103 | bank shows n/a for current ratio |

### Prices and links (3)

| # | Test |
|---|---|
| 104 | valuation rows need prices |
| 105 | deep link with prices restores everything |
| 106 | swap switches sides and prices |

### Errors and input (4)

| # | Test |
|---|---|
| 107 | same ticker is rejected |
| 108 | unknown second ticker keeps the first |
| 109 | Compare and Load need a ticker in their box |
| 110 | a quick submit before the script loads is not lost |

### Language, layout and navigation (3)

| # | Test |
|---|---|
| 111 | language carries over and switches |
| 112 | phone width has no sideways scroll |
| 113 | Home leaves the compare page |

## My portfolio (`e2e/portfolio.spec.ts`, 13)

### Adding and removing stocks (5)

| # | Test |
|---|---|
| 114 | a stock added by ticker gets a row, and the list is kept in the address and in the browser |
| 115 | a company name is turned into its ticker, and a chip adds one |
| 116 | the same stock twice is not added again |
| 117 | an unknown ticker shows its error in its row and can be removed |
| 118 | stocks can be removed one at a time or all at once |

### The measures and checklist scores (5)

| # | Test |
|---|---|
| 119 | each stock shows its 10-year growth, margins, returns and share count, with a median row |
| 120 | a measure that can't be worked out says why |
| 121 | cells are coloured by simple yardsticks, explained under the table |
| 122 | Buffett criteria met and balance-sheet checks passed, with what wasn't met on hover |
| 123 | clicking a column sorts by it, best first, and again the other way |

### Getting there and language (3)

| # | Test |
|---|---|
| 124 | My portfolio is in the header, and a result can be added to it |
| 125 | the page reads in Spanish, and the list survives a language switch |
| 126 | at phone width the table scrolls inside its card, not the page |

## Accessibility (`e2e/accessibility.spec.ts`, 45)

axe-core checks every state below against WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus best practices; a test fails on any violation and attaches the full axe output. The keyboard tests use only the keyboard.

### Axe: start and results pages (26)

| # | Test |
|---|---|
| 127 | landing page (desktop, light) |
| 128 | landing page (desktop, dark) |
| 129 | landing page (phone, light) |
| 130 | landing page (phone, dark) |
| 131 | results tab: overview (light) |
| 132 | results tab: overview (dark) |
| 133 | results tab: flags (light) |
| 134 | results tab: flags (dark) |
| 135 | results tab: history (light) |
| 136 | results tab: history (dark) |
| 137 | results tab: insiders (light) |
| 138 | results tab: insiders (dark) |
| 139 | results tab: value (light) |
| 140 | results tab: value (dark) |
| 141 | results tab: durable (light) |
| 142 | results tab: durable (dark) |
| 143 | results tab: charts (light) |
| 144 | results tab: charts (dark) |
| 145 | results tab: data (light) |
| 146 | results tab: data (dark) |
| 147 | phone-width results: overview |
| 148 | phone-width results: data |
| 149 | Spanish page |
| 150 | error state |
| 151 | search suggestions open |
| 152 | guide before and after a search |

### Keyboard only (3)

| # | Test |
|---|---|
| 153 | search and results work with the keyboard |
| 154 | wide tables can be scrolled with the keyboard |
| 155 | every interactive element has a name |

### Axe: compare page (7)

| # | Test |
|---|---|
| 156 | compare page: one-side (light) |
| 157 | compare page: one-side (dark) |
| 158 | compare page: both-priced (light) |
| 159 | compare page: both-priced (dark) |
| 160 | compare page: spanish (light) |
| 161 | compare page: spanish (dark) |
| 162 | compare page at phone width |

### Axe: disclaimer page (4)

| # | Test |
|---|---|
| 163 | disclaimer page (en, light) |
| 164 | disclaimer page (en, dark) |
| 165 | disclaimer page (es, light) |
| 166 | disclaimer page (es, dark) |

### Axe: portfolio page (5)

| # | Test |
|---|---|
| 167 | portfolio page (en, light) |
| 168 | portfolio page (en, dark) |
| 169 | portfolio page (es, light) |
| 170 | portfolio page (es, dark) |
| 171 | portfolio page at phone width, and empty |
