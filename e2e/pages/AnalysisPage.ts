import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { either, GUIDE_TITLES, startsWith, TAB_NAMES, type Tab } from './names';

/** The start and results page (index.html): search, the company header, the glance card, the tabs and the guide. */
export class AnalysisPage extends BasePage {
  // ---------- navigation ----------
  async goto(path = '/'): Promise<void> {
    await this.step(`open ${path}`, () => this.page.goto(path));
  }

  /** Open a company's results (optionally with a share price) and wait until they're rendered. */
  async open(ticker: string, price?: number): Promise<void> {
    await this.step(`open ${ticker}${price ? ` with price ${price}` : ''}`, async () => {
      await this.page.goto(`/?t=${ticker}${price ? `&p=${price}` : ''}`);
      await this.result.waitFor({ state: 'visible' });
    });
  }

  // ---------- search ----------
  get searchBox(): Locator {
    return this.page.getByLabel(either('Look up a company', 'Buscar una empresa'));
  }

  get searchLabel(): Locator {
    return this.page.getByTestId('search-label');
  }

  get analyzeButton(): Locator {
    return this.page.getByRole('button', { name: either('Analyze', 'Analizar') });
  }

  /** One of the "Try:" example tickers under the search box. */
  exampleButton(ticker: string): Locator {
    return this.page.getByRole('button', { name: ticker, exact: true });
  }

  async search(ticker: string): Promise<void> {
    await this.step(`search for ${ticker}`, async () => {
      await this.searchBox.fill(ticker);
      await this.analyzeButton.click();
    });
  }

  get error(): Locator {
    return this.page.getByRole('alert');
  }

  get result(): Locator {
    return this.page.getByTestId('result');
  }

  // ---------- company header ----------
  get companyName(): Locator {
    return this.page.getByTestId('company-name');
  }

  get companyMeta(): Locator {
    return this.page.getByTestId('company-meta');
  }

  get dataAsOf(): Locator {
    return this.page.getByTestId('data-as-of');
  }

  get staleNote(): Locator {
    return this.page.getByTestId('stale-note');
  }

  /** #id: the link text is hard-coded copy with an arrow; the tests check its text and address separately. */
  // ---------- insider trades (SEC history tab) ----------
  get insiders(): Locator {
    return this.page.getByTestId('insiders');
  }

  get insidersHeading(): Locator {
    return this.page.getByRole('heading', { name: either('Insider trades · last 12 months', 'Operaciones de directivos · últimos 12 meses') });
  }

  get insiderBuys(): Locator {
    return this.page.getByTestId('insider-buys');
  }

  get insiderSells(): Locator {
    return this.page.getByTestId('insider-sells');
  }

  get insiderTrades(): Locator {
    return this.page.getByTestId('insider-trade');
  }

  /** The note shown when several insiders bought on the open market. */
  get insiderSignal(): Locator {
    return this.page.getByTestId('insider-signal');
  }

  get insidersRetryButton(): Locator {
    return this.insiders.getByRole('button', { name: either('Try again', 'Reintentar') });
  }

  get allInsiderFilingsLink(): Locator {
    return this.insiders.getByRole('link', { name: either('All insider filings on SEC ↗', 'Todas las presentaciones de directivos en la SEC ↗') });
  }

  /** CSS: text quoted from SEC filings in English (e.g. insiders' job titles) is marked lang="en" on any page. */
  get sourceEnglish(): Locator {
    return this.main.locator('[lang="en"]');
  }

  get compareLink(): Locator {
    return this.page.locator('#compareLink');
  }

  // ---------- at a glance ----------
  get glance(): Locator {
    return this.page.getByTestId('glance');
  }

  get glanceTitle(): Locator {
    return this.page.getByTestId('glance-title');
  }

  get glanceHead(): Locator {
    return this.page.getByTestId('glance-head');
  }

  /** The six one-line verdicts; each is a button that opens its tab. */
  get glanceRows(): Locator {
    return this.glance.getByRole('button');
  }

  glanceRow(topic: string): Locator {
    return this.glanceRows.filter({ hasText: topic });
  }

  get glanceTopics(): Locator {
    return this.glance.getByTestId('glance-what');
  }

