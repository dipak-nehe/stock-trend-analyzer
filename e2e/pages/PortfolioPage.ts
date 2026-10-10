import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { either } from './names';

/** "My portfolio" (portfolio.html): add stocks, and a table of ten 10-year measures per stock. */
export class PortfolioPage extends BasePage {
  async goto(query = ''): Promise<void> {
    await this.step(`open My portfolio${query ? ` (?${query})` : ''}`, async () => {
      await this.page.goto(`/portfolio.html${query ? `?${query}` : ''}`);
    });
  }

  // ---------- adding ----------
  /** The search box: a combobox (it owns the suggestions list), so by role; its label also names the form. */
  get searchBox(): Locator {
    return this.page.getByRole('combobox', { name: either('Add a company by name or ticker', 'Añade una empresa por nombre o ticker') });
  }

  get addButton(): Locator {
    return this.page.getByRole('button', { name: either('Add', 'Añadir') });
  }

  chip(ticker: string): Locator {
    return this.page.getByRole('button', { name: ticker, exact: true });
  }

  async add(text: string): Promise<void> {
    await this.step(`add ${text}`, async () => {
      await this.searchBox.fill(text);
      await this.addButton.click();
    });
  }

  get status(): Locator {
    return this.page.getByTestId('pf-status');
  }

  get empty(): Locator {
    return this.page.getByTestId('pf-empty');
  }

  // ---------- the table ----------
  get table(): Locator {
    return this.page.getByTestId('pf-table');
  }

  get rows(): Locator {
    return this.page.getByTestId('pf-row');
  }

  /** A stock's row, by its ticker (shown as "Name (TICKER)", or just the ticker while loading or after an error). */
  row(ticker: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('rowheader', { name: new RegExp(`(^|\\()${ticker}(\\)|$)`) }) });
  }

  /** The cell of a stock's row under a column, by the column's position (0 = the first measure). */
  cell(ticker: string, column: number): Locator {
    return this.row(ticker).getByRole('cell').nth(column);
  }

  columnHeader(name: string | RegExp): Locator {
    return this.page.getByRole('columnheader', { name });
  }

  /** The sort button in a column header (its name ends with ▲/▼ once sorted). */
  sortButton(name: string): Locator {
    return this.columnHeader(new RegExp(`^${name}`)).getByRole('button');
  }

  removeButton(ticker: string): Locator {
    return this.page.getByRole('button', { name: either(`Remove ${ticker}`, `Quitar ${ticker}`) });
  }

  get removeAll(): Locator {
    return this.page.getByRole('button', { name: either('Remove all', 'Quitar todas') });
  }

  get median(): Locator {
    return this.page.getByTestId('pf-median');
  }

  get legend(): Locator {
    return this.page.getByTestId('pf-legend');
  }

  /** Company links in the first column, each opening its full analysis. */
  companyLink(ticker: string): Locator {
    return this.row(ticker).getByRole('link');
  }
}
