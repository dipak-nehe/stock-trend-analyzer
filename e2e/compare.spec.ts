// The compare page: the link from a result, loading both sides, URL state, marks, prices, swap, errors and
// languages. Elements come from the ComparePage and AnalysisPage objects.
import { expect, slowScript, test } from './fixtures';
import { url } from './env';

test('compare link appears only after a result', async ({ analysis }) => {
  await analysis.goto('/');
  await expect(analysis.compareLink).toBeHidden();
  await analysis.search('KO');
  await expect(analysis.compareLink).toBeVisible();
  await expect(analysis.compareLink).toHaveAttribute('href', 'compare.html?a=KO');
});

test('compare link opens with the first stock loaded', async ({ analysis, compare, page, consoleErrors }) => {
  await analysis.goto('/?t=KO');
  await compare.step('click "Compare with another stock"', async () => {
    await analysis.compareLink.click();
    await expect(page).toHaveURL(/\/compare\.html\?a=KO$/);
  });
  await expect(compare.firstTicker).toHaveValue('KO');
  await expect(compare.statusA).toHaveText('COCA COLA CO (KO)');
  await expect(compare.emptyMessage).toBeVisible();
  await expect(compare.comparison).toBeHidden();
  await expect(compare.secondTicker).toBeFocused();
  await expect(compare.backLink).toHaveAttribute('href', 'index.html?t=KO');
  expect(consoleErrors).toEqual([]);
});

test('second stock is fetched and compared', async ({ compare, page, consoleErrors }) => {
  await compare.goto('a=KO');
  await expect(compare.statusA).toHaveText('COCA COLA CO (KO)');
  await compare.compareWith('aapl');
  await expect(compare.comparison).toBeVisible();
  await expect(page).toHaveURL(/\?a=KO&b=AAPL$/);
  await expect(page).toHaveTitle('KO vs AAPL · 10-Year Stock Value Analysis');
  await expect(compare.companyCards).toHaveCount(2);
  await expect(compare.companyCardsArea).toContainText('Apple Inc. (AAPL)');
  await expect(compare.figureHeaders).toContainText(['KO', 'AAPL']);
  await expect(compare.figureRow('Revenue (latest year)')).toContainText('$416.2B');
  // both growth charts are drawn
  for (const id of ['cmpRevenue', 'cmpEps']) {
    const box = await compare.chart(id).boundingBox();
    expect(box?.height, id).toBeGreaterThan(100);
  }
  await expect(compare.criteriaTable.getByRole('row').filter({ hasText: 'Benjamin Graham' })).toHaveCount(1);
  expect(consoleErrors).toEqual([]);
});

test('chip loads the second stock', async ({ compare, page }) => {
  await compare.goto('a=KO');
  await expect(compare.statusA).toHaveText('COCA COLA CO (KO)');
  await compare.step('click the INTC example', () => compare.exampleButton('INTC').click());
  await expect(compare.comparison).toBeVisible();
  await expect(page).toHaveURL(/b=INTC/);
});

test('marks follow direction and sizes get none', async ({ compare }) => {
  await compare.goto('a=KO&b=INTC');
  // a size measure is never marked
  await expect(compare.favouriteMarks(compare.figureRow('Revenue (latest year)'))).toHaveCount(0);
  // exactly one side is marked on net margin, and screen readers hear it
  const margin = compare.figureRow('Net margin (latest)');
  await expect(compare.favouriteMarks(margin)).toHaveCount(1);
  await expect(compare.favourableText(margin)).toHaveText('(more favourable)');
  // KO is profitable and INTC is loss-making, so KO (first column) gets the mark
  await expect(compare.favouriteMarks(margin.getByRole('cell').nth(0))).toHaveCount(1);
});

test('valuation rows need prices', async ({ compare, page }) => {
  await compare.goto('a=KO&b=AAPL');
  await expect(compare.figuresTable).not.toContainText('Valuation');
  const pe = compare.figureRow('P/E on 3-year average EPS');
  await compare.step("enter KO's price: 60", async () => {
    await compare.priceFor('KO').fill('60');
    await expect(pe).toContainText('add a price');
  });
  await expect(compare.favouriteMarks(pe)).toHaveCount(0);
  await expect(page).toHaveURL(/pa=60/);
  await compare.step("enter AAPL's price: 200", async () => {
    await compare.priceFor('AAPL').fill('200');
    await expect(pe).not.toContainText('add a price');
  });
  await expect(compare.favouriteMarks(pe)).toHaveCount(1);
  await expect(page).toHaveURL(/pa=60&pb=200/);
});

