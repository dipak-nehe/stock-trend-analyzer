// How we calculate (methodology.html): every rule in one place, generated from the same text the results pages show.
import { expect, test } from './fixtures';

test.describe('How we calculate', () => {
  test('lists every red flag and checklist test with its rule', async ({ methodology, consoleErrors }) => {
    await methodology.goto();
    await expect(methodology.heading).toBeVisible();
    await expect(methodology.flagRows).toHaveCount(44);
    await expect(methodology.flagRows.filter({ hasText: 'Revenue is shrinking' })).toContainText('Revenue fell more than 3% a year on average over the period.');
    await expect(methodology.rules('meth-graham').getByRole('row')).toHaveCount(9);        // a header and 8 tests
    await expect(methodology.rules('meth-buffett')).toContainText('Margin of safety');
    await expect(methodology.rules('meth-lynch')).toContainText('PEG ratio');
    await expect(methodology.rules('meth-piotroski').getByRole('row')).toHaveCount(10);
    await expect(methodology.rules('meth-durable')).toContainText('Treasury stock held');
    await expect(methodology.rules('meth-measures')).toContainText('Buffett criteria met');
    await expect(methodology.reportLink).toHaveAttribute('href', /github\.com\/dipak-nehe\/stock-trend-analyzer\/issues\/new\?labels=data/);
    expect(consoleErrors).toEqual([]);
  });

  test('every page links to it in the footer, keeping the language', async ({ analysis, methodology, page }) => {
    for (const path of ['/', '/compare.html', '/portfolio.html', '/sp500.html', '/disclaimer.html']) {
      await page.goto(path);
      await expect(methodology.footerLink).toHaveAttribute('href', 'methodology.html');
    }
    await analysis.goto('/?lang=es');
    await analysis.step('open Cómo calculamos from the footer', () => methodology.footerLink.click());
    await expect(methodology.heading).toHaveText('Cómo calculamos');
    await expect(methodology.flagRows.first()).toContainText('Los ingresos cayeron más de un 3 % al año');
  });
});
