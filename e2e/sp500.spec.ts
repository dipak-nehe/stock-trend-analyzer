// The S&P 500 picker (sp500.html) and its results (sp500-view.html): finding companies, the limit of 10 picks,
// showing them side by side, going back, and saving them to My portfolio. The list is the pinned 14-company test copy
// (tests/fixtures/sp500.json); only the five companies with saved filings can be shown.
import { expect, test } from './fixtures';

test.describe('picking companies', () => {
  test('the list can be searched by name or ticker and filtered by sector', async ({ sp500, consoleErrors }) => {
    await sp500.goto();
    await expect(sp500.count).toHaveText('Showing 14 of 14 companies');
    await expect(sp500.source).toContainText("List of 14 companies as of");
    await sp500.step('search "coca"', () => sp500.search.fill('coca'));
    await expect(sp500.rows).toHaveCount(1);
    await expect(sp500.rows.first()).toContainText('Coca-Cola Company (The) KO Consumer Staples');
    await sp500.step('search the ticker "msft"', () => sp500.search.fill('msft'));
    await expect(sp500.rows).toHaveText([/Microsoft/]);
    await sp500.step('clear the search and pick the Energy sector', async () => {
      await sp500.search.fill('');
      await sp500.sector.selectOption('Energy');
    });
    await expect(sp500.count).toHaveText('Showing 1 of 14 companies');
    await expect(sp500.rows).toHaveText([/ExxonMobil/]);
    expect(consoleErrors).toEqual([]);
  });

  test('ticked companies show in the selection bar, and Show waits for at least one', async ({ sp500, page }) => {
    await sp500.goto();
    await expect(sp500.pickedTitle).toHaveText('0 of 10 selected');
    await expect(sp500.show).toHaveAttribute('aria-disabled', 'true');
    await sp500.pick('Coca-Cola Company (The)', 'Apple Inc.');
    await expect(sp500.pickedTitle).toHaveText('2 of 10 selected');
    await expect(sp500.chips).toHaveText(['KO ✕', 'AAPL ✕']);
    await expect(sp500.show).toHaveText('Show 2 companies →');
    await expect(sp500.show).toHaveAttribute('aria-disabled', 'false');
    await expect(page).toHaveURL(/\?pick=KO%2CAAPL$/);
    await sp500.step('remove KO with its chip', () => sp500.unpick('Coca-Cola Company (The)').click());
    await expect(sp500.chips).toHaveText(['AAPL ✕']);
    await expect(sp500.checkbox('Coca-Cola Company (The)')).not.toBeChecked();
    await sp500.step('clear the selection', () => sp500.clear.click());
    await expect(sp500.pickedTitle).toHaveText('0 of 10 selected');
  });

  test('no more than 10 can be picked: the others are disabled until one is removed', async ({ sp500 }) => {
    await sp500.goto();
    const names = ['Alphabet Inc. (Class A)', 'Amazon', 'Apple Inc.', 'Berkshire Hathaway', 'Coca-Cola Company (The)',
                   'ExxonMobil', 'Intel', 'Johnson & Johnson', 'JPMorgan Chase', 'Meta Platforms'];
    await sp500.pick(...names);
    await expect(sp500.pickedTitle).toHaveText('10 of 10 selected');
    await expect(sp500.checkbox('Microsoft')).toBeDisabled();
    await expect(sp500.checkbox('Nvidia')).toBeDisabled();
    await expect(sp500.checkbox('Amazon')).toBeEnabled();               // a picked one can still be unticked
    await sp500.step('untick Amazon', () => sp500.checkbox('Amazon').uncheck());
    await expect(sp500.checkbox('Microsoft')).toBeEnabled();
  });

  test('a link with more than 10 keeps the first 10 and says so', async ({ sp500 }) => {
    await sp500.goto('pick=AAPL,AMZN,BRK.B,GOOGL,INTC,JNJ,JPM,KO,META,MSFT,NVDA,PEP');
    await expect(sp500.pickedTitle).toHaveText('10 of 10 selected');
    await expect(sp500.status).toHaveText('Only the first 10 are shown; 2 more were left out.');
  });
});

