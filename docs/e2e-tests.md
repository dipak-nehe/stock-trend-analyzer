# End-to-end tests: 10-Year Stock Value Analysis (web app)

Every browser test in `e2e/`, by feature. The sections below are the `test.describe` groups in the spec files, in the same order, and the same groups appear in the Allure report (under each spec file). They drive the real pages in Chromium (Playwright Test, TypeScript) against the real Python server running on saved SEC filings, so they're offline and repeatable. Each test's named steps carry screenshots, and every test has a video, in the [Allure report](https://stock-trend-test-report.vercel.app). How these fit with the other test layers: [test-plan.md](test-plan.md).

**203 tests:** 98 in `e2e/ui.spec.ts` (start, results and disclaimer pages), 18 in `e2e/compare.spec.ts` (compare page), 19 in `e2e/portfolio.spec.ts` (My portfolio), 11 in `e2e/sp500.spec.ts` (S&P 500 picker and picks), 2 in `e2e/methodology.spec.ts` (How we calculate), 55 in `e2e/accessibility.spec.ts` (WCAG and keyboard). Test companies: AAPL, KO, INTC, JPM (a bank), SMCI (restatement, late filings, exchange notices).

Regenerate the list with `npx playwright test --list`. Run one group with `npx playwright test -g "<group name>"` (e.g. `-g "insider trades"`). Run one test with `npx playwright test -g "<name>"`.

## Start and results page (`e2e/ui.spec.ts`, 98)

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

### Company pages (2)

| # | Test |
|---|---|
| 91 | /stock/KO opens Coca-Cola with its own title, and keeps that address |
| 92 | an unknown company page shows the usual error, and the sitemap lists the company pages |

### Downloads (1)

| # | Test |
|---|---|
| 93 | the Data tab downloads every figure as CSV, as filed |

### Page basics: layout, privacy and data freshness (5)

| # | Test |
|---|---|
| 94 | phone layout has no horizontal scroll |
| 95 | page loads nothing from other sites |
| 96 | analytics scripts are not loaded locally |
| 97 | company header says when the data was fetched |
| 98 | saved-copy notice when SEC is unreachable |

## Compare page (`e2e/compare.spec.ts`, 18)

### Opening from a result (2)

| # | Test |
|---|---|
| 99 | compare link appears only after a result |
| 100 | compare link opens with the first stock loaded |

### Loading and comparing (6)

| # | Test |
|---|---|
| 101 | second stock is fetched and compared |
| 102 | the comparison includes the newer measures |
| 103 | both boxes suggest companies by name, and a typed name loads its best match |
| 104 | chip loads the second stock |
| 105 | marks follow direction and sizes get none |
| 106 | bank shows n/a for current ratio |

### Prices and links (3)

| # | Test |
|---|---|
| 107 | valuation rows need prices |
| 108 | deep link with prices restores everything |
| 109 | swap switches sides and prices |

### Errors and input (4)

| # | Test |
|---|---|
| 110 | same ticker is rejected |
| 111 | unknown second ticker keeps the first |
| 112 | Compare and Load need a ticker in their box |
| 113 | a quick submit before the script loads is not lost |

### Language, layout and navigation (3)

| # | Test |
|---|---|
| 114 | language carries over and switches |
| 115 | phone width has no sideways scroll |
| 116 | Home leaves the compare page |

## My portfolio (`e2e/portfolio.spec.ts`, 19)

### Adding and removing stocks (5)

| # | Test |
|---|---|
| 117 | a stock added by ticker gets a row, and the list is kept in this browser |
| 118 | a company name is turned into its ticker, and a chip adds one |
| 119 | the same stock twice is not added again |
| 120 | an unknown ticker shows its error in its row and can be removed |
| 121 | stocks can be removed one at a time or all at once |

### The measures and checklist scores (5)

| # | Test |
|---|---|
| 122 | each stock shows its 10-year growth, margins, returns and share count, with a median row |
| 123 | a measure that can't be worked out says why |
| 124 | cells are coloured by simple yardsticks, explained under the table |
| 125 | Buffett criteria met and balance-sheet checks passed, with what wasn't met on hover |
| 126 | clicking a column sorts by it, best first, and again the other way |

### Getting there and language (3)

| # | Test |
|---|---|
| 127 | My portfolio is in the header, and a result can be added to it |
| 128 | the page reads in Spanish, and the list survives a language switch |
| 129 | at phone width the table scrolls inside its card, not the page |

### Coming back and sharing (6)

| # | Test |
|---|---|
| 130 | inside the Android app, Download CSV hands the file to the app instead |
| 131 | Download CSV saves the table: percentages as numbers, scores as counts |
| 132 | coming Back after saving picks from the S&P 500 page shows them, and keeps them |
| 133 | a save made in another tab shows up in an open My portfolio |
| 134 | a shared link shows that list read-only and never replaces mine; Add these merges it in |
| 135 | Copy link to share gives a link with the list; opening my own list's link shows My portfolio |

## S&P 500 picker and picks (`e2e/sp500.spec.ts`, 11)

### Picking companies (4)

| # | Test |
|---|---|
| 136 | the list can be searched by name or ticker and filtered by sector |
| 137 | ticked companies show in the selection bar, and Show waits for at least one |
| 138 | no more than 10 can be picked: the others are disabled until one is removed |
| 139 | a link with more than 10 keeps the first 10 and says so |

### Showing the picks (4)

| # | Test |
|---|---|
| 140 | Show opens them side by side, read-only, and Change selection keeps the ticks |
| 141 | Save to My portfolio adds them to the saved list, without duplicates |
| 142 | viewing picks never changes My portfolio by itself |
| 143 | more than 10 in the address: the first 10 are loaded, with a note |

### Getting there, language and layout (3)

| # | Test |
|---|---|
| 144 | S&P 500 is in the header of every page |
| 145 | both pages read in Spanish, and the language carries over |
| 146 | at phone width neither page scrolls sideways |

## How we calculate (`e2e/methodology.spec.ts`, 2)

### How we calculate (2)

| # | Test |
|---|---|
| 147 | lists every red flag and checklist test with its rule |
| 148 | every page links to it in the footer, keeping the language |

## Accessibility (`e2e/accessibility.spec.ts`, 55)

axe-core checks every state below against WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus best practices; a test fails on any violation and attaches the full axe output. The keyboard tests use only the keyboard.

### Axe: start and results pages (26)

| # | Test |
|---|---|
| 149 | landing page (desktop, light) |
| 150 | landing page (desktop, dark) |
| 151 | landing page (phone, light) |
| 152 | landing page (phone, dark) |
| 153 | results tab: overview (light) |
| 154 | results tab: overview (dark) |
| 155 | results tab: flags (light) |
| 156 | results tab: flags (dark) |
| 157 | results tab: history (light) |
| 158 | results tab: history (dark) |
| 159 | results tab: insiders (light) |
| 160 | results tab: insiders (dark) |
| 161 | results tab: value (light) |
| 162 | results tab: value (dark) |
| 163 | results tab: durable (light) |
| 164 | results tab: durable (dark) |
| 165 | results tab: charts (light) |
| 166 | results tab: charts (dark) |
| 167 | results tab: data (light) |
| 168 | results tab: data (dark) |
| 169 | phone-width results: overview |
| 170 | phone-width results: data |
| 171 | Spanish page |
| 172 | error state |
| 173 | search suggestions open |
| 174 | guide before and after a search |

### Keyboard only (3)

| # | Test |
|---|---|
| 175 | search and results work with the keyboard |
| 176 | wide tables can be scrolled with the keyboard |
| 177 | every interactive element has a name |

### Axe: compare page (7)

| # | Test |
|---|---|
| 178 | compare page: one-side (light) |
| 179 | compare page: one-side (dark) |
| 180 | compare page: both-priced (light) |
| 181 | compare page: both-priced (dark) |
| 182 | compare page: spanish (light) |
| 183 | compare page: spanish (dark) |
| 184 | compare page at phone width |

### Axe: disclaimer page (4)

| # | Test |
|---|---|
| 185 | disclaimer page (en, light) |
| 186 | disclaimer page (en, dark) |
| 187 | disclaimer page (es, light) |
| 188 | disclaimer page (es, dark) |

### Axe: portfolio page (6)

| # | Test |
|---|---|
| 189 | portfolio page (en, light) |
| 190 | portfolio page (en, dark) |
| 191 | portfolio page (es, light) |
| 192 | portfolio page (es, dark) |
| 193 | portfolio page showing a shared list, in both themes |
| 194 | portfolio page at phone width, and empty |

### Axe: S&P 500 pages (5)

| # | Test |
|---|---|
| 195 | S&P 500 picker and picks (en, light) |
| 196 | S&P 500 picker and picks (en, dark) |
| 197 | S&P 500 picker and picks (es, light) |
| 198 | S&P 500 picker and picks (es, dark) |
| 199 | S&P 500 picker at phone width, with 10 picked (the rest disabled) |

### Axe: How we calculate (4)

| # | Test |
|---|---|
| 200 | How we calculate (en, light) |
| 201 | How we calculate (en, dark) |
| 202 | How we calculate (es, light) |
| 203 | How we calculate (es, dark) |
