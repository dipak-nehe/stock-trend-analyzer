import type { Locator } from '@playwright/test';
import { PortfolioPage } from './PortfolioPage';
import { either } from './names';

/** The S&P 500 picks (sp500-view.html?t=…): the same table as My portfolio, read-only, with Back and Save. */
export class Sp500ViewPage extends PortfolioPage {
  async gotoView(query: string): Promise<void> {
    await this.step(`open the S&P 500 picks (?${query})`, async () => {
      await this.page.goto(`/sp500-view.html?${query}`);
    });
  }

  get changeSelection(): Locator {
    return this.page.getByRole('link', { name: either('← Change selection', '← Cambiar la selección') });
  }

  get save(): Locator {
    return this.page.getByRole('button', { name: either('Save to My portfolio', 'Guardar en Mi cartera') });
  }

  get status(): Locator {
    return this.page.getByTestId('spv-status');
  }

  get openPortfolio(): Locator {
    return this.page.getByRole('link', { name: either('Open My portfolio →', 'Abrir Mi cartera →') });
  }
}