test.describe('showing the picks', () => {
  test('Show opens them side by side, read-only, and Change selection keeps the ticks', async ({ sp500, sp500View, page }) => {
    await sp500.goto('pick=KO,AAPL,INTC');
    await sp500.step('press Show', () => sp500.show.click());
    await expect(page).toHaveURL(/sp500-view\.html\?t=KO%2CAAPL%2CINTC$/);
    await expect(sp500View.median).toContainText('Median of 3 stocks');
    await expect(sp500View.cell('KO', 0)).toHaveText('+1.5%');
    await expect(sp500View.table.getByRole('button', { name: /^Remove/ })).toHaveCount(0);   // read-only
    await sp500View.step('press Change selection', () => sp500View.changeSelection.click());
    await expect(page).toHaveURL(/sp500\.html\?pick=KO%2CAAPL%2CINTC$/);
    await expect(sp500.pickedTitle).toHaveText('3 of 10 selected');
    await expect(sp500.checkbox('Intel')).toBeChecked();
  });

  test('Save to My portfolio adds them to the saved list, without duplicates', async ({ portfolio, sp500View }) => {
    await portfolio.goto('add=KO');
    await expect(portfolio.row('KO')).toContainText('COCA COLA CO');
    await sp500View.gotoView('t=KO,AAPL');
    await expect(sp500View.median).toBeVisible();
    await sp500View.step('press Save to My portfolio', () => sp500View.save.click());
    await expect(sp500View.status).toContainText('Saved 1 to My portfolio. Already there: KO.');
    await sp500View.step('open My portfolio', () => sp500View.openPortfolio.click());
    await expect(portfolio.rows).toHaveCount(2);
    await expect(portfolio.row('AAPL')).toContainText('Apple Inc. (AAPL)');
  });

  test('viewing picks never changes My portfolio by itself', async ({ portfolio, sp500View }) => {
    await sp500View.gotoView('t=JPM,SMCI');
    await expect(sp500View.median).toBeVisible();
    await portfolio.goto();
    await expect(portfolio.empty).toBeVisible();
  });

  test('more than 10 in the address: the first 10 are loaded, with a note', async ({ sp500View }) => {
    await sp500View.gotoView('t=KO,AAPL,INTC,JPM,SMCI,MSFT,NVDA,PEP,XOM,JNJ,META,AMZN');
    await expect(sp500View.rows).toHaveCount(10);
    await expect(sp500View.status).toHaveText('Only the first 10 are shown; 2 more were left out.');
  });
});

test.describe('getting there, language and layout', () => {
  test('S&P 500 is in the header of every page', async ({ analysis, sp500, page }) => {
    await sp500.useTestList();
    for (const path of ['/', '/compare.html', '/portfolio.html', '/disclaimer.html']) {
      await page.goto(path);
      await expect(analysis.sp500Link).toHaveAttribute('href', 'sp500.html');
    }
    await analysis.step('open S&P 500 from the header', () => analysis.sp500Link.click());
    await expect(sp500.rows.first()).toBeVisible();
    await expect(sp500.sp500Link).toHaveAttribute('aria-current', 'page');
  });

  test('both pages read in Spanish, and the language carries over', async ({ sp500, sp500View, page }) => {
    await sp500.goto('pick=KO&lang=es');
    await expect(sp500.count).toHaveText('Se muestran 14 de 14 empresas');
    await expect(sp500.pickedTitle).toHaveText('1 de 10 seleccionadas');
    await expect(sp500.show).toHaveText('Mostrar 1 empresa →');
    await sp500.step('press Mostrar', () => sp500.show.click());
    await expect(page).toHaveURL(/lang=es/);
    await expect(page.getByRole('heading', { name: 'Tus empresas del S&P 500' })).toBeVisible();
    await expect(sp500View.save).toHaveText('Guardar en Mi cartera');
  });

  test('at phone width neither page scrolls sideways', async ({ sp500, sp500View, page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await sp500.goto('pick=KO,AAPL');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await sp500View.gotoView('t=KO,AAPL');
    await expect(sp500View.median).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
