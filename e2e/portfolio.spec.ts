// My portfolio (portfolio.html): adding and removing stocks, the ten 10-year measures, sorting, saving the list,
// and getting there from the other pages. Elements come from the PortfolioPage and AnalysisPage objects.
import { expect, test } from './fixtures';

// Column positions in the table (0 = the first measure, after the company name)
const COL = { revenue: 0, eps: 1, dps: 2, fcf: 3, bvps: 4, netMargin: 5, roe: 6, rotc: 7, fcfMargin: 8, shares: 9, buffett: 10, balance: 11 };

test.describe('adding and removing stocks', () => {
  test('a stock added by ticker gets a row, and the list is kept in this browser', async ({ portfolio, page, consoleErrors }) => {
    await portfolio.goto();
    await expect(portfolio.empty).toBeVisible();
    await expect(portfolio.addButton).toBeDisabled();
    await portfolio.add('KO');
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO (KO)');
    await expect(portfolio.row('KO')).toContainText('2016–2025');
    expect(await portfolio.savedList()).toBe('KO');
    await expect(page).toHaveURL(/portfolio\.html$/);   // the address never carries the list
    await expect(portfolio.empty).toBeHidden();
    await portfolio.step('come back without the address', () => portfolio.goto());
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO (KO)');  // from this browser's storage
    expect(consoleErrors).toEqual([]);
  });

  test('a company name is turned into its ticker, and a chip adds one', async ({ portfolio }) => {
    await portfolio.goto();
    await portfolio.add('coca cola');
    await expect(portfolio.row('KO')).toBeVisible();
    await portfolio.step('press the AAPL chip', () => portfolio.chip('AAPL').click());
    await expect(portfolio.row('AAPL')).toContainText('Apple Inc. (AAPL)');
    await expect(portfolio.rows).toHaveCount(2);
  });

  test('the same stock twice is not added again', async ({ portfolio }) => {
    await portfolio.goto('add=KO');
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO');
    await portfolio.add('ko');
    await expect(portfolio.status).toHaveText('KO is already in your portfolio');
    await expect(portfolio.rows).toHaveCount(1);
  });

  test('an unknown ticker shows its error in its row and can be removed', async ({ portfolio }) => {
    await portfolio.goto('add=KO');
    await portfolio.add('ZZZZQ');
    await expect(portfolio.row('ZZZZQ')).toContainText("Ticker 'ZZZZQ' not found");
    await portfolio.step('remove ZZZZQ', () => portfolio.removeButton('ZZZZQ').click());
    await expect(portfolio.rows).toHaveCount(1);
    await expect(portfolio.status).toHaveText('ZZZZQ removed');
  });

  test('stocks can be removed one at a time or all at once', async ({ portfolio, page }) => {
    await portfolio.goto('add=KO,AAPL,JPM');
    await expect(portfolio.median).toContainText('Median of 3 stocks');
    await portfolio.step('remove AAPL', () => portfolio.removeButton('AAPL').click());
    await expect(portfolio.rows).toHaveCount(2);
    expect(await portfolio.savedList()).toBe('KO,JPM');
    await portfolio.step('press Remove all', () => portfolio.removeAll.click());
    await expect(portfolio.empty).toBeVisible();
    await expect(page).toHaveURL(/portfolio\.html$/);
  });
});