test('deep link with prices restores everything', async ({ compare }) => {
  await compare.goto('a=KO&b=AAPL&pa=60&pb=200');
  await expect(compare.priceFor('KO')).toHaveValue('60');
  await expect(compare.priceFor('AAPL')).toHaveValue('200');
  await expect(compare.figureRow('Price to book').getByRole('cell').first()).not.toHaveText('add a price');
});

test('swap switches sides and prices', async ({ compare, page }) => {
  await compare.goto('a=KO&b=AAPL&pa=60');
  await compare.step('swap the two sides', async () => {
    await compare.swapButton.click();
    await expect(page).toHaveURL(/\?a=AAPL&b=KO&pb=60$/);
  });
  await expect(compare.firstTicker).toHaveValue('AAPL');
  await expect(compare.priceFor('KO')).toHaveValue('60'); // KO's price moved with KO to the second slot
  await expect(compare.figureHeaders.nth(1)).toHaveText('AAPL');
});

test('same ticker is rejected', async ({ compare }) => {
  await compare.goto('a=KO');
  await expect(compare.statusA).toHaveText('COCA COLA CO (KO)');
  await compare.compareWith('ko');
  await expect(compare.statusB).toContainText('same company');
  await expect(compare.comparison).toBeHidden();
});

test('unknown second ticker keeps the first', async ({ compare, page }) => {
  await compare.goto('a=KO');
  await expect(compare.statusA).toHaveText('COCA COLA CO (KO)');
  await compare.compareWith('ZZZZQ');
  await expect(compare.statusB).toHaveClass(/error-text/);
  await expect(compare.statusA).toHaveText('COCA COLA CO (KO)');
  await expect(compare.comparison).toBeHidden();
  await expect(page).toHaveURL(/\?a=KO$/);
});

test('language carries over and switches', async ({ analysis, compare, page, consoleErrors }) => {
  await analysis.goto('/?t=KO&lang=es');
  await expect(analysis.compareLink).toHaveText('Comparar con otra acción →');
  await expect(analysis.compareLink).toHaveAttribute('href', 'compare.html?a=KO&lang=es');
  await compare.step('open the compare page', () => analysis.compareLink.click());
  await compare.compareWith('AAPL');
  await expect(compare.comparison).toBeVisible();
  await expect(compare.compareButton).toHaveText('Comparar');
  await expect(compare.figuresTable).toContainText('Deuda / patrimonio');
  await expect(page).toHaveURL(/lang=es/);
  await compare.step('switch to English', async () => {
    await compare.switchLanguage('en');
    await expect(compare.figuresTable).toContainText('Debt / equity');
  });
  await expect(page).not.toHaveURL(/lang=/);
  expect(consoleErrors).toEqual([]);
});

test('bank shows n/a for current ratio', async ({ compare }) => {
  await compare.goto('a=JPM&b=KO');
  const row = compare.figureRow('Current ratio');
  await expect(row.getByRole('cell').first()).toHaveText('n/a');
  await expect(compare.favouriteMarks(row)).toHaveCount(0);
});

test('phone width has no sideways scroll', async ({ compare, page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await compare.goto('a=KO&b=AAPL');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('Home leaves the compare page', async ({ analysis, compare, page }) => {
  await compare.goto('a=KO&b=AAPL');
  await compare.step('press Home', () => compare.homeButton.click());
  await expect(page).toHaveURL(url('/'));
  await expect(analysis.result).toBeHidden();
  await expect(analysis.searchBox).toHaveValue('');
});

test('a quick submit before the script loads is not lost', async ({ compare, page }) => {
  await slowScript(page, 'js/compare-app.js');
  await page.goto('/compare.html?a=KO');
  await expect(compare.compareButton).toBeDisabled(); // an early submit would reload the page and drop both tickers
  await compare.compareWith('AAPL'); // the click waits until the script has enabled the button
  await expect(compare.comparison).toBeVisible();
  await expect(page).toHaveURL(/\?a=KO&b=AAPL$/);
});
