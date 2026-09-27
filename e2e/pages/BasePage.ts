import { test, type Locator, type Page } from '@playwright/test';
import { either } from './names';

/**
 * What every page of the site has: the header (Home, language switch), the disclaimer and the footer.
 *
 * Locator order in all page objects: getByRole → getByText → getByLabel → getByPlaceholder → getByTitle →
 * getByTestId → CSS (only for sub-parts with no role, each marked "CSS:" with the reason). No XPath.
 * Controls people use are found by role/label (so the tests also prove they're real buttons, tabs, links and
 * labelled fields); content the tests read is found by data-testid.
 */
export class BasePage {
  constructor(readonly page: Page) {}

  // ---------- header ----------
  get homeButton(): Locator {
    return this.page.getByRole('link', { name: either('Home', 'Inicio') });
  }

  languageButton(lang: 'en' | 'es'): Locator {
    return this.page.getByRole('group', { name: 'Language / Idioma' }).getByRole('button', { name: lang.toUpperCase(), exact: true });
  }

  async switchLanguage(lang: 'en' | 'es'): Promise<void> {
    await this.languageButton(lang).click();
  }

  // ---------- page-wide ----------
  get main(): Locator {
    return this.page.getByRole('main');
  }

  get footer(): Locator {
    return this.page.getByRole('contentinfo');
  }

  get disclaimer(): Locator {
    return this.page.getByTestId('disclaimer');
  }

  /** CSS: the document root has no role; used for its lang attribute. */
  get root(): Locator {
    return this.page.locator('html');
  }

  // ---------- report ----------
  /** Attach a screenshot of the screen to the report. */
  async snap(name: string): Promise<void> {
    try {
      const body = await this.page.screenshot({ type: 'jpeg', quality: 40, scale: 'css' });
      await test.info().attach(name, { body, contentType: 'image/jpeg' });
    } catch {
      // a missing screenshot must never fail or hide a test result
    }
  }

  /** A named step in the report that ends with a screenshot, so the flow can be replayed step by step. */
  async step<T>(title: string, body: () => Promise<T>): Promise<T> {
    return test.step(title, async () => {
      const result = await body();
      await this.snap(title);
      return result;
    });
  }
}