  // ---------- tabs ----------
  get tabList(): Locator {
    return this.page.getByRole('tablist');
  }

  tab(name: Tab): Locator {
    return this.page.getByRole('tab', { name: TAB_NAMES[name] });
  }

  /** A tab panel (hidden panels aren't found by role, which toBeHidden() treats as hidden). */
  panel(name: Tab): Locator {
    return this.page.getByRole('tabpanel', { name: TAB_NAMES[name] });
  }

  async openTab(name: Tab): Promise<void> {
    await this.step(`open the ${name} tab`, async () => {
      await this.tab(name).click();
      await expect(this.panel(name)).toBeVisible();
    });
  }

  /** CSS: the tab's icon is an SVG <use> of the sprite, with no role (aria-hidden). */
  tabIcon(name: Tab): Locator {
    return this.tab(name).locator('use');
  }

  get flagsBadge(): Locator {
    return this.page.getByTestId('flags-badge');
  }

  get historyBadge(): Locator {
    return this.page.getByTestId('history-badge');
  }

  /** "← Previous" / "Next: … →" at the bottom of a tab (the panel's only navigation). */
  panelNav(name: Tab): Locator {
    return this.panel(name).getByRole('navigation');
  }

  panelNavButtons(name: Tab): Locator {
    return this.panelNav(name).getByRole('button');
  }

  nextButton(name: Tab): Locator {
    return this.panelNav(name).getByRole('button', { name: /^(Next|Siguiente)/ });
  }

  previousButton(name: Tab): Locator {
    return this.panelNav(name).getByRole('button', { name: /^←/ });
  }

  /** The short explanation at the top of a tab. */
  sectionNote(name: Tab): Locator {
    return this.panel(name).getByTestId('section-note').first();
  }

  // ---------- overview ----------
  get trendTiles(): Locator {
    return this.page.getByTestId('trend-tiles');
  }

  get tiles(): Locator {
    return this.trendTiles.getByTestId('tile');
  }

  /** CSS: the sparklines are decorative SVGs with no role. */
  get sparklines(): Locator {
    return this.trendTiles.locator('svg.spark');
  }

  get growthTable(): Locator {
    return this.page.getByTestId('growth-table');
  }

  growthRow(label: string): Locator {
    return this.growthTable.getByRole('row').filter({ hasText: label });
  }

  /** A jargon term with its definition in a tooltip (title attribute). */
  jargon(definition: RegExp): Locator {
    return this.panel('overview').getByTitle(definition);
  }

  // ---------- red flags ----------
  get flags(): Locator {
    return this.page.getByTestId('flags');
  }

  get flagGroupHeadings(): Locator {
    return this.flags.getByRole('heading', { level: 3 });
  }

  get flagCards(): Locator {
    return this.flags.getByTestId('flag');
  }

  get flagTitles(): Locator {
    return this.flags.getByTestId('flag-title');
  }

  get criticalFlagTitles(): Locator {
    return this.flagCards.filter({ has: this.page.getByText('Critical', { exact: true }) }).getByTestId('flag-title');
  }

  // ---------- SEC history ----------
  get historyTiles(): Locator {
    return this.page.getByTestId('history-tiles').getByTestId('tile');
  }

  get historyList(): Locator {
    return this.page.getByTestId('history-list');
  }

  get historyEvents(): Locator {
    return this.historyList.getByTestId('history-event');
  }

  /** #id: the filter buttons' names include counts ("SEC letters & replies (0)"); pick them by their filter key. */
  historyFilter(key: 'all' | 'flags' | 'letters' | 'amendments'): Locator {
    return this.page.locator(`#historyFilters [data-f="${key}"]`);
  }

  /** #id: its name includes the count ("Show all 17"). */
  get showAllFilings(): Locator {
    return this.page.locator('#historyMore');
  }

  // ---------- Graham & Buffett ----------
  get price(): Locator {
    return this.page.getByLabel(startsWith('Current share price', 'Precio actual de la acción'));
  }

  get priceLinks(): Locator {
    return this.page.getByTestId('price-links').getByRole('link');
  }

