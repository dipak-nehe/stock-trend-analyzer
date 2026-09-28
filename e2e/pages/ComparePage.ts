import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { either } from './names';

/** The compare page (compare.html): two ticker slots, the comparison tables, prices and charts. */
export class ComparePage extends BasePage {
  async goto(query: string): Promise<void> {
    await this.step(`open compare.html?${query}`, async () => {
      await this.page.goto(`/compare.html?${query}`);
      if (query.includes('b=')) await this.comparison.waitFor({ state: 'visible' });
    });
  }

  // ---------- the two slots ----------
  // By role, not just label: each slot's search form carries the same name as its text box.
  get firstTicker(): Locator {
    return this.page.getByRole('textbox', { name: either('First stock', 'Primera acción') });
  }

  get secondTicker(): Locator {
    return this.page.getByRole('textbox', { name: either('Second stock', 'Segunda acción') });
  }

  /** The first stock's "Load" button. */
  get loadButton(): Locator {
    return this.page.getByRole('button', { name: either('Load', 'Cargar') });
  }

  get compareButton(): Locator {
    return this.page.getByRole('button', { name: either('Compare', 'Comparar') });
  }

  /** #id: the name is a symbol plus hard-coded copy ("⇄ Swap"). */
  get swapButton(): Locator {
    return this.page.locator('#swap');
  }

  /** One of the "Try:" example tickers for the second slot. */
  exampleButton(ticker: string): Locator {
    return this.page.getByRole('button', { name: ticker, exact: true });
  }

  async compareWith(ticker: string): Promise<void> {
    await this.step(`compare with ${ticker}`, async () => {
      await this.secondTicker.fill(ticker);
      await this.compareButton.click();
    });
  }

  get statusA(): Locator {
    return this.page.getByTestId('status-a');
  }

  get statusB(): Locator {
    return this.page.getByTestId('status-b');
  }

  /** #id: hard-coded copy with an arrow; the tests check its address. */
  get backLink(): Locator {
    return this.page.locator('#backLink');
  }

  // ---------- results ----------
  get emptyMessage(): Locator {
    return this.page.getByTestId('compare-empty');
  }

  get comparison(): Locator {
    return this.page.getByTestId('comparison');
  }

  get companyCards(): Locator {
    return this.page.getByTestId('company-cards').getByTestId('company-card');
  }

  get companyCardsArea(): Locator {
    return this.page.getByTestId('company-cards');
  }

  /** #id: the table's region is named after a hard-coded heading ("Key figures"). */
  get figuresTable(): Locator {
    return this.page.locator('#cmpTable');
  }

  get figureHeaders(): Locator {
    return this.figuresTable.getByRole('columnheader');
  }

  /** A key-figures row, by its row header (the measure). */
  figureRow(measure: string): Locator {
    return this.figuresTable.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name: measure }) });
  }

  /** CSS: the ● mark is decorative (aria-hidden); screen readers get favourableText instead. */
  favouriteMarks(row: Locator): Locator {
    return row.locator('.fav-dot');
  }

  favourableText(row: Locator): Locator {
    return row.getByText(either('(more favourable)', '(más favorable)'));
  }

  /** #id: the table's region is named after a hard-coded heading ("Graham & Buffett criteria"). */
  get criteriaTable(): Locator {
    return this.page.locator('#cmpGrid');
  }

  /** A company's price field: its label is the company's ticker once loaded (e.g. "KO"). */
  priceFor(ticker: string): Locator {
    return this.page.getByLabel(ticker, { exact: true });
  }

  chart(id: string): Locator {
    return this.page.getByTestId(`chart-${id}`);
  }
}