test.describe('the measures and checklist scores', () => {
  test('each stock shows its 10-year growth, margins, returns and share count, with a median row', async ({ portfolio }) => {
    await portfolio.goto('add=KO,AAPL,INTC,JPM,SMCI');
    await expect(portfolio.median).toContainText('Median of 5 stocks');
    await expect(portfolio.table.getByRole('columnheader')).toHaveCount(14);  // company, ten measures, two checklist scores, remove
    await expect(portfolio.cell('KO', COL.revenue)).toHaveText('+1.5%');
    await expect(portfolio.cell('KO', COL.eps)).toHaveText('+8.2%');
    await expect(portfolio.cell('KO', COL.netMargin)).toHaveText('20.9%');
    await expect(portfolio.cell('AAPL', COL.roe)).toHaveText('91.8%');
    await expect(portfolio.cell('AAPL', COL.shares)).toHaveText('-4.2%');           // buybacks
    await expect(portfolio.cell('SMCI', COL.shares)).toHaveText('+3.4%');           // new shares
    await expect(portfolio.row('SMCI')).toContainText('2017–2026');                 // its own fiscal years
  });

  test('a measure that can\'t be worked out says why', async ({ portfolio }) => {
    await portfolio.goto('add=INTC,JPM,SMCI');
    await expect(portfolio.cell('INTC', COL.eps)).toHaveText(/^n\/a/);
    await expect(portfolio.cell('INTC', COL.eps)).toHaveAttribute('title', 'Zero, negative or a loss in the latest year, so there\'s no growth rate');
    await expect(portfolio.cell('JPM', COL.fcf)).toHaveAttribute('title', 'Not meaningful for banks and insurers');
    await expect(portfolio.cell('SMCI', COL.dps)).toHaveAttribute('title', 'No dividend');
    await expect(portfolio.cell('INTC', COL.dps)).toHaveAttribute('title', 'Dividend suspended or stopped by the latest year');
  });

  test('cells are coloured by simple yardsticks, explained under the table', async ({ portfolio }) => {
    await portfolio.goto('add=KO,AAPL');
    await expect(portfolio.cell('AAPL', COL.eps)).toHaveClass(/good/);   // +15.3% a year
    await expect(portfolio.cell('KO', COL.fcf)).toHaveClass(/bad/);      // -2.3% a year
    await expect(portfolio.cell('KO', COL.revenue)).not.toHaveClass(/good|bad/);
    await expect(portfolio.legend).toContainText("They're a reading aid, not a verdict.");
  });

  test('Buffett criteria met and balance-sheet checks passed, with what wasn\'t met on hover', async ({ portfolio }) => {
    await portfolio.goto('add=KO,INTC,JPM');
    await expect(portfolio.median).toBeVisible();
    // No price on this page, so Buffett's margin-of-safety test isn't counted: 7 judged, not 8
    await expect(portfolio.cell('KO', COL.buffett)).toContainText('7 of 7');
    await expect(portfolio.cell('KO', COL.buffett)).toHaveAttribute('title', 'All met');
    await expect(portfolio.cell('INTC', COL.buffett)).toContainText('2 of 7');
    await expect(portfolio.cell('INTC', COL.buffett)).toHaveClass(/bad/);
    await expect(portfolio.cell('INTC', COL.buffett)).toHaveAttribute('title', /^Not met: Consistent, growing earnings, High return on equity/);
    await expect(portfolio.median.getByRole('cell').nth(COL.buffett)).toHaveText('75% met');
    await expect(portfolio.cell('KO', COL.balance)).toContainText('4 of 5');
    await expect(portfolio.cell('KO', COL.balance)).toHaveAttribute('title', 'Not met: Low debt to equity');
    await expect(portfolio.cell('JPM', COL.balance)).toContainText('3 of 3');           // a bank: the debt tests don't apply
    await expect(portfolio.cell('INTC', COL.balance)).toContainText('3 of 4');          // cancels bought-back shares: no treasury stock, not counted
    await expect(portfolio.cell('JPM', COL.balance)).toHaveAttribute('title', 'All met');
    await expect(portfolio.median.getByRole('cell').nth(COL.balance)).toHaveText('80% met');
    await portfolio.step('open Balance-sheet terms explained', () => portfolio.balanceTerms.locator('summary').click());
    await expect(portfolio.balanceTerms.getByRole('term')).toHaveCount(8);
    await expect(portfolio.balanceTerms).toContainText('Total liabilities divided by shareholders\' equity, with treasury stock added back');
  });

  test('clicking a column sorts by it, best first, and again the other way', async ({ portfolio }) => {
    await portfolio.goto('add=KO,AAPL,JPM');
    await expect(portfolio.median).toBeVisible();
    await portfolio.step('sort by return on equity', () => portfolio.sortButton('Return on equity').click());
    await expect(portfolio.columnHeader(/^Return on equity/)).toHaveAttribute('aria-sort', 'descending');
    await expect(portfolio.rows.first()).toContainText('(AAPL)');
    await expect(portfolio.rows.last()).toContainText('(JPM)');
    await portfolio.step('sort again', () => portfolio.sortButton('Return on equity').click());
    await expect(portfolio.columnHeader(/^Return on equity/)).toHaveAttribute('aria-sort', 'ascending');
    await expect(portfolio.rows.first()).toContainText('(JPM)');
    await expect(portfolio.sortButton('Return on equity')).toBeFocused();
  });
});

