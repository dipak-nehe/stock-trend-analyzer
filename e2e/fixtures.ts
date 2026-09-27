// Shared fixtures and helpers for the browser tests (ported from tests/e2e/conftest.py and helpers.py).
import { test as base, expect, type Locator, type Page } from '@playwright/test';

type Fixtures = {
  /** JavaScript errors and console errors raised while the test runs. */
  consoleErrors: string[];
  /** Load the page for a ticker (optionally with a price) and wait until the analysis is rendered. */
  openTicker: (ticker: string, price?: number) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await use(errors);
  },
  openTicker: async ({ page }, use) => {
    await use(async (ticker, price) => {
      await page.goto(`/?t=${ticker}${price ? `&p=${price}` : ''}`);
      await page.locator('#result').waitFor({ state: 'visible' });
      return page;
    });
  },
});

export { expect };

export const TABS = ['overview', 'flags', 'history', 'value', 'charts', 'data'] as const;

export async function openTab(page: Page, name: string): Promise<void> {
  await page.click(`#tab-${name}`);
  await expect(page.locator(`#panel-${name}`)).toBeVisible();
}

export const flagTitles = (page: Page): Promise<string[]> => page.locator('#flags .title').allInnerTexts();

/** One row of the Graham/Buffett checklists, located by its criterion name. */
export const checkRow = (page: Page, name: string): Locator =>
  page.locator('.check').filter({ has: page.locator('.name', { hasText: name }) });

/** Make a page script start 1.5 s late, as on a slow connection. */
export async function slowScript(page: Page, path: string): Promise<void> {
  await page.route(`**/${path}`, async (route) => {
    const response = await route.fetch();
    const body = 'await new Promise((r) => setTimeout(r, 1500));\n' + (await response.text());
    await route.fulfill({ response, body, contentType: 'text/javascript' });
  });
}

/** True if any of `texts` contains `part`. */
export const anyContains = (texts: string[], part: string) => texts.some((t) => t.includes(part));
