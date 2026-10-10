import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { either } from './names';

/** The S&P 500 picker (sp500.html): the company list, search and sector filters, and up to 10 picks. */
export class Sp500Page extends BasePage {
  /** Serve the pinned 14-company test list, so tests don't change when the monthly refresh lands. */
  async useTestList(): Promise<void> {
    await this.page.route('**/data/sp500.json', (route) => route.fulfill({ path: 'tests/fixtures/sp500.json' }));
  }

  async goto(query = ''): Promise<void> {
    await this.step(`open the S&P 500 picker${query ? ` (?${query})` : ''}`, async () => {
      await this.useTestList();
      await this.page.goto(`/sp500.html${query ? `?${query}` : ''}`);
      await this.rows.first().waitFor();
    });
  }

  get search(): Locator {
    return this.page.getByRole('searchbox', { name: either('Search by name or ticker', 'Busca por nombre o ticker') });
  }

  get sector(): Locator {
    return this.page.getByRole('combobox', { name: 'Sector' });
  }

  get count(): Locator {
    return this.page.getByTestId('sp-count');
  }

  get rows(): Locator {
    return this.page.getByTestId('sp-row');
  }

  /** A company's checkbox, by its name and ticker as the label shows them. */
  checkbox(name: string): Locator {
    return this.page.getByRole('checkbox', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `) });  // then the ticker
  }

  async pick(...names: string[]): Promise<void> {
    for (const name of names) await this.step(`tick ${name}`, () => this.checkbox(name).check());
  }

  /** "3 of 10 selected" (a heading in the selection bar). */
  get pickedTitle(): Locator {
    return this.page.getByRole('heading', { name: / (selected|seleccionadas)$/ });
  }

  get chips(): Locator {
    return this.page.getByTestId('sp-chips').getByRole('button');
  }

  unpick(name: string): Locator {
    return this.page.getByRole('button', { name: either(`Remove ${name} from the selection`, `Quitar ${name} de la selección`) });
  }

  /** "Show N companies →": a link, disabled (aria-disabled) until something is picked. #id: its name holds a count. */
  get show(): Locator {
    return this.page.locator('#spShow');
  }

  get clear(): Locator {
    return this.page.getByRole('button', { name: either('Clear selection', 'Borrar selección') });
  }

  get status(): Locator {
    return this.page.getByTestId('sp-status');
  }

  get source(): Locator {
    return this.page.getByTestId('sp-source');
  }
}
