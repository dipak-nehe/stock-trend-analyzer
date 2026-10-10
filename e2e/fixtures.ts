// Shared fixtures for the browser tests: the page objects, JavaScript-error collection and the final screenshot.
// Element definitions live in the page objects (e2e/pages/), not here or in the specs.
import { basename } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import { parentSuite } from 'allure-js-commons';
import { AnalysisPage } from './pages/AnalysisPage';
import { ComparePage } from './pages/ComparePage';
import { DisclaimerPage } from './pages/DisclaimerPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { Sp500Page } from './pages/Sp500Page';
import { Sp500ViewPage } from './pages/Sp500ViewPage';

type Fixtures = {
  /** The start and results page (index.html). */
  analysis: AnalysisPage;
  /** The compare page (compare.html). */
  compare: ComparePage;
  /** The disclaimer page (disclaimer.html). */
  disclaimer: DisclaimerPage;
  /** How we calculate (methodology.html). */
  methodology: MethodologyPage;
  /** My portfolio (portfolio.html). */
  portfolio: PortfolioPage;
  /** The S&P 500 picker (sp500.html). */
  sp500: Sp500Page;
  /** The S&P 500 picks (sp500-view.html). */
  sp500View: Sp500ViewPage;
  /** JavaScript errors and console errors raised while the test runs. */
  consoleErrors: string[];
  /** A screenshot at the end of a test that failed, or that has no step screenshots of its own. */
  finalScreenshot: void;
  /** The test's group in the Allure report, after the Python and JavaScript layers (0–3). */
  allureLayer: void;
};

export const test = base.extend<Fixtures>({
  analysis: async ({ page }, use) => {
    await use(new AnalysisPage(page));
  },
  compare: async ({ page }, use) => {
    await use(new ComparePage(page));
  },
  disclaimer: async ({ page }, use) => {
    await use(new DisclaimerPage(page));
  },
  methodology: async ({ page }, use) => {
    await use(new MethodologyPage(page));
  },
  portfolio: async ({ page }, use) => {
    await use(new PortfolioPage(page));
  },
  sp500: async ({ page }, use) => {
    await use(new Sp500Page(page));
  },
  sp500View: async ({ page }, use) => {
    await use(new Sp500ViewPage(page));
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await use(errors);
  },
  allureLayer: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their first argument
    async ({}, use, testInfo) => {
      const accessibility = basename(testInfo.file).startsWith('accessibility');
      await parentSuite(accessibility ? '5 · Accessibility: axe-core and keyboard' : '4 · End-to-end: user journeys');
      await use();
    },
    { auto: true },
  ],
  finalScreenshot: [
    async ({ analysis }, use, testInfo) => {
      await use();
      if (testInfo.status !== testInfo.expectedStatus) return analysis.snap('screen at failure');
      // A test with steps already ends on its last step's screenshot; don't repeat the same screen.
      if (!testInfo.attachments.some((a) => a.contentType === 'image/jpeg')) await analysis.snap('final screen');
    },
    { auto: true },
  ],
});

export { expect };
export { TABS } from './pages/names';

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
