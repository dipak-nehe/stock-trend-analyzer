# End-to-end tests: 10-Year Stock Value Analysis (web app)

Every browser test in `e2e/`, by feature. The sections below are the `test.describe` groups in the spec files, in the same order, and the same groups appear in the Allure report (under each spec file). They drive the real pages in Chromium (Playwright Test, TypeScript) against the real Python server running on saved SEC filings, so they're offline and repeatable. Each test's named steps carry screenshots, and every test has a video, in the [Allure report](https://stock-trend-test-report.vercel.app). How these fit with the other test layers: [test-plan.md](test-plan.md).

**219 tests:** 103 in `e2e/ui.spec.ts` (start, results and disclaimer pages), 18 in `e2e/compare.spec.ts` (compare page), 19 in `e2e/portfolio.spec.ts` (My portfolio), 11 in `e2e/sp500.spec.ts` (S&P 500 picker and picks), 6 in `e2e/funds.spec.ts` (mutual funds & ETFs), 2 in `e2e/methodology.spec.ts` (How we calculate), 60 in `e2e/accessibility.spec.ts` (WCAG and keyboard). Test companies: AAPL, KO, INTC, JPM (a bank), SMCI (restatement, late filings, exchange notices); funds VOO, VFIAX, FXAIX, SCHD, BND, AGTHX, QQQ.

Regenerate the list with `npx playwright test --list`. Run one group with `npx playwright test -g "<group name>"` (e.g. `-g "insider trades"`). Run one test with `npx playwright test -g "<name>"`.

## Start and results page (`e2e/ui.spec.ts`, 103)

### Search (9)

| # | Test |
|---|---|
| 1 | search shows company trends and charts |
| 2 | chips load a company |
| 3 | the chips become the companies opened recently, newest first, until cleared |
| 4 | search box has a visible label and works by label |
| 5 | slash jumps to search but not while typing elsewhere |
| 6 | Analyze with an empty box shows a hint instead of looking anything up |
| 7 | the empty-box hint is in Spanish too |
| 8 | Analyze is ready right away when the page opens with a ticker, and after a lookup |
| 9 | search button waits for the script |

### Start-page quote of the day (4)

| # | Test |
|---|---|
| 10 | a quote and its author show on the start page, chosen by the day |
| 11 | another day brings another quote, from another investor |
| 12 | the quote is translated into Spanish, and follows a language switch |
| 13 | the quote makes way once a company is shown |

### Smart search (4)

| # | Test |
|---|---|
| 14 | a company name suggests tickers; arrow keys and Enter look one up |
| 15 | Analyze with a company name looks up the best match |
| 16 | clicking a suggestion loads it, and Escape closes the list |
| 17 | typing a ticker still works exactly as before |

### Wrong tickers and errors (6)

| # | Test |
|---|---|
| 18 | a wrong ticker typed on the start page shows its error on screen |
| 19 | a wrong ticker after a result replaces it, and the address follows |
| 20 | switching language after a wrong ticker translates the error and never brings back the old result |
| 21 | a badly formed ticker shows its error on screen |
| 22 | unknown ticker shows a friendly error |
| 23 | invalid input is rejected |

### Results guide (5)

| # | Test |
|---|---|
| 24 | guide starts collapsed, with a gently pulsing "Show guide", and explains the results |
| 25 | guide collapses after a search and can be reopened |
| 26 | guide card before a search shows an example on that tab |
| 27 | guide card after a search opens its tab for that company |
| 28 | guide toggle looks and reads like a control |

### At a glance (5)

| # | Test |
|---|---|
| 29 | glance summarises each area in one line |
| 30 | glance rows open their tab |
| 31 | clean company glance and badges |
| 32 | badges count serious problems |
| 33 | glance has a title and hint |

### Tabs (10)

| # | Test |
|---|---|
| 34 | tab tour: each tab opens alone, updates the address and shows its content |
| 35 | each tab has a short explanation |
| 36 | link with a tab opens that tab |
| 37 | tabs work with the keyboard |
| 38 | charts are drawn only when their tab opens |
| 39 | new search stays on the current tab |
| 40 | previous and next buttons walk through the tabs |
| 41 | tabs carry the same icons as the guide |
| 42 | previous/next buttons sit at the bottom of every tab |
| 43 | phone tab bar keeps the active tab in view |

### Overview and trends (5)

| # | Test |
|---|---|
| 44 | growth table compares first and latest year |
| 45 | loss-making company is described in words |
| 46 | a company that never paid a dividend says so in the growth table |
| 47 | trend tiles show a sparkline |
| 48 | jargon is explained |

### Red flags and SEC history (5)

| # | Test |
|---|---|
| 49 | restatements and late filings are flagged |
| 50 | filing history filters and expands |
| 51 | clean filer gets a strength |
| 52 | "Show all" keeps the price and raises no errors |
| 53 | red flags are grouped with explanations |

### Graham & Buffett and the share price (17)

| # | Test |
|---|---|
| 54 | price runs valuation tests and is kept in the URL |
| 55 | business first, price last: the checklists, then the estimates, then the valuation at the price |
| 56 | price from link is applied on load |
| 57 | new search clears the previous price |
| 58 | Peter Lynch: PEG, dividend-adjusted, fair value and debt, from 5 years of EPS growth |
| 59 | checklist scores add up |
| 60 | the latest 12 months from quarterly reports show on the Overview, against the last fiscal year |
| 61 | the Overview compares the company with its industry |
| 62 | a small industry falls back to related industries, and banks get only growth and return on equity |
| 63 | R&D spending shows on the Overview for companies that report it, and not otherwise |
| 64 | the value estimate can be recalculated with your own assumptions, and reset |
| 65 | the Durable advantage tab scores the statements, with the figures behind each test |
| 66 | return on tangible capital, the Piotroski F-score and the yields show on the value tab |
| 67 | bank-specific rules are skipped |
| 68 | checklist scores have a bar |
| 69 | value tab is named after Graham and Buffett |
| 70 | price box links to public quote pages |

### Insider trades (Form 4) (6)

| # | Test |
|---|---|
| 71 | insider trades: open-market buys and sales in the last 12 months, with the filings |
| 72 | several insiders buying is called out in the Insiders tab |
| 73 | insider trades in Spanish |
| 74 | insider trades load only when the Insiders tab is opened, and only once |
| 75 | a link to the Insiders tab loads them straight away |
| 76 | insider trades that fail to load can be tried again |

### Spanish and language choice (10)

| # | Test |
|---|---|
| 77 | Spanish link shows the whole page in Spanish |
| 78 | English browser gets English |
| 79 | switching language keeps tab and price and updates the link |
| 80 | language choice is remembered |
| 81 | Spanish stays on across every page after pressing ES |
| 82 | Spanish stays on across every page after a Spanish link |
| 83 | switching back to English is remembered the same way |
| 84 | errors are translated |
| 85 | no English left in Spanish results |
| 86 | gets Spanish automatically |

### Home button (3)

| # | Test |
|---|---|
| 87 | Home button returns to a fresh landing page |
| 88 | Home keeps the language |
| 89 | Home button appears only after a lookup |

### Disclaimer (4)

| # | Test |
|---|---|
| 90 | disclaimer is always visible, at the bottom of the page |
| 91 | the short notice and the footer link to the full disclaimer |
| 92 | the compare page links to the full disclaimer too |
| 93 | the disclaimer reads in Spanish, from Spanish pages and by switching |

### Company pages (2)

| # | Test |
|---|---|
| 94 | /stock/KO opens Coca-Cola with its own title, and keeps that address |
| 95 | an unknown company page shows the usual error, and the sitemap lists the company pages |

### Downloads (1)

| # | Test |
|---|---|
| 96 | the Data tab downloads every figure as CSV, as filed |

### Page basics: layout, privacy and data freshness (7)

| # | Test |
|---|---|
| 97 | the footer links to the author's portfolio site on every page, in both languages |
| 98 | a news link opens Google News for the stock in a new tab, in the page's language |
| 99 | phone layout has no horizontal scroll |
| 100 | page loads nothing from other sites |
| 101 | analytics scripts are not loaded locally |
| 102 | company header says when the data was fetched |
| 103 | saved-copy notice when SEC is unreachable |

## Compare page (`e2e/compare.spec.ts`, 18)

### Opening from a result (2)

| # | Test |
|---|---|
| 104 | compare link appears only after a result |
| 105 | compare link opens with the first stock loaded |

### Loading and comparing (6)

| # | Test |
|---|---|
| 106 | second stock is fetched and compared |
| 107 | the comparison includes the newer measures |
| 108 | both boxes suggest companies by name, and a typed name loads its best match |
| 109 | chip loads the second stock |
| 110 | marks follow direction and sizes get none |
| 111 | bank shows n/a for current ratio |

### Prices and links (3)

| # | Test |
|---|---|
| 112 | valuation rows need prices |
| 113 | deep link with prices restores everything |
| 114 | swap switches sides and prices |

### Errors and input (4)

| # | Test |
|---|---|
| 115 | same ticker is rejected |
| 116 | unknown second ticker keeps the first |
| 117 | Compare and Load need a ticker in their box |
| 118 | a quick submit before the script loads is not lost |

### Language, layout and navigation (3)

| # | Test |
|---|---|
| 119 | language carries over and switches |
| 120 | phone width has no sideways scroll |
| 121 | Home leaves the compare page |

## My portfolio (`e2e/portfolio.spec.ts`, 19)

### Adding and removing stocks (5)

| # | Test |
|---|---|
| 122 | a stock added by ticker gets a row, and the list is kept in this browser |
| 123 | a company name is turned into its ticker, and a chip adds one |
| 124 | the same stock twice is not added again |
| 125 | an unknown ticker shows its error in its row and can be removed |
| 126 | stocks can be removed one at a time or all at once |

### The measures and checklist scores (5)

| # | Test |
|---|---|
| 127 | each stock shows its 10-year growth, margins, returns and share count, with a median row |
| 128 | a measure that can't be worked out says why |
| 129 | cells are coloured by simple yardsticks, explained under the table |
| 130 | Buffett criteria met, balance-sheet checks passed and the Piotroski F-score, with what wasn't met on hover |
| 131 | clicking a column sorts by it, best first, and again the other way |

### Getting there and language (3)

| # | Test |
|---|---|
| 132 | My portfolio is in the header, and a result can be added to it |
| 133 | the page reads in Spanish, and the list survives a language switch |
| 134 | at phone width the table scrolls inside its card, not the page |

### Coming back and sharing (6)

| # | Test |
|---|---|
| 135 | inside the Android app, Download CSV hands the file to the app instead |
| 136 | Download CSV saves the table: percentages as numbers, scores as counts |
| 137 | coming Back after saving picks from the S&P 500 page shows them, and keeps them |
| 138 | a save made in another tab shows up in an open My portfolio |
| 139 | a shared link shows that list read-only and never replaces mine; Add these merges it in |
| 140 | Copy link to share gives a link with the list; opening my own list's link shows My portfolio |

## S&P 500 picker and picks (`e2e/sp500.spec.ts`, 11)

### Picking companies (4)

| # | Test |
|---|---|
| 141 | the list can be searched by name or ticker and filtered by sector |
| 142 | ticked companies show in the selection bar, and Show waits for at least one |
| 143 | no more than 10 can be picked: the others are disabled until one is removed |
| 144 | a link with more than 10 keeps the first 10 and says so |

### Showing the picks (4)

| # | Test |
|---|---|
| 145 | Show opens them side by side, read-only, and Change selection keeps the ticks |
| 146 | Save to My portfolio adds them to the saved list, without duplicates |
| 147 | viewing picks never changes My portfolio by itself |
| 148 | more than 10 in the address: the first 10 are loaded, with a note |

### Getting there, language and layout (3)

| # | Test |
|---|---|
| 149 | S&P 500 is in the header of every page |
| 150 | both pages read in Spanish, and the language carries over |
| 151 | at phone width neither page scrolls sideways |

## Mutual funds & ETFs (`e2e/funds.spec.ts`, 6)

### One fund (2)

| # | Test |
|---|---|
| 152 | a fund added by ticker shows its costs, returns against its index, portfolio and source |
| 153 | a half-year report shows costs and portfolio, and says it has no returns |

### Comparing funds (2)

| # | Test |
|---|---|
| 154 | up to four side by side, with the lower cost, higher return and lower turnover marked |
| 155 | a shared link opens the same funds, in Spanish too |

### Errors (1)

| # | Test |
|---|---|
| 156 | a ticker that is not a fund, a trust without reports, a duplicate |

### Navigation (1)

| # | Test |
|---|---|
| 157 | every page links to Funds next to S&P 500, keeping the language |

## How we calculate (`e2e/methodology.spec.ts`, 2)

### How we calculate (2)

| # | Test |
|---|---|
| 158 | lists every red flag and checklist test with its rule |
| 159 | unlisted: no page links to it and search engines are asked not to index it, but it still opens, in Spanish too |

## Accessibility (`e2e/accessibility.spec.ts`, 60)

axe-core checks every state below against WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus best practices; a test fails on any violation and attaches the full axe output. The keyboard tests use only the keyboard.

### Axe: start and results pages (26)

| # | Test |
|---|---|
| 160 | landing page (desktop, light) |
| 161 | landing page (desktop, dark) |
| 162 | landing page (phone, light) |
| 163 | landing page (phone, dark) |
| 164 | results tab: overview (light) |
| 165 | results tab: overview (dark) |
| 166 | results tab: flags (light) |
| 167 | results tab: flags (dark) |
| 168 | results tab: history (light) |
| 169 | results tab: history (dark) |
| 170 | results tab: insiders (light) |
| 171 | results tab: insiders (dark) |
| 172 | results tab: value (light) |
| 173 | results tab: value (dark) |
| 174 | results tab: durable (light) |
| 175 | results tab: durable (dark) |
| 176 | results tab: charts (light) |
| 177 | results tab: charts (dark) |
| 178 | results tab: data (light) |
| 179 | results tab: data (dark) |
| 180 | phone-width results: overview |
| 181 | phone-width results: data |
| 182 | Spanish page |
| 183 | error state |
| 184 | search suggestions open |
| 185 | guide before and after a search |

### Keyboard only (3)

| # | Test |
|---|---|
| 186 | search and results work with the keyboard |
| 187 | wide tables can be scrolled with the keyboard |
| 188 | every interactive element has a name |

### Axe: compare page (7)

| # | Test |
|---|---|
| 189 | compare page: one-side (light) |
| 190 | compare page: one-side (dark) |
| 191 | compare page: both-priced (light) |
| 192 | compare page: both-priced (dark) |
| 193 | compare page: spanish (light) |
| 194 | compare page: spanish (dark) |
| 195 | compare page at phone width |

### Axe: disclaimer page (4)

| # | Test |
|---|---|
| 196 | disclaimer page (en, light) |
| 197 | disclaimer page (en, dark) |
| 198 | disclaimer page (es, light) |
| 199 | disclaimer page (es, dark) |

### Axe: portfolio page (6)

| # | Test |
|---|---|
| 200 | portfolio page (en, light) |
| 201 | portfolio page (en, dark) |
| 202 | portfolio page (es, light) |
| 203 | portfolio page (es, dark) |
| 204 | portfolio page showing a shared list, in both themes |
| 205 | portfolio page at phone width, and empty |

### Axe: S&P 500 pages (5)

| # | Test |
|---|---|
| 206 | S&P 500 picker and picks (en, light) |
| 207 | S&P 500 picker and picks (en, dark) |
| 208 | S&P 500 picker and picks (es, light) |
| 209 | S&P 500 picker and picks (es, dark) |
| 210 | S&P 500 picker at phone width, with 10 picked (the rest disabled) |

### Axe: Funds page (5)

| # | Test |
|---|---|
| 211 | Funds: four funds side by side (en, light) |
| 212 | Funds: four funds side by side (en, dark) |
| 213 | Funds: four funds side by side (es, light) |
| 214 | Funds: four funds side by side (es, dark) |
| 215 | Funds at phone width, empty and with two funds |

### Axe: How we calculate (4)

| # | Test |
|---|---|
| 216 | How we calculate (en, light) |
| 217 | How we calculate (en, dark) |
| 218 | How we calculate (es, light) |
| 219 | How we calculate (es, dark) |
