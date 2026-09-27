// The compare page (ported from tests/e2e/test_compare.py): the link from a result, loading both sides,
// URL state, marks, prices, swap, errors and languages.
import type { Page } from '@playwright/test';
import { expect, slowScript, step, test } from './fixtures';
import { url } from './env';

async function openCompare(page: Page, query: string): Promise<Page> {
  return step(page, `open compare.html?${query}`, async () => {
    await page.goto(`/compare.html?${query}`);
    if (query.includes('b=')) await page.locator('#cmpResult').waitFor({ state: 'visible' });
    return page;
  });
}

const figureRow = (page: Page, label: string) =>
  page.locator('#cmpTable tbody tr').filter({ has: page.locator('th', { hasText: label }) });

test('compare link appears only after a result', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#compareLink')).toBeHidden();
  await page.fill('#ticker', 'KO');
  await page.click('#go');
  const link = page.locator('#compareLink');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'compare.html?a=KO');
});

test('compare link opens with the first stock loaded', async ({ page, consoleErrors }) => {
  await step(page, 'open KO', () => page.goto('/?t=KO'));
  await step(page, 'click "Compare with another stock"', async () => {
    await page.click('#compareLink');
    await expect(page).toHaveURL(/\/compare\.html\?a=KO$/);
  });
  await expect(page.locator('#tickerA')).toHaveValue('KO');
  await expect(page.locator('#statusA')).toHaveText('COCA COLA CO (KO)');
  await expect(page.locator('#cmpEmpty')).toBeVisible();
  await expect(page.locator('#cmpResult')).toBeHidden();
  await expect(page.locator('#tickerB')).toBeFocused();
  await expect(page.locator('#backLink')).toHaveAttribute('href', 'index.html?t=KO');
  expect(consoleErrors).toEqual([]);
});

test('second stock is fetched and compared', async ({ page, consoleErrors }) => {
  await openCompare(page, 'a=KO');
  await expect(page.locator('#statusA')).toHaveText('COCA COLA CO (KO)');
  await step(page, 'compare with aapl', async () => {
    await page.fill('#tickerB', 'aapl');
    await page.click('#goB');
    await expect(page.locator('#cmpResult')).toBeVisible();
  });
  await expect(page).toHaveURL(/\?a=KO&b=AAPL$/);
  await expect(page).toHaveTitle('KO vs AAPL · 10-Year Stock Value Analysis');
  await expect(page.locator('#cmpCards .cmp-card')).toHaveCount(2);
  await expect(page.locator('#cmpCards')).toContainText('Apple Inc. (AAPL)');
  await expect(page.locator('#cmpTable thead')).toContainText('KO');
  await expect(page.locator('#cmpTable thead')).toContainText('AAPL');
  await expect(figureRow(page, 'Revenue (latest year)')).toContainText('$416.2B');
  // both growth charts are drawn
  for (const id of ['cmpRevenue', 'cmpEps']) {
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box?.height, id).toBeGreaterThan(100);
  }
  await expect(page.locator('#cmpGrid tbody tr').filter({ hasText: 'Benjamin Graham' })).toHaveCount(1);
  expect(consoleErrors).toEqual([]);
});

test('chip loads the second stock', async ({ page }) => {
  await openCompare(page, 'a=KO');
  await expect(page.locator('#statusA')).toHaveText('COCA COLA CO (KO)');
  await page.click('.chip[data-b=INTC]');
  await expect(page.locator('#cmpResult')).toBeVisible();
  await expect(page).toHaveURL(/b=INTC/);
});

test('marks follow direction and sizes get none', async ({ page }) => {
  await openCompare(page, 'a=KO&b=INTC');
  // a size measure is never marked
  await expect(figureRow(page, 'Revenue (latest year)').locator('.fav-dot')).toHaveCount(0);
  // exactly one side is marked on net margin, and screen readers hear it
  const margin = figureRow(page, 'Net margin (latest)');
  await expect(margin.locator('.fav-dot')).toHaveCount(1);
  await expect(margin.locator('.sr-only')).toHaveText('(more favourable)');
  // KO is profitable and INTC is loss-making, so KO (first column) gets the mark
  await expect(margin.locator('td').nth(0).locator('.fav-dot')).toHaveCount(1);
});

test('valuation rows need prices', async ({ page }) => {
  await openCompare(page, 'a=KO&b=AAPL');
  await expect(page.locator('#cmpTable')).not.toContainText('Valuation');
  const pe = figureRow(page, 'P/E on 3-year average EPS');
  await step(page, "enter KO's price: 60", async () => {
    await page.fill('#priceA', '60');
    await expect(pe).toContainText('add a price');
  });
  await expect(pe.locator('.fav-dot')).toHaveCount(0);
  await expect(page).toHaveURL(/pa=60/);
  await step(page, "enter AAPL's price: 200", async () => {
    await page.fill('#priceB', '200');
    await expect(pe).not.toContainText('add a price');
  });
  await expect(pe.locator('.fav-dot')).toHaveCount(1);
  await expect(page).toHaveURL(/pa=60&pb=200/);
});

