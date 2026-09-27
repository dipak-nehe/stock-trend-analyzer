// Shared fixtures and helpers for the browser tests (ported from tests/e2e/conftest.py and helpers.py).
import { test as base, expect, type Locator, type Page } from '@playwright/test';

/**
 * Attach a screenshot of what's on screen to the report (Allure and Playwright's HTML report), under `name`.
 * Compressed JPEG of the viewport: the Allure report is a single HTML file, so hundreds of full PNGs would bloat it.
 */
export async function snap(page: Page, name: string): Promise<void> {
  try {
    const body = await page.screenshot({ type: 'jpeg', quality: 40, scale: 'css' });
    await base.info().attach(name, { body, contentType: 'image/jpeg' });
  } catch {
    // the page may be closed already; a missing screenshot must never fail or hide a test result
  }
}

/** A named step in the report, ending with a screenshot of the screen, so the flow can be replayed step by step. */
export async function step<T>(page: Page, title: string, body: () => Promise<T>): Promise<T> {
  return base.step(title, async () => {
    const result = await body();
    await snap(page, title);
    return result;
  });
}

type Fixtures = {
  /** A screenshot at the end of a test that failed, or that has no step screenshots of its own. */
  finalScreenshot: void;
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
    await use((ticker, price) =>
      step(page, `open ${ticker}${price ? ` with price ${price}` : ''}`, async () => {
        await page.goto(`/?t=${ticker}${price ? `&p=${price}` : ''}`);
        await page.locator('#result').waitFor({ state: 'visible' });
        return page;
      }));
  },
  finalScreenshot: [
    async ({ page }, use, testInfo) => {
      await use();
      if (testInfo.status !== testInfo.expectedStatus) return snap(page, 'screen at failure');
      // A test with steps already ends on its last step's screenshot; don't repeat the same screen.
      if (!testInfo.attachments.some((a) => a.contentType === 'image/jpeg')) await snap(page, 'final screen');
    },
    { auto: true },
  ],
});

export { expect };

export const TABS = ['overview', 'flags', 'history', 'value', 'charts', 'data'] as const;

export async function openTab(page: Page, name: string): Promise<void> {
  await step(page, `open the ${name} tab`, async () => {
    await page.click(`#tab-${name}`);
    await expect(page.locator(`#panel-${name}`)).toBeVisible();
  });
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
