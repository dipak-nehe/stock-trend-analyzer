import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { either } from './names';

/** The disclaimer page (disclaimer.html): the full investment risk disclaimer, in English or Spanish. */
export class DisclaimerPage extends BasePage {
  async goto(query = ''): Promise<void> {
    await this.step(`open the disclaimer page${query ? ` (?${query})` : ''}`, async () => {
      await this.page.goto(`/disclaimer.html${query ? `?${query}` : ''}`);
    });
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { level: 2, name: either('Investment risk disclaimer', 'Aviso sobre riesgos de inversión') });
  }

  /** The section headings (Not advice, Risk of loss, …). */
  get sectionHeadings(): Locator {
    return this.page.getByTestId('legal').getByRole('heading', { level: 3 });
  }

  get backLink(): Locator {
    return this.page.getByRole('link', { name: either('← Back to the analysis', '← Volver al análisis') });
  }
}
