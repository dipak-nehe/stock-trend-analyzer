# End-to-end tests: 10-Year Stock Value Analysis (web app)

Every browser test in `e2e/`, by feature. The sections below are the `test.describe` groups in the spec files, in the same order, and the same groups appear in the Allure report (under each spec file). They drive the real pages in Chromium (Playwright Test, TypeScript) against the real Python server running on saved SEC filings, so they're offline and repeatable. Each test's named steps carry screenshots, and every test has a video, in the [Allure report](https://stock-trend-test-report.vercel.app). How these fit with the other test layers: [test-plan.md](test-plan.md).

**242 tests:** 113 in `e2e/ui.spec.ts` (start, results and disclaimer pages), 19 in `e2e/compare.spec.ts` (compare page), 19 in `e2e/portfolio.spec.ts` (My portfolio), 11 in `e2e/sp500.spec.ts` (S&P 500 picker and picks), 3 in `e2e/companies.spec.ts` (All companies), 8 in `e2e/funds.spec.ts` (mutual funds & ETFs), 2 in `e2e/methodology.spec.ts` (How we calculate), 67 in `e2e/accessibility.spec.ts` (WCAG and keyboard). Test companies: AAPL, KO, INTC, JPM (a bank), SMCI (restatement, late filings, exchange notices); funds VOO, VFIAX, FXAIX, SCHD, BND, AGTHX, QQQ.

Regenerate the list with `npx playwright test --list`. Run one group with `npx playwright test -g "<group name>"` (e.g. `-g "insider trades"`). Run one test with `npx playwright test -g "<name>"`.

## Start and results page (`e2e/ui.spec.ts`, 113)

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

### Results guide (6)

| # | Test |
|---|---|
| 24 | the start page shows what you get: the guide starts open and can be folded away |
| 25 | the start page has a big title and a trust line; the results get a normal title and no trust line |
| 26 | guide collapses after a search and can be reopened |
| 27 | guide card before a search shows an example on that tab |
| 28 | guide card after a search opens its tab for that company |
| 29 | guide toggle looks and reads like a control |

### At a glance (5)

| # | Test |
|---|---|
| 30 | glance summarises each area in one line |
| 31 | glance rows open their tab |
| 32 | clean company glance and badges |
| 33 | badges count serious problems |
| 34 | glance has a title and hint |

### Tabs (10)

| # | Test |
|---|---|
| 35 | tab tour: each tab opens alone, updates the address and shows its content |
| 36 | each tab has a short explanation |
| 37 | link with a tab opens that tab |
| 38 | tabs work with the keyboard |
| 39 | charts are drawn only when their tab opens |
| 40 | new search stays on the current tab |
| 41 | previous and next buttons walk through the tabs |
| 42 | tabs carry the same icons as the guide |
| 43 | previous/next buttons sit at the bottom of every tab |
| 44 | phone tab bar keeps the active tab in view |

### Overview and trends (5)

| # | Test |
|---|---|
| 45 | growth table compares first and latest year |
| 46 | loss-making company is described in words |
| 47 | a company that never paid a dividend says so in the growth table |
| 48 | trend tiles show a sparkline |
| 49 | jargon is explained |

### Red flags and SEC history (5)

| # | Test |
|---|---|
| 50 | restatements and late filings are flagged |
| 51 | filing history filters and expands |
| 52 | clean filer gets a strength |
| 53 | "Show all" keeps the price and raises no errors |
| 54 | red flags are grouped with explanations |

### Buffett & Graham and the share price (18)

| # | Test |
|---|---|
| 55 | price runs valuation tests and is kept in the URL |
| 56 | a bank gets owner earnings from its earnings: value, yield and margin of safety |
| 57 | business first, price last: the checklists, then the estimates, then the valuation at the price |
| 58 | price from link is applied on load |
| 59 | new search clears the previous price |
| 60 | Peter Lynch: PEG, dividend-adjusted, fair value and debt, from 5 years of EPS growth |
| 61 | checklist scores add up |
| 62 | the latest 12 months from quarterly reports show on the Overview, against the last fiscal year |
| 63 | the Overview compares the company with its industry |
| 64 | a small industry falls back to related industries, and banks get only growth and return on equity |
| 65 | R&D spending shows on the Overview for companies that report it, and not otherwise |
| 66 | the value estimate can be recalculated with your own assumptions, and reset |
| 67 | the Durable advantage tab scores the statements, with the figures behind each test |
| 68 | return on tangible capital, the Piotroski F-score and the yields show on the value tab |
| 69 | bank-specific rules are skipped |
| 70 | checklist scores have a bar |
| 71 | value tab is named after Graham and Buffett |
| 72 | price box links to public quote pages |

### Insider trades (Form 4) (6)

| # | Test |
|---|---|
| 73 | insider trades: open-market buys and sales in the last 12 months, with the filings |
| 74 | several insiders buying is called out in the Insiders tab |
| 75 | insider trades in Spanish |
| 76 | insider trades load only when the Insiders tab is opened, and only once |
| 77 | a link to the Insiders tab loads them straight away |
| 78 | insider trades that fail to load can be tried again |

### Spanish and language choice (10)

| # | Test |
|---|---|
| 79 | Spanish link shows the whole page in Spanish |
| 80 | English browser gets English |
| 81 | switching language keeps tab and price and updates the link |
| 82 | language choice is remembered |
| 83 | Spanish stays on across every page after pressing ES |
| 84 | Spanish stays on across every page after a Spanish link |
| 85 | switching back to English is remembered the same way |
| 86 | errors are translated |
| 87 | no English left in Spanish results |
| 88 | gets Spanish automatically |

### Main menu (10)

| # | Test |
|---|---|
| 89 | Stocks returns to a fresh start page |
| 90 | Stocks keeps the language |
| 91 | /: the same menu in task order, with Stocks marked as the current page |
| 92 | /compare.html: the same menu in task order, with Compare marked as the current page |
| 93 | /sp500.html: the same menu in task order, with S&P 500 marked as the current page |
| 94 | /companies.html: the same menu in task order, with All companies marked as the current page |
| 95 | /funds.html: the same menu in task order, with Funds & ETFs marked as the current page |
| 96 | /portfolio.html: the same menu in task order, with My portfolio marked as the current page |
| 97 | /disclaimer.html: the same menu in task order, with no item marked as the current page |
| 98 | the menu reads in Spanish and its links keep the language |

### Disclaimer (4)

| # | Test |
|---|---|
| 99 | disclaimer is always visible, at the bottom of the page |
| 100 | the short notice and the footer link to the full disclaimer |
| 101 | the compare page links to the full disclaimer too |
| 102 | the disclaimer reads in Spanish, from Spanish pages and by switching |

### Company pages (2)

| # | Test |
|---|---|
| 103 | /stock/KO opens Coca-Cola with its own title, and keeps that address |
| 104 | an unknown company page shows the usual error, and the sitemap lists the company pages |

### Downloads (1)

| # | Test |
|---|---|
| 105 | the Data tab downloads every figure as CSV, as filed |

### Page basics: layout, privacy and data freshness (8)

| # | Test |
|---|---|
| 106 | the footer links to the author's portfolio site on every page, in both languages |
| 107 | share links for LinkedIn, X and Gmail open the networks' own share pages with the company page |
| 108 | a news link opens Google News for the stock in a new tab, in the page's language |
| 109 | phone layout has no horizontal scroll |
| 110 | page loads nothing from other sites |
| 111 | analytics scripts are not loaded locally |
| 112 | company header says when the data was fetched |
| 113 | saved-copy notice when SEC is unreachable |

## Compare page (`e2e/compare.spec.ts`, 19)

### Opening from a result (2)

| # | Test |
|---|---|
| 114 | compare link appears only after a result |
| 115 | compare link opens with the first stock loaded |

### Loading and comparing (6)

| # | Test |
|---|---|
| 116 | second stock is fetched and compared |
| 117 | the comparison includes the newer measures |
| 118 | both boxes suggest companies by name, and a typed name loads its best match |
| 119 | chip loads the second stock |
| 120 | marks follow direction and sizes get none |
| 121 | bank shows n/a for current ratio |

### Prices and links (4)

| # | Test |
|---|---|
| 122 | valuation rows need prices |
| 123 | deep link with prices restores everything |
| 124 | the comparison can be shared on LinkedIn, X and Gmail |
| 125 | swap switches sides and prices |

### Errors and input (4)

| # | Test |
|---|---|
| 126 | same ticker is rejected |
| 127 | unknown second ticker keeps the first |
| 128 | Compare and Load need a ticker in their box |
| 129 | a quick submit before the script loads is not lost |

### Language, layout and navigation (3)

| # | Test |
|---|---|
| 130 | language carries over and switches |
| 131 | phone width has no sideways scroll |
| 132 | Home leaves the compare page |

## My portfolio (`e2e/portfolio.spec.ts`, 19)

### Adding and removing stocks (5)

| # | Test |
|---|---|
| 133 | a stock added by ticker gets a row, and the list is kept in this browser |
| 134 | a company name is turned into its ticker, and a chip adds one |
| 135 | the same stock twice is not added again |
| 136 | an unknown ticker shows its error in its row and can be removed |
| 137 | stocks can be removed one at a time or all at once |

### The measures and checklist scores (5)

| # | Test |
|---|---|
| 138 | each stock shows its 10-year growth, margins, returns and share count, with a median row |
| 139 | a measure that can't be worked out says why |
| 140 | cells are coloured by simple yardsticks, explained under the table |
| 141 | Buffett criteria met, balance-sheet checks passed and the Piotroski F-score, with what wasn't met on hover |
| 142 | clicking a column sorts by it, best first, and again the other way |

### Getting there and language (3)

| # | Test |
|---|---|
| 143 | My portfolio is in the header, and a result can be added to it |
| 144 | the page reads in Spanish, and the list survives a language switch |
| 145 | at phone width the table scrolls inside its card, not the page |

### Coming back and sharing (6)

| # | Test |
|---|---|
| 146 | inside the Android app, Download CSV hands the file to the app instead |
| 147 | Download CSV saves the table: percentages as numbers, scores as counts |
| 148 | coming Back after saving picks from the S&P 500 page shows them, and keeps them |
| 149 | a save made in another tab shows up in an open My portfolio |
| 150 | a shared link shows that list read-only and never replaces mine; Add these merges it in |
| 151 | Copy link to share gives a link with the list; opening my own list's link shows My portfolio |

## S&P 500 picker and picks (`e2e/sp500.spec.ts`, 11)

### Picking companies (4)

| # | Test |
|---|---|
| 152 | the list can be searched by name or ticker and filtered by sector |
| 153 | ticked companies show in the selection bar, and Show waits for at least one |
| 154 | no more than 10 can be picked: the others are disabled until one is removed |
| 155 | a link with more than 10 keeps the first 10 and says so |

### Showing the picks (4)

| # | Test |
|---|---|
| 156 | Show opens them side by side, read-only, and Change selection keeps the ticks |
| 157 | Save to My portfolio adds them to the saved list, without duplicates |
| 158 | viewing picks never changes My portfolio by itself |
| 159 | more than 10 in the address: the first 10 are loaded, with a note |

### Getting there, language and layout (3)

| # | Test |
|---|---|
| 160 | S&P 500 is in the header of every page |
| 161 | both pages read in Spanish, and the language carries over |
| 162 | at phone width neither page scrolls sideways |

## All companies (`e2e/companies.spec.ts`, 3)

### The list (3)

| # | Test |
|---|---|
| 163 | every company with its ticker, exchange and industry, each linking to its analysis |
| 164 | search, industry and exchange filters, kept in the address |
| 165 | sorting by a column, and again the other way; a shared link opens the same view |

## Mutual funds & ETFs (`e2e/funds.spec.ts`, 8)

### One fund (2)

| # | Test |
|---|---|
| 166 | a fund added by ticker shows its costs, returns against its index, portfolio and source |
| 167 | a half-year report shows costs and portfolio, and says it has no returns |

### Comparing funds (2)

| # | Test |
|---|---|
| 168 | up to four side by side, with the lower cost, higher return and lower turnover marked |
| 169 | a shared link opens the same funds, in Spanish too |

### Overlap, growth and ups and downs (2)

| # | Test |
|---|---|
| 170 | two share classes of one fund are the same portfolio; other pairs show what they share |
| 171 | growth of $10,000 against the index, the worst year, and a chart that does not add up is left out |

### Errors (1)

| # | Test |
|---|---|
| 172 | a ticker that is not a fund, a trust without reports, a duplicate |

### Navigation (1)

| # | Test |
|---|---|
| 173 | every page links to All companies and Funds after S&P 500, keeping the language |

## How we calculate (`e2e/methodology.spec.ts`, 2)

### How we calculate (2)

| # | Test |
|---|---|
| 174 | lists every red flag and checklist test with its rule |
| 175 | unlisted: no page links to it and search engines are asked not to index it, but it still opens, in Spanish too |

## Accessibility (`e2e/accessibility.spec.ts`, 67)

axe-core checks every state below against WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus best practices; a test fails on any violation and attaches the full axe output. The keyboard tests use only the keyboard.

### Axe: start and results pages (26)

| # | Test |
|---|---|
| 176 | landing page (desktop, light) |
| 177 | landing page (desktop, dark) |
| 178 | landing page (phone, light) |
| 179 | landing page (phone, dark) |
| 180 | results tab: overview (light) |
| 181 | results tab: overview (dark) |
| 182 | results tab: flags (light) |
| 183 | results tab: flags (dark) |
| 184 | results tab: history (light) |
| 185 | results tab: history (dark) |
| 186 | results tab: insiders (light) |
| 187 | results tab: insiders (dark) |
| 188 | results tab: value (light) |
| 189 | results tab: value (dark) |
| 190 | results tab: durable (light) |
| 191 | results tab: durable (dark) |
| 192 | results tab: charts (light) |
| 193 | results tab: charts (dark) |
| 194 | results tab: data (light) |
| 195 | results tab: data (dark) |
| 196 | phone-width results: overview |
| 197 | phone-width results: data |
| 198 | Spanish page |
| 199 | error state |
| 200 | search suggestions open |
| 201 | guide before and after a search |

### Axe: main menu at every phone width (2)

| # | Test |
|---|---|
| 202 | /: no menu button is covered or too small to tap, 320 to 640px |
| 203 | /?lang=es: no menu button is covered or too small to tap, 320 to 640px |

### Keyboard only (3)

| # | Test |
|---|---|
| 204 | search and results work with the keyboard |
| 205 | wide tables can be scrolled with the keyboard |
| 206 | every interactive element has a name |

### Axe: compare page (7)

| # | Test |
|---|---|
| 207 | compare page: one-side (light) |
| 208 | compare page: one-side (dark) |
| 209 | compare page: both-priced (light) |
| 210 | compare page: both-priced (dark) |
| 211 | compare page: spanish (light) |
| 212 | compare page: spanish (dark) |
| 213 | compare page at phone width |

### Axe: disclaimer page (4)

| # | Test |
|---|---|
| 214 | disclaimer page (en, light) |
| 215 | disclaimer page (en, dark) |
| 216 | disclaimer page (es, light) |
| 217 | disclaimer page (es, dark) |

### Axe: portfolio page (6)

| # | Test |
|---|---|
| 218 | portfolio page (en, light) |
| 219 | portfolio page (en, dark) |
| 220 | portfolio page (es, light) |
| 221 | portfolio page (es, dark) |
| 222 | portfolio page showing a shared list, in both themes |
| 223 | portfolio page at phone width, and empty |

### Axe: S&P 500 pages (5)

| # | Test |
|---|---|
| 224 | S&P 500 picker and picks (en, light) |
| 225 | S&P 500 picker and picks (en, dark) |
| 226 | S&P 500 picker and picks (es, light) |
| 227 | S&P 500 picker and picks (es, dark) |
| 228 | S&P 500 picker at phone width, with 10 picked (the rest disabled) |

### Axe: All companies (5)

| # | Test |
|---|---|
| 229 | All companies, filtered and sorted (en, light) |
| 230 | All companies, filtered and sorted (en, dark) |
| 231 | All companies, filtered and sorted (es, light) |
| 232 | All companies, filtered and sorted (es, dark) |
| 233 | All companies at phone width |

### Axe: Funds page (5)

| # | Test |
|---|---|
| 234 | Funds: four funds side by side (en, light) |
| 235 | Funds: four funds side by side (en, dark) |
| 236 | Funds: four funds side by side (es, light) |
| 237 | Funds: four funds side by side (es, dark) |
| 238 | Funds at phone width, empty and with two funds |

### Axe: How we calculate (4)

| # | Test |
|---|---|
| 239 | How we calculate (en, light) |
| 240 | How we calculate (en, dark) |
| 241 | How we calculate (es, light) |
| 242 | How we calculate (es, dark) |