test('deep link with prices restores everything', async ({ page }) => {
  await openCompare(page, 'a=KO&b=AAPL&pa=60&pb=200');
  await expect(page.locator('#priceA')).toHaveValue('60');
  await expect(page.locator('#priceB')).toHaveValue('200');
  await expect(figureRow(page, 'Price to book').locator('td').first()).not.toHaveText('add a price');
});

test('swap switches sides and prices', async ({ page }) => {
  await openCompare(page, 'a=KO&b=AAPL&pa=60');
  await step(page, 'swap the two sides', async () => {
    await page.click('#swap');
    await expect(page).toHaveURL(/\?a=AAPL&b=KO&pb=60$/);
  });
  await expect(page.locator('#tickerA')).toHaveValue('AAPL');
  await expect(page.locator('#priceB')).toHaveValue('60');
  await expect(page.locator('#cmpTable thead th').nth(1)).toHaveText('AAPL');
});

test('same ticker is rejected', async ({ page }) => {
  await openCompare(page, 'a=KO');
  await expect(page.locator('#statusA')).toHaveText('COCA COLA CO (KO)');
  await step(page, 'try KO again as the second stock', async () => {
    await page.fill('#tickerB', 'ko');
    await page.click('#goB');
    await expect(page.locator('#statusB')).toContainText('same company');
  });
  await expect(page.locator('#cmpResult')).toBeHidden();
});

test('unknown second ticker keeps the first', async ({ page }) => {
  await openCompare(page, 'a=KO');
  await expect(page.locator('#statusA')).toHaveText('COCA COLA CO (KO)');
  await step(page, 'try an unknown second ticker', async () => {
    await page.fill('#tickerB', 'ZZZZQ');
    await page.click('#goB');
    await expect(page.locator('#statusB')).toHaveClass(/error-text/);
  });
  await expect(page.locator('#statusA')).toHaveText('COCA COLA CO (KO)');
  await expect(page.locator('#cmpResult')).toBeHidden();
  await expect(page).toHaveURL(/\?a=KO$/);
});

test('language carries over and switches', async ({ page, consoleErrors }) => {
  await step(page, 'open KO in Spanish', () => page.goto('/?t=KO&lang=es'));
  const link = page.locator('#compareLink');
  await expect(link).toHaveText('Comparar con otra acción →');
  await expect(link).toHaveAttribute('href', 'compare.html?a=KO&lang=es');
  await step(page, 'open the compare page and add AAPL', async () => {
    await link.click();
    await page.fill('#tickerB', 'AAPL');
    await page.click('#goB');
    await expect(page.locator('#cmpResult')).toBeVisible();
  });
  await expect(page.locator('#goB')).toHaveText('Comparar');
  await expect(page.locator('#cmpTable')).toContainText('Deuda / patrimonio');
  await expect(page).toHaveURL(/lang=es/);
  await step(page, 'switch to English', async () => {
    await page.click('.lang-switch [data-lang=en]');
    await expect(page.locator('#cmpTable')).toContainText('Debt / equity');
  });
  await expect(page).not.toHaveURL(/lang=/);
  expect(consoleErrors).toEqual([]);
});

test('bank shows n/a for current ratio', async ({ page }) => {
  await openCompare(page, 'a=JPM&b=KO');
  const row = figureRow(page, 'Current ratio');
  await expect(row.locator('td').first()).toHaveText('n/a');
  await expect(row.locator('.fav-dot')).toHaveCount(0);
});

test('phone width has no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openCompare(page, 'a=KO&b=AAPL');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('Home leaves the compare page', async ({ page }) => {
  await openCompare(page, 'a=KO&b=AAPL');
  await page.click('.home-btn');
  await expect(page).toHaveURL(url('/'));
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#ticker')).toHaveValue('');
});

test('a quick submit before the script loads is not lost', async ({ page }) => {
  await slowScript(page, 'js/compare-app.js');
  await page.goto('/compare.html?a=KO');
  await expect(page.locator('#goB')).toBeDisabled(); // an early submit would reload the page and drop both tickers
  await page.fill('#tickerB', 'AAPL');
  await page.click('#goB'); // waits until the script has enabled the button
  await expect(page.locator('#cmpResult')).toBeVisible();
  await expect(page).toHaveURL(/\?a=KO&b=AAPL$/);
});
