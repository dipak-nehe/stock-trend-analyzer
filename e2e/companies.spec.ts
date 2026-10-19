// All companies (companies.html): every listed company with its exchange and industry, from public/data/companies.json.
// Runs on a pinned 14-company list (tests/fixtures/companies.json).
import { expect, test } from './fixtures';

test.describe('the list', () => {
  test('every company with its ticker, exchange and industry, each linking to its analysis', async ({ companies, page, consoleErrors }) => {
    await companies.goto();
    await expect(companies.count).toHaveText('14 companies');
    const ko = companies.rows.filter({ hasText: 'COCA COLA CO' }).first();
    await expect(ko).toHaveText(/COCA COLA CO\s*(Beverages)?\s*KO\s*NYSE\s*Beverages/);
    await expect(ko.getByRole('link')).toHaveAttribute('href', '/stock/KO');
    await expect(companies.rows.filter({ hasText: 'Not classified' }).first()).toBeVisible();   // no recent statements
    await companies.step('open Coca-Cola', () => ko.getByRole('link').click());
    await expect(page).toHaveURL(/\/stock\/KO$/);
    expect(consoleErrors).toEqual([]);
  });

  test('search, industry and exchange filters, kept in the address', async ({ companies, page }) => {
    await companies.goto();
    await companies.step('search for coca cola', () => companies.search.fill('coca cola'));
    await expect(companies.count).toHaveText('4 companies');
    await companies.step('choose the soft-drinks industry', () => companies.industry.selectOption('2086'));
    await expect(companies.count).toHaveText('3 companies');
    await companies.step('choose NYSE', () => companies.exchange.selectOption('NYSE'));
    await expect(companies.rows).toHaveText([/COCA COLA FEMSA SAB DE CV\s*.*KOF/]);
    await expect(page).toHaveURL(/q=coca\+cola&ind=2086&ex=NYSE$/);
    await companies.step('search for a ticker', async () => {
      await companies.industry.selectOption('');
      await companies.exchange.selectOption('');
      await companies.search.fill('brk.b');
    });
    await expect(companies.rows).toHaveCount(1);
    await expect(companies.rows.first()).toContainText('BRK-B');
  });

  test('sorting by a column, and again the other way; a shared link opens the same view', async ({ companies, page }) => {
    await companies.goto();
    await companies.step('sort by ticker', () => companies.sortBy('Ticker').click());
    await expect(companies.rows.first().getByRole('cell').first()).toHaveText('AAPL');
    await companies.step('sort by ticker again', () => companies.sortBy('Ticker').click());
    await expect(companies.rows.first().getByRole('cell').first()).toHaveText('TKDG');
    await expect(page).toHaveURL(/sort=-ticker$/);
    await companies.goto('q=coca&lang=es');
    await expect(companies.count).toHaveText('4 empresas');
    await expect(page.getByRole('heading', { name: 'Todas las empresas' })).toBeVisible();
  });
});
