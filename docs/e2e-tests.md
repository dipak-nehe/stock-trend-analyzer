# End-to-end tests: 10-Year Stock Value Analysis (web app)

Every browser test in `e2e/`, by feature. The sections below are the `test.describe` groups in the spec files, in the same order, and the same groups appear in the Allure report (under each spec file). They drive the real pages in Chromium (Playwright Test, TypeScript) against the real Python server running on saved SEC filings, so they're offline and repeatable. Each test's named steps carry screenshots, and every test has a video, in the [Allure report](https://stock-trend-test-report.vercel.app). How these fit with the other test layers: [test-plan.md](test-plan.md).

**223 tests:** 104 in `e2e/ui.spec.ts` (start, results and disclaimer pages), 19 in `e2e/compare.spec.ts` (compare page), 19 in `e2e/portfolio.spec.ts` (My portfolio), 11 in `e2e/sp500.spec.ts` (S&P 500 picker and picks), 8 in `e2e/funds.spec.ts` (mutual funds & ETFs), 2 in `e2e/methodology.spec.ts` (How we calculate), 60 in `e2e/accessibility.spec.ts` (WCAG and keyboard). Test companies: AAPL, KO, INTC, JPM (a bank), SMCI (restatement, late filings, exchange notices); funds VOO, VFIAX, FXAIX, SCHD, BND, AGTHX, QQQ.

Regenerate the list with `npx playwright test --list`. Run one group with `npx playwright test -g "<group name>"` (e.g. `-g "insider trades"`). Run one test with `npx playwright test -g "<name>"`.

## Start and results page (`e2e/ui.spec.ts`, 104)

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

### Page basics: layout, privacy and data freshness (8)

| # | Test |
|---|---|
| 97 | the footer links to the author's portfolio site on every page, in both languages |
| 98 | share links for LinkedIn, X and Gmail open the networks' own share pages with the company page |
| 99 | a news link opens Google News for the stock in a new tab, in the page's language |
| 100 | phone layout has no horizontal scroll |
| 101 | page loads nothing from other sites |
| 102 | analytics scripts are not loaded locally |
| 103 | company header says when the data was fetched |
| 104 | saved-copy notice when SEC is unreachable |

## Compare page (`e2e/compare.spec.ts`, 19)

### Opening from a result (2)

| # | Test |
|---|---|
| 105 | compare link appears only after a result |
| 106 | compare link opens with the first stock loaded |

### Loading and comparing (6)

| # | Test |
|---|---|
| 107 | second stock is fetched and compared |
| 108 | the comparison includes the newer measures |
| 109 | both boxes suggest companies by name, and a typed name loads its best match |
| 110 | chip loads the second stock |
| 111 | marks follow direction and sizes get none |
| 112 | bank shows n/a for current ratio |

### Prices and links (4)

| # | Test |
|---|---|
| 113 | valuation rows need prices |
| 114 | deep link with prices restores everything |
| 115 | the comparison can be shared on LinkedIn, X and Gmail |
| 116 | swap switches sides and prices |

### Errors and input (4)

| # | Test |
|---|---|
| 117 | same ticker is rejected |
| 118 | unknown second ticker keeps the first |
| 119 | Compare and Load need a ticker in their box |
| 120 | a quick submit before the script loads is not lost |

### Language, layout and navigation (3)

| # | Test |
|---|---|
| 121 | language carries over and switches |
| 122 | phone width has no sideways scroll |
| 123 | Home leaves the compare page |

## My portfolio (`e2e/portfolio.spec.ts`, 19)

### Adding and removing stocks (5)

| # | Test |
|---|---|
| 124 | a stock added by ticker gets a row, and the list is kept in this browser |
| 125 | a company name is turned into its ticker, and a chip adds one |
| 126 | the same stock twice is not added again |
| 127 | an unknown ticker shows its error in its row and can be removed |
| 128 | stocks can be removed one at a time or all at once |

### The measures and checklist scores (5)

| # | Test |
|---|---|
| 129 | each stock shows its 10-year growth, margins, returns and share count, with a median row |
| 130 | a measure that can't be worked out says why |
| 131 | cells are coloured by simple yardsticks, explained under the table |
| 132 | Buffett criteria met, balance-sheet checks passed and the Piotroski F-score, with what wasn't met on hover |
| 133 | clicking a column sorts by it, best first, and again the other way |

### Getting there and language (3)

| # | Test |
|---|---|
| 134 | My portfolio is in the header, and a result can be added to it |
| 135 | the page reads in Spanish, and the list survives a language switch |
| 136 | at phone width the table scrolls inside its card, not the page |

### Coming back and sharing (6)

| # | Test |
|---|---|
| 137 | inside the Android app, Download CSV hands the file to the app instead |
| 138 | Download CSV saves the table: percentages as numbers, scores as counts |
| 139 | coming Back after saving picks from the S&P 500 page shows them, and keeps them |
| 140 | a save made in another tab shows up in an open My portfolio |
| 141 | a shared link shows that list read-only and never replaces mine; Add these merges it in |
| 142 | Copy link to share gives a link with the list; opening my own list's link shows My portfolio |

## S&P 500 picker and picks (`e2e/sp500.spec.ts`, 11)

### Picking companies (4)

| # | Test |
|---|---|
| 143 | the list can be searched by name or ticker and filtered by sector |
| 144 | ticked companies show in the selection bar, and Show waits for at least one |
| 145 | no more than 10 can be picked: the others are disabled until one is removed |
| 146 | a link with more than 10 keeps the first 10 and says so |

### Showing the picks (4)

| # | Test |
|---|---|
| 147 | Show opens them side by side, read-only, and Change selection keeps the ticks |
| 148 | Save to My portfolio adds them to the saved list, without duplicates |
| 149 | viewing picks never changes My portfolio by itself |
| 150 | more than 10 in the address: the first 10 are loaded, with a note |

### Getting there, language and layout (3)

| # | Test |
|---|---|
| 151 | S&P 500 is in the header of every page |
| 152 | both pages read in Spanish, and the language carries over |
| 153 | at phone width neither page scrolls sideways |

## Mutual funds & ETFs (`e2e/funds.spec.ts`, 8)

### One fund (2)

| # | Test |
|---|---|
| 154 | a fund added by ticker shows its costs, returns against its index, portfolio and source |
| 155 | a half-year report shows costs and portfolio, and says it has no returns |

### Comparing funds (2)

| # | Test |
|---|---|
| 156 | up to four side by side, with the lower cost, higher return and lower turnover marked |
| 157 | a shared link opens the same funds, in Spanish too |

### Overlap, growth and ups and downs (2)

| # | Test |
|---|---|
| 158 | two share classes of one fund are the same portfolio; other pairs show what they share |
| 159 | growth of $10,000 against the index, the worst year, and a chart that does not add up is left out |

### Errors (1)

| # | Test |
|---|---|
| 160 | a ticker that is not a fund, a trust without reports, a duplicate |

### Navigation (1)

| # | Test |
|---|---|
| 161 | every page links to Funds next to S&P 500, keeping the language |

## How we calculate (`e2e/methodology.spec.ts`, 2)

### How we calculate (2)

| # | Test |
|---|---|
| 162 | lists every red flag and checklist test with its rule |
| 163 | unlisted: no page links to it and search engines are asked not to index it, but it still opens, in Spanish too |

## Accessibility (`e2e/accessibility.spec.ts`, 60)

axe-core checks every state below against WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus best practices; a test fails on any violation and attaches the full axe output. The keyboard tests use only the keyboard.

### Axe: start and results pages (26)

| # | Test |
|---|---|
| 164 | landing page (desktop, light) |
| 165 | landing page (desktop, dark) |
| 166 | landing page (phone, light) |
| 167 | landing page (phone, dark) |
| 168 | results tab: overview (light) |
| 169 | results tab: overview (dark) |
| 170 | results tab: flags (light) |
| 171 | results tab: flags (dark) |
| 172 | results tab: history (light) |
| 173 | results tab: history (dark) |
| 174 | results tab: insiders (light) |
| 175 | results tab: insiders (dark) |
| 176 | results tab: value (light) |
| 177 | results tab: value (dark) |
| 178 | results tab: durable (light) |
| 179 | results tab: durable (dark) |
| 180 | results tab: charts (light) |
| 181 | results tab: charts (dark) |
| 182 | results tab: data (light) |
| 183 | results tab: data (dark) |
| 184 | phone-width results: overview |
| 185 | phone-width results: data |
| 186 | Spanish page |
| 187 | error state |
| 188 | search suggestions open |
| 189 | guide before and after a search |

### Keyboard only (3)

| # | Test |
|---|---|
| 190 | search and results work with the keyboard |
| 191 | wide tables can be scrolled with the keyboard |
| 192 | every interactive element has a name |

### Axe: compare page (7)

| # | Test |
|---|---|
| 193 | compare page: one-side (light) |
| 194 | compare page: one-side (dark) |
| 195 | compare page: both-priced (light) |
| 196 | compare page: both-priced (dark) |
| 197 | compare page: spanish (light) |
| 198 | compare page: spanish (dark) |
| 199 | compare page at phone width |

### Axe: disclaimer page (4)

| # | Test |
|---|---|
| 200 | disclaimer page (en, light) |
| 201 | disclaimer page (en, dark) |
| 202 | disclaimer page (es, light) |
| 203 | disclaimer page (es, dark) |

### Axe: portfolio page (6)

| # | Test |
|---|---|
| 204 | portfolio page (en, light) |
| 205 | portfolio page (en, dark) |
| 206 | portfolio page (es, light) |
| 207 | portfolio page (es, dark) |
| 208 | portfolio page showing a shared list, in both themes |
| 209 | portfolio page at phone width, and empty |

### Axe: S&P 500 pages (5)

| # | Test |
|---|---|
| 210 | S&P 500 picker and picks (en, light) |
| 211 | S&P 500 picker and picks (en, dark) |
| 212 | S&P 500 picker and picks (es, light) |
| 213 | S&P 500 picker and picks (es, dark) |
| 214 | S&P 500 picker at phone width, with 10 picked (the rest disabled) |

### Axe: Funds page (5)

| # | Test |
|---|---|
| 215 | Funds: four funds side by side (en, light) |
| 216 | Funds: four funds side by side (en, dark) |
| 217 | Funds: four funds side by side (es, light) |
| 218 | Funds: four funds side by side (es, dark) |
| 219 | Funds at phone width, empty and with two funds |

### Axe: How we calculate (4)

| # | Test |
|---|---|
| 220 | How we calculate (en, light) |
| 221 | How we calculate (en, dark) |
| 222 | How we calculate (es, light) |
| 223 | How we calculate (es, dark) |
