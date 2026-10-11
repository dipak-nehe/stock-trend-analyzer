import type { Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { either } from './names';

/** "How we calculate" (methodology.html): where the figures come from and every rule. */
export class MethodologyPage extends BasePage {
  async goto(query = ''): Promise<void> {
    await this.step(`open How we calculate${query ? ` (?${query})` : ''}`, async () => {
      await this.page.goto(`/methodology.html${query ? `?${query}` : ''}`);
    });
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { level: 2, name: either('How we calculate', 'Cómo calculamos') });
  }

  /** A section's rule table container, by its data-testid (meth-flags, meth-graham, meth-durable, …). */
  rules(id: string): Locator {
    return this.page.getByTestId(id);
  }

  get flagRows(): Locator {
    return this.page.getByTestId('meth-flag');
  }

  get reportLink(): Locator {
    return this.page.getByTestId('report-link');
  }

}
