// My portfolio (portfolio.html): adding and removing stocks, the ten 10-year measures, sorting, saving the list,
// and getting there from the other pages. Elements come from the PortfolioPage and AnalysisPage objects.
import { expect, test } from './fixtures';

// Column positions in the table (0 = the first measure, after the company name)
const COL = { revenue: 0, eps: 1, dps: 2, fcf: 3, bvps: 4, netMargin: 5, roe: 6, rotc: 7, fcfMargin: 8, shares: 9 };

test.describe('adding and removing stocks', () => {
  test('a stock added by ticker gets a row, and the list is kept in the address and in the browser', async ({ portfolio, page, consoleErrors }) => {
    await portfolio.goto();
    await expect(portfolio.empty).toBeVisible();
    await expect(portfolio.addButton).toBeDisabled();
    await portfolio.add('KO');
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO (KO)');
    await expect(portfolio.row('KO')).toContainText('2016–2025');
    await expect(page).toHaveURL(/\?t=KO$/);
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
    await portfolio.goto('t=KO');
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO');
    await portfolio.add('ko');
    await expect(portfolio.status).toHaveText('KO is already in your portfolio');
    await expect(portfolio.rows).toHaveCount(1);
  });

  test('an unknown ticker shows its error in its row and can be removed', async ({ portfolio }) => {
    await portfolio.goto('t=KO');
    await portfolio.add('ZZZZQ');
    await expect(portfolio.row('ZZZZQ')).toContainText("Ticker 'ZZZZQ' not found");
    await portfolio.step('remove ZZZZQ', () => portfolio.removeButton('ZZZZQ').click());
    await expect(portfolio.rows).toHaveCount(1);
    await expect(portfolio.status).toHaveText('ZZZZQ removed');
  });

  test('stocks can be removed one at a time or all at once', async ({ portfolio, page }) => {
    await portfolio.goto('t=KO,AAPL,JPM');
    await expect(portfolio.median).toContainText('Median of 3 stocks');
    await portfolio.step('remove AAPL', () => portfolio.removeButton('AAPL').click());
    await expect(portfolio.rows).toHaveCount(2);
    await expect(page).toHaveURL(/\?t=KO%2CJPM$/);
    await portfolio.step('press Remove all', () => portfolio.removeAll.click());
    await expect(portfolio.empty).toBeVisible();
    await expect(page).toHaveURL(/portfolio\.html$/);
  });
});

test.describe('the ten measures', () => {
  test('each stock shows its 10-year growth, margins, returns and share count, with a median row', async ({ portfolio }) => {
    await portfolio.goto('t=KO,AAPL,INTC,JPM,SMCI');
    await expect(portfolio.median).toContainText('Median of 5 stocks');
    await expect(portfolio.table.getByRole('columnheader')).toHaveCount(12);  // company, ten measures, remove
    await expect(portfolio.cell('KO', COL.revenue)).toHaveText('+1.5%');
    await expect(portfolio.cell('KO', COL.eps)).toHaveText('+8.2%');
    await expect(portfolio.cell('KO', COL.netMargin)).toHaveText('20.9%');
    await expect(portfolio.cell('AAPL', COL.roe)).toHaveText('91.8%');
    await expect(portfolio.cell('AAPL', COL.shares)).toHaveText('-4.2%');           // buybacks
    await expect(portfolio.cell('SMCI', COL.shares)).toHaveText('+3.4%');           // new shares
    await expect(portfolio.row('SMCI')).toContainText('2017–2026');                 // its own fiscal years
  });

  test('a measure that can\'t be worked out says why', async ({ portfolio }) => {
    await portfolio.goto('t=INTC,JPM,SMCI');
    await expect(portfolio.cell('INTC', COL.eps)).toHaveText(/^n\/a/);
    await expect(portfolio.cell('INTC', COL.eps)).toHaveAttribute('title', 'Zero, negative or a loss in the latest year, so there\'s no growth rate');
    await expect(portfolio.cell('JPM', COL.fcf)).toHaveAttribute('title', 'Not meaningful for banks and insurers');
    await expect(portfolio.cell('SMCI', COL.dps)).toHaveAttribute('title', 'No dividend');
    await expect(portfolio.cell('INTC', COL.dps)).toHaveAttribute('title', 'Dividend suspended or stopped by the latest year');
  });

  test('cells are coloured by simple yardsticks, explained under the table', async ({ portfolio }) => {
    await portfolio.goto('t=KO,AAPL');
    await expect(portfolio.cell('AAPL', COL.eps)).toHaveClass(/good/);   // +15.3% a year
    await expect(portfolio.cell('KO', COL.fcf)).toHaveClass(/bad/);      // -2.3% a year
    await expect(portfolio.cell('KO', COL.revenue)).not.toHaveClass(/good|bad/);
    await expect(portfolio.legend).toContainText("They're a reading aid, not a verdict.");
  });

  test('clicking a column sorts by it, best first, and again the other way', async ({ portfolio }) => {
    await portfolio.goto('t=KO,AAPL,JPM');
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
    await expect(page).toHaveURL(/\?t=AAPL%2CKO$/);
    await portfolio.step('open KO\'s full analysis', () => portfolio.companyLink('KO').click());
    await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
  });

  test('the page reads in Spanish, and the list survives a language switch', async ({ portfolio, page }) => {
    await portfolio.goto('t=KO,INTC&lang=es');
    await expect(page.getByRole('heading', { name: 'Mi cartera' })).toBeVisible();
    await expect(portfolio.columnHeader(/^Crecimiento de ingresos/)).toBeVisible();
    await expect(portfolio.cell('INTC', COL.eps)).toHaveText(/^n\/d/);
    await expect(portfolio.median).toContainText('Mediana de 2 acciones');
    await portfolio.switchLanguage('en');
    await expect(portfolio.columnHeader(/^Revenue growth/)).toBeVisible();
    await expect(page).toHaveURL(/\?t=KO%2CINTC$/);
    await expect(portfolio.rows).toHaveCount(2);
  });

  test('at phone width the table scrolls inside its card, not the page', async ({ portfolio, page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await portfolio.goto('t=KO,AAPL');
    await expect(portfolio.median).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
