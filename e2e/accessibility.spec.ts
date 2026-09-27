// Accessibility: axe-core (WCAG 2.0/2.1/2.2 A and AA, plus best practices) on every state of the page, in light and
// dark mode, English and Spanish, desktop and phone width; plus keyboard-only checks. Full axe results are attached
// to the report when something fails. Elements come from the AnalysisPage and ComparePage objects.
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect, TABS, test } from './fixtures';
import type { BasePage } from './pages/BasePage';
import type { AnalysisPage } from './pages/AnalysisPage';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const SCHEMES = ['light', 'dark'] as const;

/** Run axe and return a short, readable list of violations (the full details are attached to the report). */
async function violations(po: BasePage, testInfo: TestInfo): Promise<string[]> {
  await po.snap('page checked by axe-core');
  const { violations: found } = await new AxeBuilder({ page: po.page }).withTags(WCAG).analyze();
  if (found.length) await testInfo.attach('axe violations', { body: JSON.stringify(found, null, 2), contentType: 'application/json' });
  return found.map((v) => `[${v.impact}] ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target[0]).join(', ')}`);
}

async function prepare(page: Page, width = 1100, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width, height: 900 });
}

/** Open a results page and wait for the glance card. */
async function openResults(analysis: AnalysisPage, path: string): Promise<void> {
  await analysis.goto(path);
  await analysis.glanceRows.first().waitFor();
}

for (const [device, width] of [['desktop', 1100], ['phone', 375]] as const) {
  for (const scheme of SCHEMES) {
    test(`landing page (${device}, ${scheme})`, async ({ analysis, page }, testInfo) => {
      await prepare(page, width, scheme);
      await analysis.goto('/');
      expect(await violations(analysis, testInfo)).toEqual([]);
    });
  }
}

for (const tab of TABS) {
  for (const scheme of SCHEMES) {
    test(`results tab: ${tab} (${scheme})`, async ({ analysis, page }, testInfo) => {
      // SMCI with a price exercises the most states: critical flags, filing history, every checklist status
      await prepare(page, 1100, scheme);
      await openResults(analysis, '/?t=SMCI&p=30');
      await analysis.openTab(tab);
      if (tab === 'data') await analysis.glossaryToggle.click();
      expect(await violations(analysis, testInfo)).toEqual([]);
    });
  }
}

for (const tab of ['overview', 'data'] as const) {
  test(`phone-width results: ${tab}`, async ({ analysis, page }, testInfo) => {
    await prepare(page, 375);
    await openResults(analysis, '/?t=KO');
    await analysis.openTab(tab);
    expect(await violations(analysis, testInfo)).toEqual([]);
  });
}

test('Spanish page', async ({ analysis, page }, testInfo) => {
  await prepare(page);
  await openResults(analysis, '/?t=JPM&lang=es');
  expect(await violations(analysis, testInfo)).toEqual([]);
});

test('error state', async ({ analysis, page }, testInfo) => {
  await prepare(page);
  await analysis.goto('/?t=ZZZZQ');
  await expect(analysis.error).toBeVisible();
  expect(await violations(analysis, testInfo)).toEqual([]);
});

test('guide before and after a search', async ({ analysis, page }, testInfo) => {
  await prepare(page);
  await analysis.goto('/');
  expect(await violations(analysis, testInfo)).toEqual([]);
  await analysis.step('click the "SEC history" guide card', async () => { // loads the example on that tab
    await analysis.guideCard('history').click();
    await analysis.panel('history').waitFor();
  });
  await analysis.step('reopen the guide over the results', () => analysis.guideToggle.click());
  expect(await violations(analysis, testInfo)).toEqual([]);
});

// ---------- keyboard only ----------

test('search and results work with the keyboard', async ({ analysis, page }) => {
  await analysis.goto('/');
  await expect(analysis.searchBox).toBeFocused();
  await analysis.step('type "ko" and press Enter', async () => {
    await page.keyboard.type('ko');
    await page.keyboard.press('Enter');
    await analysis.glanceRows.first().waitFor();
  });
  await analysis.glanceRows.first().focus();
  await page.keyboard.press('Enter'); // a glance line opens its tab
  await expect(analysis.panel('overview')).toBeVisible();
  await analysis.tab('overview').focus();
  await page.keyboard.press('ArrowRight');
  await expect(analysis.panel('flags')).toBeVisible();
});

test('wide tables can be scrolled with the keyboard', async ({ analysis, page }) => {
  await prepare(page, 375);
  await openResults(analysis, '/?t=KO');
  await analysis.openTab('data');
  const region = analysis.dataTableRegion;
  await expect(region).toHaveAttribute('tabindex', '0');
  expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth), 'table should overflow at phone width').toBe(true);
  await region.focus();
  await expect(region).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.waitForFunction((el) => el!.scrollLeft > 0, await region.elementHandle(), { timeout: 3_000 }); // smooth scrolling
});

test('every interactive element has a name', async ({ analysis, page }) => {
  await prepare(page);
  await openResults(analysis, '/?t=SMCI');
  // An audit of all controls on the page (not a lookup of one element), so it queries the DOM directly.
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
    test(`compare page: ${name} (${scheme})`, async ({ compare, page }, testInfo) => {
      await prepare(page, 1100, scheme);
      await compare.goto(query);
      if (!query.includes('b=')) await expect(compare.statusA).not.toBeEmpty();
      expect(await violations(compare, testInfo)).toEqual([]);
    });
  }
}

test('compare page at phone width', async ({ compare, page }, testInfo) => {
  await prepare(page, 375);
  await compare.goto('a=KO&b=AAPL');
  expect(await violations(compare, testInfo)).toEqual([]);
});
