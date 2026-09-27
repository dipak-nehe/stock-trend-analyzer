// Accessibility (ported from tests/e2e/test_accessibility.py): axe-core (WCAG 2.0/2.1/2.2 A and AA, plus best
// practices) on every state of the page, in light and dark mode, English and Spanish, desktop and phone width;
// plus keyboard-only checks. Full axe results are attached to the report when something fails.
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, TABS, test } from './fixtures';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const SCHEMES = ['light', 'dark'] as const;

/** Run axe and return a short, readable list of violations (the full details are attached to the report). */
async function violations(page: Page, testInfo: TestInfo): Promise<string[]> {
  const { violations: found } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  if (found.length) await testInfo.attach('axe violations', { body: JSON.stringify(found, null, 2), contentType: 'application/json' });
  return found.map((v) => `[${v.impact}] ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target[0]).join(', ')}`);
}

async function load(page: Page, path: string, width = 1100, scheme: 'light' | 'dark' = 'light'): Promise<Page> {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  if (path.includes('t=') && !path.includes('ZZZZQ')) await page.locator('#glance .glance-row').first().waitFor();
  return page;
}

for (const [device, width] of [['desktop', 1100], ['phone', 375]] as const) {
  for (const scheme of SCHEMES) {
    test(`landing page (${device}, ${scheme})`, async ({ page }, testInfo) => {
      await load(page, '/', width, scheme);
      expect(await violations(page, testInfo)).toEqual([]);
    });
  }
}

for (const tab of TABS) {
  for (const scheme of SCHEMES) {
    test(`results tab: ${tab} (${scheme})`, async ({ page }, testInfo) => {
      // SMCI with a price exercises the most states: critical flags, filing history, every checklist status
      await load(page, '/?t=SMCI&p=30', 1100, scheme);
      await page.click(`#tab-${tab}`);
      if (tab === 'data') await page.click('#glossary summary');
      expect(await violations(page, testInfo)).toEqual([]);
    });
  }
}

for (const tab of ['overview', 'data']) {
  test(`phone-width results: ${tab}`, async ({ page }, testInfo) => {
    await load(page, '/?t=KO', 375);
    await page.click(`#tab-${tab}`);
    expect(await violations(page, testInfo)).toEqual([]);
  });
}

test('Spanish page', async ({ page }, testInfo) => {
  await load(page, '/?t=JPM&lang=es');
  expect(await violations(page, testInfo)).toEqual([]);
});

test('error state', async ({ page }, testInfo) => {
  await load(page, '/?t=ZZZZQ');
  await expect(page.locator('#error')).toBeVisible();
  expect(await violations(page, testInfo)).toEqual([]);
});

test('guide before and after a search', async ({ page }, testInfo) => {
  await load(page, '/');
  expect(await violations(page, testInfo)).toEqual([]);
  await page.locator('.guide-item[data-tab="history"]').click(); // loads the example on that tab
  await page.locator('#panel-history').waitFor();
  await page.click('#guide summary'); // reopen the guide over the results
  expect(await violations(page, testInfo)).toEqual([]);
});

// ---------- keyboard only ----------

test('search and results work with the keyboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#ticker')).toBeFocused();
  await page.keyboard.type('ko');
  await page.keyboard.press('Enter');
  const firstRow = page.locator('#glance .glance-row').first();
  await firstRow.waitFor();
  await firstRow.focus();
  await page.keyboard.press('Enter'); // a glance line opens its tab
  await expect(page.locator('#panel-overview')).toBeVisible();
  await page.locator('#tab-overview').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#panel-flags')).toBeVisible();
});

test('wide tables can be scrolled with the keyboard', async ({ page }) => {
  await load(page, '/?t=KO', 375);
  await page.click('#tab-data');
  const region = page.locator('#panel-data .table-wrap');
  await expect(region).toHaveAttribute('tabindex', '0');
  expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth), 'table should overflow at phone width').toBe(true);
  await region.focus();
  await expect(region).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.waitForFunction((el) => el!.scrollLeft > 0, await region.elementHandle(), { timeout: 3_000 }); // smooth scrolling
});

test('every interactive element has a name', async ({ page }) => {
  await load(page, '/?t=SMCI');
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a[href], input, [role=tab]')]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => !(el.getAttribute('aria-label') || (el as HTMLInputElement).labels?.length || el.textContent?.trim() || el.title))
      .map((el) => el.outerHTML.slice(0, 80)));
  expect(unnamed).toEqual([]);
});

const COMPARE_QUERIES = [['one-side', 'a=KO'], ['both-priced', 'a=KO&b=SMCI&pa=60&pb=30'], ['spanish', 'a=JPM&b=INTC&lang=es']] as const;
for (const [name, query] of COMPARE_QUERIES) {
  for (const scheme of SCHEMES) {
    test(`compare page: ${name} (${scheme})`, async ({ page }, testInfo) => {
      await load(page, `/compare.html?${query}`, 1100, scheme);
      await page.locator(query.includes('b=') ? '#cmpResult' : '#statusA:not(:empty)').waitFor();
      expect(await violations(page, testInfo)).toEqual([]);
    });
  }
}

test('compare page at phone width', async ({ page }, testInfo) => {
  await load(page, '/compare.html?a=KO&b=AAPL', 375);
  await page.locator('#cmpResult').waitFor();
  expect(await violations(page, testInfo)).toEqual([]);
});
