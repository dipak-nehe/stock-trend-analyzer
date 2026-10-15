import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { either } from './names';

/** Mutual funds & ETFs (funds.html): add up to four funds by ticker and compare their costs, returns and portfolios. */
export class FundsPage extends BasePage {
  async goto(query = ''): Promise<void> {
    await this.step(`open the Funds page${query ? ` (?${query})` : ''}`, () => this.page.goto(`/funds.html${query ? `?${query}` : ''}`));
  }

  get input(): Locator {
    return this.page.getByLabel(either('Fund or ETF ticker', 'Ticker del fondo o ETF'));
  }

  get addButton(): Locator {
    return this.page.getByRole('button', { name: either('Add', 'Añadir'), exact: true });
  }

  /** Type a ticker and press Add. */
  async add(ticker: string): Promise<void> {
    await this.step(`add ${ticker}`, async () => {
      await this.input.fill(ticker);
      await this.addButton.click();
    });
  }

  /** An example chip under the box ("Try: VOO VTI …"). */
  example(ticker: string): Locator {
    return this.page.getByTestId('fund-examples').getByRole('button', { name: ticker, exact: true });
  }

  /** The chips of the funds shown; each removes its fund. */
  get chips(): Locator {
    return this.page.getByTestId('fund-chip');
  }

  chip(ticker: string): Locator {
    return this.page.getByRole('button', { name: either(`Remove ${ticker}`, `Quitar ${ticker}`) });
  }

  get status(): Locator {
    return this.page.getByTestId('fund-status');
  }

  get result(): Locator {
    return this.page.getByTestId('fund-result');
  }

  get table(): Locator {
    return this.page.getByTestId('fund-table');
  }

  /** The column headers of the funds shown (ticker, name, share class). */
  get columns(): Locator {
    return this.page.getByTestId('fund-col');
  }

  /** A measure's row, by its key (expenseRatio, cost20, ret10, vsIndex10, turnover, report…). */
  row(key: string): Locator {
    return this.page.locator(`[data-testid="fund-row"][data-key="${key}"]`);
  }

  /** One fund's cell in a measure's row (0 = the first fund). */
  cell(key: string, index: number): Locator {
    return this.row(key).getByRole('cell').nth(index);
  }

  get caveat(): Locator {
    return this.page.getByTestId('fund-caveat');
  }

  get mixCards(): Locator {
    return this.page.getByTestId('fund-mix-card');
  }
}
