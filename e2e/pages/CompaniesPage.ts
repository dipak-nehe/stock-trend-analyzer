import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { either } from './names';

/** All companies (companies.html): every listed company with its exchange and industry. */
export class CompaniesPage extends BasePage {
  /** Serve the pinned test list (tests/fixtures/companies.json), so tests don't change when the monthly refresh lands. */
  async goto(query = ''): Promise<void> {
    await this.step(`open All companies${query ? ` (?${query})` : ''}`, async () => {
      await this.page.route('**/data/companies.json', (route) => route.fulfill({ path: 'tests/fixtures/companies.json' }));
      await this.page.goto(`/companies.html${query ? `?${query}` : ''}`);
      await this.rows.first().waitFor();
    });
  }

  get search(): Locator {
    return this.page.getByRole('searchbox', { name: either('Search by name or ticker', 'Busca por nombre o ticker') });
  }

  get industry(): Locator {
    return this.page.getByRole('combobox', { name: either('Industry', 'Sector') });
  }

  get exchange(): Locator {
    return this.page.getByRole('combobox', { name: either('Exchange', 'Bolsa') });
  }

  get count(): Locator {
    return this.page.getByTestId('co-count');
  }

  get rows(): Locator {
    return this.page.getByTestId('co-row');
  }

  sortBy(column: string): Locator {
    return this.page.getByTestId('co-table').getByRole('button', { name: new RegExp(`^${column}`) });
  }
}
