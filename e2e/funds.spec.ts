// Mutual funds & ETFs (funds.html): costs, returns and portfolios from each fund's SEC shareholder report, up to
// four side by side. Runs on saved reports (tests/fixtures/fund_*.xml): VOO, VFIAX, FXAIX, SCHD, BND, AGTHX, QQQ.
import { expect, test } from './fixtures';

test.describe('one fund', () => {
  test('a fund added by ticker shows its costs, returns against its index, portfolio and source', async ({ funds, page, consoleErrors }) => {
    await funds.goto();
    await expect(funds.result).toBeHidden();
    await expect(funds.addButton).toBeDisabled();
    await funds.add('voo');
    await expect(funds.columns).toHaveText([/VOO\s*500 Index Fund\s*ETF Shares/]);
    await expect(funds.cell('expenseRatio', 0)).toHaveText('0.03%');
    await expect(funds.cell('costPer10k', 0)).toHaveText('$3');
    await expect(funds.cell('cost20', 0)).toHaveText('$216');
    await expect(funds.cell('ret10', 0)).toHaveText('14.8%');
    await expect(funds.cell('vsIndex10', 0)).toHaveText(/^−0\.04%\s*vs S&P 500 Index, 10 years$/);
    await expect(funds.cell('netAssets', 0)).toHaveText('$1.5T');
    await expect(funds.cell('holdings', 0)).toHaveText('517');
    await expect(funds.cell('turnover', 0)).toHaveText('2%');
    await expect(funds.row('top10')).toHaveCount(0);           // Vanguard doesn't tag its top 10: no row of n/a
    await expect(funds.cell('report', 0)).toContainText('Annual, year to Dec 31, 2025');
    await expect(funds.cell('report', 0).getByRole('link')).toHaveAttribute('href', /sec\.gov\/Archives\/edgar\/data\/36405\//);
    await expect(funds.mixCards).toHaveCount(1);
    await expect(funds.mixCards).toContainText(/VOO by sector\s*Information Technology\s*34\.4%/);
    await expect(funds.status).toHaveText('Added 500 Index Fund (VOO).');
    await expect(page).toHaveURL(/funds\.html\?f=VOO$/);
    expect(consoleErrors).toEqual([]);
  });

  test('a half-year report shows costs and portfolio, and says it has no returns', async ({ funds }) => {
    await funds.goto('f=QQQ');
    await expect(funds.cell('expenseRatio', 0)).toHaveText('0.19%');
    await expect(funds.row('ret1')).toHaveCount(0);          // no returns in a half-year report: no row of n/a
    await expect(funds.row('costPer10k')).toHaveCount(0);    // its cost covers half a year, so it isn't shown
    await expect(funds.cell('top10', 0)).toHaveText('47% in the top 10');
    await expect(funds.cell('report', 0)).toContainText('Half-year, to Mar 31, 2026 (no returns)');
  });
});

test.describe('comparing funds', () => {
  test('up to four side by side, with the lower cost, higher return and lower turnover marked', async ({ funds, page }) => {
    await funds.goto();
    await funds.step('add VOO, FXAIX, AGTHX and BND from the examples and the box', async () => {
      await funds.example('VOO').click();
      await funds.example('FXAIX').click();
      await funds.add('AGTHX');
      await funds.example('BND').click();
    });
    await expect(funds.columns).toHaveCount(4);
    await expect(page).toHaveURL(/f=VOO%2CFXAIX%2CAGTHX%2CBND$/);
    const marked = (key: string) => funds.row(key).locator('td.fav');
    await expect(marked('expenseRatio')).toHaveText(['0.02% ●(more favourable)']);
    await expect(funds.row('cost20').getByRole('cell')).toHaveText(['$216', /\$144/, '$4,116', '$216']);
    await expect(marked('turnover')).toHaveText(['2% ●(more favourable)']);
    await expect(funds.row('netAssets').locator('td.fav')).toHaveCount(0);   // size isn't better or worse
    await expect(funds.cell('top10', 1)).toHaveText('37% in the top 10');
    await expect(funds.cell('vsIndex10', 1)).toHaveText(/vs the broad market index, 10 years/);   // Fidelity doesn't name it
    await expect(funds.caveat).toHaveText(/different dates \(VOO Dec 31, 2025, FXAIX Feb 28, 2026, AGTHX Aug 31, 2025, BND Dec 31, 2025\)/);
    await expect(funds.mixCards.nth(3)).toContainText('BND by investment type');
    await expect(funds.addButton).toBeDisabled();
    await funds.step('try a fifth', () => funds.input.fill('SCHD'));
    await page.keyboard.press('Enter');
    await expect(funds.status).toHaveText('Up to 4 funds at a time: remove one to add another.');
    await funds.step('remove AGTHX', () => funds.chip('AGTHX').click());
    await expect(funds.columns).toHaveCount(3);
    await expect(funds.status).toHaveText('Removed AGTHX.');
    await expect(funds.input).toBeFocused();
  });

  test('a shared link opens the same funds, in Spanish too', async ({ funds }) => {
    await funds.goto('f=SCHD,VFIAX&lang=es');
    await expect(funds.columns).toHaveCount(2);
    await expect(funds.cell('expenseRatio', 0)).toHaveText('0,06 %');
    await expect(funds.cell('expenseRatio', 1)).toHaveText('0,04 % ●(más favorable)');
    await expect(funds.cell('cost20', 1)).toHaveText('288 US$ ●(más favorable)');
    await expect(funds.cell('report', 0)).toContainText('Anual, año hasta 31 ago 2025');
    await expect(funds.page.getByRole('heading', { name: 'Fondos de inversión y ETF' })).toBeVisible();
  });
});

test.describe('errors', () => {
  test('a ticker that is not a fund, a trust without reports, a duplicate', async ({ funds }) => {
    await funds.goto();
    await funds.add('SPY');
    await expect(funds.status).toHaveText("SPY isn't in SEC's list of mutual fund and ETF tickers. Check the ticker, or analyze it as a stock on the start page.");
    await expect(funds.result).toBeHidden();
    await expect(funds.chips).toHaveText(['SPY ! ✕']);
    await funds.chip('SPY').click();
    await funds.add('VOO');
    await expect(funds.columns).toHaveCount(1);
    await funds.add('voo');
    await expect(funds.status).toHaveText('VOO is already shown.');
    await expect(funds.columns).toHaveCount(1);
  });
});

test.describe('navigation', () => {
  test('every page links to Funds next to S&P 500, keeping the language', async ({ page }) => {
    for (const path of ['/', '/compare.html', '/portfolio.html', '/sp500.html', '/sp500-view.html', '/disclaimer.html', '/funds.html', '/?lang=es']) {
      await page.goto(path);
      const nav = page.locator('.top-actions a.nav-btn');
      const labels = await nav.allInnerTexts();
      const sp = labels.findIndex((l) => l.includes('S&P 500'));
      expect(labels[sp + 1]).toMatch(/^(Funds|Fondos)$/);
      await expect(page.locator('a[data-funds-link]')).toHaveAttribute('href', path.includes('lang=es') ? 'funds.html?lang=es' : 'funds.html');
    }
  });
});
