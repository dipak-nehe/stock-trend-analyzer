# End-to-end tests: 10-Year Stock Value Analysis (web app)

Every browser test in `e2e/`, by feature. The sections below are the `test.describe` groups in the spec files, in the same order, and the same groups appear in the Allure report (under each spec file). They drive the real pages in Chromium (Playwright Test, TypeScript) against the real Python server running on saved SEC filings, so they're offline and repeatable. Each test's named steps carry screenshots, and every test has a video, in the [Allure report](https://stock-trend-test-report.vercel.app). How these fit with the other test layers: [test-plan.md](test-plan.md).

**204 tests:** 99 in `e2e/ui.spec.ts` (start, results and disclaimer pages), 18 in `e2e/compare.spec.ts` (compare page), 19 in `e2e/portfolio.spec.ts` (My portfolio), 11 in `e2e/sp500.spec.ts` (S&P 500 picker and picks), 2 in `e2e/methodology.spec.ts` (How we calculate), 55 in `e2e/accessibility.spec.ts` (WCAG and keyboard). Test companies: AAPL, KO, INTC, JPM (a bank), SMCI (restatement, late filings, exchange notices).

Regenerate the list with `npx playwright test --list`. Run one group with `npx playwright test -g "<group name>"` (e.g. `-g "insider trades"`). Run one test with `npx playwright test -g "<name>"`.

## Start and results page (`e2e/ui.spec.ts`, 99)

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

### Overview and trends (5)

| # | Test |
|---|---|
| 43 | growth table compares first and latest year |
| 44 | loss-making company is described in words |
| 45 | a company that never paid a dividend says so in the growth table |
| 46 | trend tiles show a sparkline |
| 47 | jargon is explained |

### Red flags and SEC history (5)

| # | Test |
|---|---|
| 48 | restatements and late filings are flagged |
| 49 | filing history filters and expands |
| 50 | clean filer gets a strength |
| 51 | "Show all" keeps the price and raises no errors |
| 52 | red flags are grouped with explanations |

### Graham & Buffett and the share price (16)

| # | Test |
|---|---|
| 53 | price runs valuation tests and is kept in the URL |
| 54 | price from link is applied on load |
| 55 | new search clears the previous price |
| 56 | Peter Lynch: PEG, dividend-adjusted, fair value and debt, from 5 years of EPS growth |
| 57 | checklist scores add up |
| 58 | the latest 12 months from quarterly reports show on the Overview, against the last fiscal year |
| 59 | the Overview compares the company with its industry |
| 60 | a small industry falls back to related industries, and banks get only growth and return on equity |
| 61 | R&D spending shows on the Overview for companies that report it, and not otherwise |
| 62 | the value estimate can be recalculated with your own assumptions, and reset |
| 63 | the Durable advantage tab scores the statements, with the figures behind each test |
| 64 | return on tangible capital, the Piotroski F-score and the yields show on the value tab |
| 65 | bank-specific rules are skipped |
| 66 | checklist scores have a bar |
| 67 | value tab is named after Graham and Buffett |
| 68 | price box links to public quote pages |

### Insider trades (Form 4) (6)

| # | Test |
|---|---|
| 69 | insider trades: open-market buys and sales in the last 12 months, with the filings |
| 70 | several insiders buying is called out in the Insiders tab |
| 71 | insider trades in Spanish |
| 72 | insider trades load only when the Insiders tab is opened, and only once |
| 73 | a link to the Insiders tab loads them straight away |
| 74 | insider trades that fail to load can be tried again |

### Spanish and language choice (10)

| # | Test |
|---|---|
| 75 | Spanish link shows the whole page in Spanish |
| 76 | English browser gets English |
| 77 | switching language keeps tab and price and updates the link |
| 78 | language choice is remembered |
| 79 | Spanish stays on across every page after pressing ES |
| 80 | Spanish stays on across every page after a Spanish link |
| 81 | switching back to English is remembered the same way |
| 82 | errors are translated |
| 83 | no English left in Spanish results |
| 84 | gets Spanish automatically |

### Home button (3)

| # | Test |
|---|---|
| 85 | Home button returns to a fresh landing page |
| 86 | Home keeps the language |
| 87 | Home button appears only after a lookup |

### Disclaimer (4)

| # | Test |
|---|---|
| 88 | disclaimer is always visible, at the bottom of the page |
| 89 | the short notice and the footer link to the full disclaimer |
| 90 | the compare page links to the full disclaimer too |
| 91 | the disclaimer reads in Spanish, from Spanish pages and by switching |

### Company pages (2)

| # | Test |
|---|---|
| 92 | /stock/KO opens Coca-Cola with its own title, and keeps that address |
| 93 | an unknown company page shows the usual error, and the sitemap lists the company pages |

### Downloads (1)

| # | Test |
|---|---|
| 94 | the Data tab downloads every figure as CSV, as filed |

### Page basics: layout, privacy and data freshness (5)

| # | Test |
|---|---|
| 95 | phone layout has no horizontal scroll |
| 96 | page loads nothing from other sites |
| 97 | analytics scripts are not loaded locally |
| 98 | company header says when the data was fetched |
| 99 | saved-copy notice when SEC is unreachable |

## Compare page (`e2e/compare.spec.ts`, 18)

### Opening from a result (2)

| # | Test |
|---|---|
| 100 | compare link appears only after a result |
| 101 | compare link opens with the first stock loaded |

### Loading and comparing (6)

| # | Test |
|---|---|
| 102 | second stock is fetched and compared |
| 103 | the comparison includes the newer measures |
| 104 | both boxes suggest companies by name, and a typed name loads its best match |
| 105 | chip loads the second stock |
| 106 | marks follow direction and sizes get none |
| 107 | bank shows n/a for current ratio |

### Prices and links (3)

| # | Test |
|---|---|
| 108 | valuation rows need prices |
| 109 | deep link with prices restores everything |
| 110 | swap switches sides and prices |

### Errors and input (4)

| # | Test |
|---|---|
| 111 | same ticker is rejected |
| 112 | unknown second ticker keeps the first |
| 113 | Compare and Load need a ticker in their box |
| 114 | a quick submit before the script loads is not lost |

### Language, layout and navigation (3)

| # | Test |
|---|---|
| 115 | language carries over and switches |
| 116 | phone width has no sideways scroll |
| 117 | Home leaves the compare page |

## My portfolio (`e2e/portfolio.spec.ts`, 19)

### Adding and removing stocks (5)

| # | Test |
|---|---|
| 118 | a stock added by ticker gets a row, and the list is kept in this browser |
| 119 | a company name is turned into its ticker, and a chip adds one |
| 120 | the same stock twice is not added again |
| 121 | an unknown ticker shows its error in its row and can be removed |
| 122 | stocks can be removed one at a time or all at once |

### The measures and checklist scores (5)

| # | Test |
|---|---|
| 123 | each stock shows its 10-year growth, margins, returns and share count, with a median row |
| 124 | a measure that can't be worked out says why |
| 125 | cells are coloured by simple yardsticks, explained under the table |
| 126 | Buffett criteria met and balance-sheet checks passed, with what wasn't met on hover |
| 127 | clicking a column sorts by it, best first, and again the other way |

### Getting there and language (3)

| # | Test |
|---|---|
| 128 | My portfolio is in the header, and a result can be added to it |
| 129 | the page reads in Spanish, and the list survives a language switch |
| 130 | at phone width the table scrolls inside its card, not the page |

### Coming back and sharing (6)

| # | Test |
|---|---|
| 131 | inside the Android app, Download CSV hands the file to the app instead |
| 132 | Download CSV saves the table: percentages as numbers, scores as counts |
| 133 | coming Back after saving picks from the S&P 500 page shows them, and keeps them |
| 134 | a save made in another tab shows up in an open My portfolio |
| 135 | a shared link shows that list read-only and never replaces mine; Add these merges it in |
| 136 | Copy link to share gives a link with the list; opening my own list's link shows My portfolio |

## S&P 500 picker and picks (`e2e/sp500.spec.ts`, 11)

### Picking companies (4)

| # | Test |
|---|---|
| 137 | the list can be searched by name or ticker and filtered by sector |
| 138 | ticked companies show in the selection bar, and Show waits for at least one |
| 139 | no more than 10 can be picked: the others are disabled until one is removed |
| 140 | a link with more than 10 keeps the first 10 and says so |

### Showing the picks (4)

| # | Test |
|---|---|
| 141 | Show opens them side by side, read-only, and Change selection keeps the ticks |
| 142 | Save to My portfolio adds them to the saved list, without duplicates |
| 143 | viewing picks never changes My portfolio by itself |
| 144 | more than 10 in the address: the first 10 are loaded, with a note |

### Getting there, language and layout (3)

| # | Test |
|---|---|
| 145 | S&P 500 is in the header of every page |
| 146 | both pages read in Spanish, and the language carries over |
| 147 | at phone width neither page scrolls sideways |

## How we calculate (`e2e/methodology.spec.ts`, 2)

### How we calculate (2)

| # | Test |
|---|---|
| 148 | lists every red flag and checklist test with its rule |
| 149 | every page links to it in the footer, keeping the language |

## Accessibility (`e2e/accessibility.spec.ts`, 55)

axe-core checks every state below against WCAG 2.0, 2.1 and 2.2 (levels A and AA) plus best practices; a test fails on any violation and attaches the full axe output. The keyboard tests use only the keyboard.

### Axe: start and results pages (26)

| # | Test |
|---|---|
| 150 | landing page (desktop, light) |
| 151 | landing page (desktop, dark) |
| 152 | landing page (phone, light) |
| 153 | landing page (phone, dark) |
| 154 | results tab: overview (light) |
| 155 | results tab: overview (dark) |
| 156 | results tab: flags (light) |
| 157 | results tab: flags (dark) |
| 158 | results tab: history (light) |
| 159 | results tab: history (dark) |
| 160 | results tab: insiders (light) |
| 161 | results tab: insiders (dark) |
| 162 | results tab: value (light) |
| 163 | results tab: value (dark) |
| 164 | results tab: durable (light) |
| 165 | results tab: durable (dark) |
| 166 | results tab: charts (light) |
| 167 | results tab: charts (dark) |
| 168 | results tab: data (light) |
| 169 | results tab: data (dark) |
| 170 | phone-width results: overview |
| 171 | phone-width results: data |
| 172 | Spanish page |
| 173 | error state |
| 174 | search suggestions open |
| 175 | guide before and after a search |

### Keyboard only (3)

| # | Test |
|---|---|
| 176 | search and results work with the keyboard |
| 177 | wide tables can be scrolled with the keyboard |
| 178 | every interactive element has a name |

### Axe: compare page (7)

| # | Test |
|---|---|
| 179 | compare page: one-side (light) |
| 180 | compare page: one-side (dark) |
| 181 | compare page: both-priced (light) |
| 182 | compare page: both-priced (dark) |
| 183 | compare page: spanish (light) |
| 184 | compare page: spanish (dark) |
| 185 | compare page at phone width |

### Axe: disclaimer page (4)

| # | Test |
|---|---|
| 186 | disclaimer page (en, light) |
| 187 | disclaimer page (en, dark) |
| 188 | disclaimer page (es, light) |
| 189 | disclaimer page (es, dark) |

### Axe: portfolio page (6)

| # | Test |
|---|---|
| 190 | portfolio page (en, light) |
| 191 | portfolio page (en, dark) |
| 192 | portfolio page (es, light) |
| 193 | portfolio page (es, dark) |
| 194 | portfolio page showing a shared list, in both themes |
| 195 | portfolio page at phone width, and empty |

### Axe: S&P 500 pages (5)

| # | Test |
|---|---|
| 196 | S&P 500 picker and picks (en, light) |
| 197 | S&P 500 picker and picks (en, dark) |
| 198 | S&P 500 picker and picks (es, light) |
| 199 | S&P 500 picker and picks (es, dark) |
| 200 | S&P 500 picker at phone width, with 10 picked (the rest disabled) |

### Axe: How we calculate (4)

| # | Test |
|---|---|
| 201 | How we calculate (en, light) |
| 202 | How we calculate (en, dark) |
| 203 | How we calculate (es, light) |
| 204 | How we calculate (es, dark) |