test.describe('getting there and language', () => {
  test('My portfolio is in the header, and a result can be added to it', async ({ analysis, portfolio, page }) => {
    await analysis.goto('/');
    await analysis.step('open My portfolio from the header', () => analysis.portfolioLink.click());
    await expect(page).toHaveURL(/portfolio\.html$/);
    await portfolio.add('AAPL');
    await expect(portfolio.row('AAPL')).toBeVisible();
    await analysis.open('KO');
    await analysis.step('press + Add to my portfolio', () => analysis.addToPortfolioLink.click());
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO (KO)');
    await expect(portfolio.row('AAPL')).toBeVisible();                   // added to the saved list, not replacing it
    expect(await portfolio.savedList()).toBe('AAPL,KO');
    await expect(page).toHaveURL(/portfolio\.html$/);
    await portfolio.step('open KO\'s full analysis', () => portfolio.companyLink('KO').click());
    await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
  });

  test('the page reads in Spanish, and the list survives a language switch', async ({ portfolio, page }) => {
    await portfolio.goto('add=KO,INTC&lang=es');
    await expect(page.getByRole('heading', { name: 'Mi cartera' })).toBeVisible();
    await expect(portfolio.columnHeader(/^Crecimiento de ingresos/)).toBeVisible();
    await expect(portfolio.cell('INTC', COL.eps)).toHaveText(/^n\/d/);
    await expect(portfolio.median).toContainText('Mediana de 2 acciones');
    await expect(portfolio.balanceTerms.locator('summary')).toHaveText('Términos del balance explicados');
    await expect(portfolio.balanceTerms.getByRole('term', { includeHidden: true })).toContainText(['Balance', 'Autocartera']);
    await portfolio.switchLanguage('en');
    await expect(portfolio.columnHeader(/^Revenue growth/)).toBeVisible();
    await expect(page).toHaveURL(/portfolio\.html$/);
    await expect(portfolio.rows).toHaveCount(2);
  });

  test('at phone width the table scrolls inside its card, not the page', async ({ portfolio, page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await portfolio.goto('add=KO,AAPL');
    await expect(portfolio.median).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('coming back and sharing', () => {
  test('inside the Android app, Download CSV hands the file to the app instead', async ({ portfolio, page }) => {
    // The app exposes StockValueAndroid.saveFile (it opens the phone's share sheet); stand in for it here
    await page.addInitScript(() => {
      (window as any).StockValueAndroid = { saveFile: (name: string, text: string) => { (window as any).__saved = { name, text }; } };
    });
    await portfolio.goto('add=KO');
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO');
    await portfolio.step('press Download CSV', () => portfolio.csvButton.click());
    const saved = await page.evaluate(() => (window as any).__saved);
    expect(saved.name).toBe('my-portfolio.csv');
    expect(saved.text).toMatch(/^\uFEFFCompany,Ticker,/);
  });

  test('Download CSV saves the table: percentages as numbers, scores as counts', async ({ portfolio }) => {
    await portfolio.goto('add=KO,INTC');
    await expect(portfolio.median).toBeVisible();
    const { name, text } = await portfolio.step('press Download CSV', () => portfolio.downloadCsv());
    expect(name).toBe('my-portfolio.csv');
    const lines = text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Company,Ticker,First year,Latest year,Revenue growth \(%\),/);
    expect(lines[1]).toMatch(/^COCA COLA CO,KO,2016,2025,1\.5,8\.2,/);
    expect(lines[1]).toMatch(/,7 of 7,4 of 5$/);
    expect(lines[2]).toMatch(/^INTEL CORP,INTC,2016,2025,-1\.3,n\/a,/);
  });


  test('coming Back after saving picks from the S&P 500 page shows them, and keeps them', async ({ portfolio, sp500View, page }) => {
    // Regression: the page trusted its old address (?t=KO) over the saved list, then saved that over the new picks
    await portfolio.goto('add=KO');
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO');
    await sp500View.gotoView('t=KO,AAPL');
    await expect(sp500View.median).toBeVisible();
    await sp500View.step('press Save to My portfolio', () => sp500View.save.click());
    await portfolio.step('press the browser\'s Back button', async () => { await page.goBack(); });
    await expect(portfolio.row('AAPL')).toContainText('Apple Inc. (AAPL)');
    await expect(portfolio.rows).toHaveCount(2);
    expect(await portfolio.savedList()).toBe('KO,AAPL');
  });

  test('a save made in another tab shows up in an open My portfolio', async ({ portfolio, context }) => {
    await portfolio.goto('add=KO');
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO');
    const other = await context.newPage();
    await other.goto('/sp500-view.html?t=JPM');
    await other.getByRole('button', { name: 'Save to My portfolio' }).click();
    await expect(portfolio.row('JPM')).toContainText('JPMORGAN CHASE');
    await expect(portfolio.rows).toHaveCount(2);
  });

  test('a shared link shows that list read-only and never replaces mine; Add these merges it in', async ({ portfolio, page }) => {
    await portfolio.goto('add=KO');
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO');
    await portfolio.step('open a link someone shared', () => portfolio.goto('t=AAPL,JPM'));
    await expect(portfolio.sharedBanner).toContainText('A shared list of 2 stocks');
    await expect(portfolio.rows).toHaveCount(2);
    await expect(portfolio.table.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
    await expect(portfolio.searchBox).toBeHidden();
    expect(await portfolio.savedList()).toBe('KO');                   // mine is untouched
    await portfolio.step('press Add these to My portfolio', () => portfolio.addShared.click());
    await expect(portfolio.sharedStatus).toHaveText('Saved 2 to My portfolio.');
    await portfolio.step('go to My portfolio', () => portfolio.goToMine.click());
    await expect(page).toHaveURL(/portfolio\.html$/);
    await expect(portfolio.sharedBanner).toBeHidden();
    await expect(portfolio.rows).toHaveCount(3);
  });

  test('Copy link to share gives a link with the list; opening my own list\'s link shows My portfolio', async ({ portfolio, page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await portfolio.goto('add=KO,AAPL');
    await expect(portfolio.median).toBeVisible();
    await portfolio.step('press Copy link to share', () => portfolio.shareButton.click());
    await expect(portfolio.status).toHaveText(/^Link copied: http:\/\/127\.0\.0\.1:\d+\/portfolio\.html\?t=KO%2CAAPL$/);
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/portfolio\.html\?t=KO%2CAAPL$/);
    await portfolio.step('open that link (my own list)', async () => { await page.goto(link); });
    await expect(portfolio.median).toBeVisible();
    await expect(portfolio.sharedBanner).toBeHidden();
    await expect(page).toHaveURL(/portfolio\.html$/);
  });
});