  /** One row of the Graham/Buffett checklists, by its criterion name. */
  checkRow(criterion: string): Locator {
    return this.page.getByTestId('check').filter({ hasText: criterion });
  }

  get valueTiles(): Locator {
    return this.page.getByTestId('value-tiles');
  }

  get grahamScore(): Locator {
    return this.page.getByTestId('graham-score');
  }

  /** "R&D (% of revenue)" on the Overview tab; only there when the company reports R&D. */
  get rdTile(): Locator {
    return this.page.getByTestId('rd-tile');
  }

  /** The collapsible "Adjust the value estimate's assumptions" panel on the value tab, and its inputs. */
  get assumptions(): Locator {
    return this.page.getByTestId('assumptions');
  }

  assumption(name: 'Growth, years 1–10 (%)' | 'Discount rate (%)' | 'Growth after year 10 (%)'): Locator {
    return this.assumptions.getByLabel(name);
  }

  /** "Latest 12 months" card on the Overview: figures from the newest quarterly report. */
  get ttmCard(): Locator {
    return this.page.getByTestId('ttm');
  }

  get piotroski(): Locator {
    return this.page.getByTestId('piotroski');
  }

  get piotroskiScore(): Locator {
    return this.page.getByTestId('piotroski-score');
  }

  get buffettScore(): Locator {
    return this.page.getByTestId('buffett-score');
  }

  /** The score bar: an image whose name reads the score ("4 of 8 criteria met"). */
  get grahamMeter(): Locator {
    return this.grahamScore.getByRole('img');
  }

  /** CSS: the bar's fill is an unlabelled span inside the meter; its width is the score. */
  get grahamMeterFill(): Locator {
    return this.grahamMeter.locator('span');
  }

  get valueNote(): Locator {
    return this.page.getByTestId('value-note');
  }

  // ---------- charts and data ----------
  chart(id: string): Locator {
    return this.page.getByTestId(`chart-${id}`);
  }

  /** The wide data table's scrollable region (named by the Data tab). */
  get dataTableRegion(): Locator {
    return this.panel('data').getByRole('region');
  }

  get glossary(): Locator {
    return this.page.getByTestId('glossary');
  }

  get glossaryToggle(): Locator {
    return this.page.getByTestId('glossary-toggle');
  }

  get glossaryTerms(): Locator {
    return this.glossary.getByRole('term');
  }

  /** "Type a ticker first…", shown when Analyze is pressed with an empty box. */
  get searchHint(): Locator {
    return this.page.getByTestId('search-hint');
  }

  // ---------- start-page quotes ----------
  get quotes(): Locator {
    return this.page.getByTestId('quotes');
  }

  /** The day's Buffett quote inside the quotes section. */
  get dailyQuote(): Locator {
    return this.page.getByTestId('daily-quote');
  }

  // ---------- guide ----------
  get guide(): Locator {
    return this.page.getByTestId('guide');
  }

  /** The guide's summary line (a <summary>, which has no button role). */
  get guideToggle(): Locator {
    return this.page.getByTestId('guide-toggle');
  }

  get guideShowText(): Locator {
    return this.page.getByTestId('guide-show');
  }

  get guideHideText(): Locator {
    return this.page.getByTestId('guide-hide');
  }

  get guideTitle(): Locator {
    return this.page.getByTestId('guide-title');
  }

  get guideIntro(): Locator {
    return this.page.getByTestId('guide-intro');
  }

  get guideCards(): Locator {
    return this.page.getByTestId('guide-cards');
  }

  get guideCardTitles(): Locator {
    return this.guideCards.getByTestId('guide-card-title');
  }

  get guideCardArrows(): Locator {
    return this.guideCards.getByTestId('guide-card-go');
  }

  /** The guide card that opens a tab (each card is a button; found while the guide is collapsed too). */
  guideCard(tab: Tab): Locator {
    return this.guideCards.getByRole('button', { includeHidden: true }).filter({ has: this.page.getByTestId('guide-card-title').getByText(GUIDE_TITLES[tab], { exact: true }) });
  }

  /** CSS: the card's icon is an SVG <use> of the sprite, with no role (aria-hidden). */
  guideCardIcon(tab: Tab): Locator {
    return this.guideCard(tab).locator('use');
  }
}
