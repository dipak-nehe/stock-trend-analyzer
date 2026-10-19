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
    await expect(funds.cell('top10', 0)).toHaveText('38% in the top 10');
    const top = funds.topCards.first();
    await expect(top).toContainText('VOO 37.9% of the fund in these 10 · as of Jun 30, 2026');
    await expect(top.getByTestId('fund-holding')).toHaveCount(10);
    await expect(top.getByTestId('fund-holding').first()).toHaveText(/NVIDIA Corp\s*7\.51%/);
    await expect(top.getByTestId('fund-holding').nth(2)).toHaveText(/Alphabet Inc \(2 securities\)\s*5\.84%/);   // class A + C
    await expect(top).not.toContainText('Liquidity');     // cash collateral and futures aren't holdings
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
    await expect(funds.cell('top10', 0)).toHaveText('48% in the top 10');
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
    await expect(funds.cell('top10', 1)).toHaveText('41% in the top 10');
    await expect(funds.cell('vsIndex10', 1)).toHaveText(/vs the broad market index, 10 years/);   // Fidelity doesn't name it
    await expect(page.getByTestId('share-x')).toHaveAttribute('href', /text=VOO%2C%20FXAIX%2C%20AGTHX%2C%20BND%3A%20costs.*&url=.*%2Ffunds\.html%3Ff%3DVOO%2CFXAIX%2CAGTHX%2CBND$/);
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

test.describe('overlap, growth and ups and downs', () => {
  test('two share classes of one fund are the same portfolio; other pairs show what they share', async ({ funds, page }) => {
    await funds.goto('f=VOO,VFIAX,AGTHX');
    const pairs = page.getByTestId('fund-overlap-pair');
    await expect(pairs).toHaveCount(3);
    await expect(pairs.first()).toContainText('VOO & VFIAX');
    await expect(pairs.first()).toContainText('100% in common');
    await expect(pairs.first()).toContainText('The same portfolio: two share classes of one fund');
    await expect(pairs.nth(1)).toContainText(/VOO & AGTHX\s*\d+% in common/);
    await expect(pairs.nth(1)).toContainText(/holdings in common; the largest: NVIDIA Corp/);
  });

  test('growth of $10,000 against the index, the worst year, and a chart that does not add up is left out', async ({ funds, page }) => {
    await funds.goto('f=VOO,AGTHX');
    const cards = page.getByTestId('fund-growth-card');
    await expect(cards.first()).toContainText('VOO 10 years to Dec 31, 2025');
    await expect(cards.first()).toContainText('VOO $39,690');
    await expect(cards.first()).toContainText('S&P 500 Index $39,827');
    await expect(cards.first().locator('svg polyline')).toHaveCount(2);
    await expect(cards.nth(1)).toContainText("doesn't match its own reported 10-year return");
    await expect(funds.cell('worstYear', 0)).toHaveText(/^-18\.1%\s*year to Dec 31, 2022$/);
    await expect(funds.cell('lossYears', 0)).toHaveText('2 of 10');
    await expect(funds.cell('worstYear', 1)).toHaveText('n/a');
    await expect(funds.cell('afterCharge10', 1)).toHaveText(/^14\.4%\s*10 years$/);   // AGTHX's 5.75% charge
    await expect(funds.cell('afterCharge10', 0)).toHaveText('n/a');
    await expect(funds.cell('ret10', 1)).toHaveText('15.0% ●(more favourable)');     // before the charge
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
  test('every page links to All companies and Funds after S&P 500, keeping the language', async ({ page }) => {
    for (const path of ['/', '/compare.html', '/portfolio.html', '/sp500.html', '/sp500-view.html', '/disclaimer.html', '/funds.html', '/companies.html', '/?lang=es']) {
      await page.goto(path);
      const nav = page.locator('.top-actions a.nav-btn');
      const labels = await nav.allInnerTexts();
      const sp = labels.findIndex((l) => l.includes('S&P 500'));
      expect(labels.slice(sp + 1, sp + 3)).toEqual(path.includes('lang=es') ? ['Todas las empresas', 'Fondos y ETF'] : ['All companies', 'Funds & ETFs']);
      await expect(page.locator('a[data-funds-link]')).toHaveAttribute('href', path.includes('lang=es') ? 'funds.html?lang=es' : 'funds.html');
      await expect(page.locator('a[data-companies-link]')).toHaveAttribute('href', path.includes('lang=es') ? 'companies.html?lang=es' : 'companies.html');
    }
  });
});
