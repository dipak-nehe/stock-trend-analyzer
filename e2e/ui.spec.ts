// The results page, driven in Chromium against offline SEC fixtures. Elements come from the AnalysisPage object.
import { anyContains, expect, slowScript, TABS, test } from './fixtures';
import { BASE_URL, url } from './env';

test('search shows company trends and charts', async ({ analysis, page, consoleErrors }) => {
  await analysis.goto('/');
  await analysis.search('aapl');
  await expect(analysis.companyName).toHaveText('Apple Inc. (AAPL)');
  await expect(analysis.companyMeta).toContainText('Electronic Computers');
  await expect(analysis.tiles.first()).toContainText('$416.2B');
  await expect(analysis.trendTiles).toContainText('Growing');
  await expect(page).toHaveURL(/\?t=AAPL$/);
  await analysis.openTab('charts');
  await expect(page).toHaveURL(/\?t=AAPL#charts$/);
  // all eight charts are drawn
  for (const id of ['cRevenue', 'cEps', 'cDps', 'cPayout', 'cBalance', 'cDebt', 'cCash', 'cMargin']) {
    const box = await analysis.chart(id).boundingBox();
    expect(box?.height, id).toBeGreaterThan(100);
  }
  expect(consoleErrors).toEqual([]);
});

test('chips load a company', async ({ analysis }) => {
  await analysis.goto('/');
  await analysis.exampleButton('KO').click();
  await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
});

test('growth table compares first and latest year', async ({ analysis }) => {
  await analysis.open('AAPL');
  const revenue = analysis.growthRow('Revenue');
  await expect(revenue).toContainText('$215.6B');
  await expect(revenue).toContainText('$416.2B');
  await expect(revenue).toContainText('93.0%');
  await expect(revenue).toContainText('7.6%');
});

test('loss-making company is described in words', async ({ analysis }) => {
  await analysis.open('INTC');
  await expect(analysis.growthRow('Net income')).toContainText('From profit to loss');
  await expect(analysis.growthRow('Dividend / share')).toContainText('Fell to zero');
  const titles = await analysis.flagTitles.allInnerTexts();
  expect(anyContains(titles, 'Recent net losses')).toBe(true);
  expect(anyContains(titles, 'Dividend cut, then suspended')).toBe(true);
});

test('restatements and late filings are flagged', async ({ analysis }) => {
  await analysis.open('SMCI');
  const critical = await analysis.criticalFlagTitles.allInnerTexts();
  expect(anyContains(critical, 'Restatement warning')).toBe(true);
  expect(anyContains(critical, 'Late SEC filings')).toBe(true);
  await expect(analysis.historyTiles.filter({ hasText: 'Late filings' })).toContainText('13');
  await expect(analysis.historyTiles.filter({ hasText: 'Restatement warnings' })).toContainText('Serious');
  // Exchange notices (8-K item 3.01) share the "Other serious events" tile and get their own flag.
  expect(anyContains(critical, 'Stock exchange warnings')).toBe(true);
  await expect(analysis.historyTiles.filter({ hasText: 'Other serious events' })).toContainText('14 × exchange notice');
  // Under our plain-English text, each event shows the SEC's own title word for word.
  await analysis.openTab('history');
  await expect(analysis.historyList).toContainText(
    'SEC 8-K item 3.01: Notice of Delisting or Failure to Satisfy a Continued Listing Rule or Standard; Transfer of Listing');
});

test('filing history filters and expands', async ({ analysis }) => {
  await analysis.open('SMCI');
  await analysis.openTab('history');
  await expect(analysis.historyEvents).toHaveCount(10); // first ten shown
  await analysis.step('show all 31 filings', async () => {
    await analysis.showAllFilings.click();
    await expect(analysis.historyEvents).toHaveCount(31); // 17 + 14 stock exchange notices
  });
  await analysis.step('filter: SEC letters (none)', async () => {
    await analysis.historyFilter('letters').click();
    await expect(analysis.historyList).toContainText('No filings of this kind');
  });
  await analysis.step('filter: red-flag filings', () => analysis.historyFilter('flags').click());
  await expect(analysis.historyFilter('flags')).toHaveAttribute('aria-pressed', 'true');
  await expect(analysis.historyEvents.first().getByRole('link').first()).toHaveAttribute(
    'href', /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1375365\//);
});

test('clean filer gets a strength', async ({ analysis }) => {
  await analysis.open('KO');
  expect(anyContains(await analysis.flagTitles.allInnerTexts(), 'Clean filing record')).toBe(true);
});

test('price runs valuation tests and is kept in the URL', async ({ analysis, page }) => {
  await analysis.open('KO');
  await expect(analysis.checkRow('Moderate P/E')).toContainText('Needs price');
  await analysis.openTab('value');
  await analysis.step('enter a share price of 68', async () => {
    await analysis.price.fill('68');
    await expect(analysis.checkRow('Moderate P/E')).toContainText('Not met');
  });
  await expect(analysis.checkRow('Moderate P/E')).toContainText('P/E 25.6');
  await expect(analysis.checkRow('Margin of safety')).toContainText('Not met');
  await expect(analysis.valueTiles).toContainText('Price is');
  await expect(page).toHaveURL(/\?t=KO&p=68#value$/);
});

test('price from link is applied on load', async ({ analysis }) => {
  await analysis.open('KO', 68);
  await expect(analysis.price).toHaveValue('68');
  await expect(analysis.checkRow('Moderate P/E')).toContainText('P/E 25.6');
});

test('new search clears the previous price', async ({ analysis }) => {
  await analysis.open('KO', 68);
  await analysis.search('AAPL');
  await expect(analysis.companyName).toHaveText('Apple Inc. (AAPL)');
  await expect(analysis.price).toHaveValue('');
});

test('checklist scores add up', async ({ analysis }) => {
  await analysis.open('KO', 68);
  await expect(analysis.grahamScore).toContainText('Meets 4 of 8');
  await expect(analysis.buffettScore).toContainText('Meets 6 of 7');
});

test('bank-specific rules are skipped', async ({ analysis }) => {
  await analysis.open('JPM');
  expect(anyContains(await analysis.flagTitles.allInnerTexts(), 'Looks like a bank')).toBe(true);
  await expect(analysis.checkRow('Strong current position')).toContainText('N/A');
  await expect(analysis.checkRow('Low capital needs')).toContainText('N/A');
});

// ---------- a wrong ticker ----------
// Regression: on the start page the error was drawn below the guide, off-screen on a laptop, so a wrong ticker
// seemed to do nothing. After a result, the address kept the previous company.

test('a wrong ticker typed on the start page shows its error on screen', async ({ analysis, page }) => {
  await analysis.goto('/');
  await analysis.search('ZZZZQ');
  await expect(analysis.error).toContainText("Ticker 'ZZZZQ' not found in SEC EDGAR");
  await expect(analysis.error).toBeInViewport(); // right under the search box, not below the guide
  await expect(analysis.result).toBeHidden();
  await expect(page).toHaveURL(/\?t=ZZZZQ$/);
  await analysis.snap('error under the search box');
});

test('a wrong ticker after a result replaces it, and the address follows', async ({ analysis, page, consoleErrors }) => {
  await analysis.open('KO');
  await analysis.search('ZZZZQ');
  await expect(analysis.error).toBeInViewport();
  await expect(analysis.result).toBeHidden();
  await expect(page).toHaveURL(/\?t=ZZZZQ$/); // not ?t=KO
  await analysis.step('reload the page', () => page.reload().then(() => undefined));
  await expect(analysis.error).toContainText("Ticker 'ZZZZQ' not found"); // the same error, not Coca-Cola
  await expect(analysis.result).toBeHidden();
  // The browser logs the API's 404 for an unknown ticker; anything else would be a real error.
  expect(consoleErrors.filter((e) => !/status of 404/.test(e))).toEqual([]);
});

test('switching language after a wrong ticker translates the error and never brings back the old result', async ({ analysis, page }) => {
  await analysis.open('KO');
  await analysis.search('ZZZZQ');
  await expect(analysis.error).toBeVisible();
  await analysis.switchLanguage('es');
  await expect(analysis.error).toContainText('No se encuentra el ticker «ZZZZQ»');
  await expect(analysis.result).toBeHidden();
  await expect(page).toHaveURL(/\?t=ZZZZQ&lang=es$/);
});

test('a badly formed ticker shows its error on screen', async ({ analysis }) => {
  await analysis.goto('/');
  await analysis.search('x y');
  await expect(analysis.error).toContainText("doesn't look like a ticker");
  await expect(analysis.error).toBeInViewport();
});

test('unknown ticker shows a friendly error', async ({ analysis }) => {
  await analysis.goto('/?t=ZZZZQ');
  await expect(analysis.error).toBeVisible();
  await expect(analysis.error).toContainText('not found in SEC EDGAR');
  await expect(analysis.result).toBeHidden();
});

test('invalid input is rejected', async ({ analysis }) => {
  await analysis.goto('/');
  await analysis.search('<b>x');
  await expect(analysis.error).toContainText("doesn't look like a ticker");
  await expect(analysis.error.getByText('x', { exact: true })).toHaveCount(0); // shown as text, never as HTML (no <b>x</b>)
});

test('disclaimer is always visible', async ({ analysis }) => {
  await analysis.goto('/');
  await expect(analysis.disclaimer).toContainText('Not investment advice');
});

test('phone layout has no horizontal scroll', async ({ analysis, page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await analysis.open('AAPL');
  const [scroll, client] = await page.evaluate(() => [
    document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
});

test('"Show all" keeps the price and raises no errors', async ({ analysis, consoleErrors }) => {
  // Regression: the "Show all" button shares the .chip style with the ticker buttons and used to
  // be wired as one, which cleared the price and threw a JavaScript error.
  await analysis.open('SMCI', 30);
  await analysis.openTab('history');
  await analysis.step('show all filings', () => analysis.showAllFilings.click());
  await expect(analysis.historyEvents).toHaveCount(31);
  await expect(analysis.price).toHaveValue('30');
  expect(consoleErrors).toEqual([]);
});

test('guide explains the results before a search', async ({ analysis }) => {
  await analysis.goto('/');
  await expect(analysis.guide).toHaveAttribute('open', '');
  // the guide's cards are named after the tabs, so the guide maps directly onto the results
  await expect(analysis.guideCardTitles).toHaveText(
    ['Overview', 'Red flags', 'SEC history', 'Graham & Buffett-style analysis', 'Charts', 'Data']);
  await expect(analysis.howItWorksSteps).toHaveCount(3); // the three-step "how it works" strip
  await expect(analysis.guideCardArrows.first()).toBeVisible();
});

test('guide collapses after a search and can be reopened', async ({ analysis }) => {
  await analysis.open('KO');
  await expect(analysis.guide).not.toHaveAttribute('open', '');
  await expect(analysis.guideCards).toBeHidden();
  await analysis.step('open the guide', () => analysis.guideToggle.click());
  await expect(analysis.guideCards).toBeVisible();
});

test('tab tour: each tab opens alone, updates the address and shows its content', async ({ analysis, page, consoleErrors }) => {
  // SMCI with a price shows the most: critical flags, filing history, and every checklist status.
  await analysis.open('SMCI', 30);
  const content: Record<(typeof TABS)[number], () => Promise<void>> = {
    overview: async () => {
      await expect(analysis.tiles).toHaveCount(4);
      await expect(analysis.sparklines.first()).toBeVisible();
      await expect(analysis.growthTable).toBeVisible();
    },
    flags: async () => {
      await expect(analysis.criticalFlagTitles).toHaveCount(3); // matches the tab's badge
      await expect(analysis.flagsBadge).toHaveText('3');
      expect(await analysis.flagCards.count()).toBeGreaterThan(5);
    },
    history: async () => {
      await expect(analysis.historyTiles).toHaveCount(6);
      await expect(analysis.historyEvents).toHaveCount(10); // the first ten, newest first
    },
    value: async () => {
      await expect(analysis.valueTiles).toBeVisible();
      await expect(analysis.grahamScore).toContainText(/\d of \d/);
      await expect(analysis.buffettScore).toContainText(/\d of \d/);
    },
    charts: async () => {
      for (const id of ['cRevenue', 'cEps', 'cDps', 'cPayout', 'cBalance', 'cDebt', 'cCash', 'cMargin']) {
        const box = await analysis.chart(id).boundingBox();
        expect(box?.height, `${id} is drawn`).toBeGreaterThan(100);
      }
    },
    data: async () => {
      await expect(analysis.dataTableRegion).toBeVisible();
      await expect(analysis.dataTableRegion.getByRole('columnheader', { name: /^\d{4}$/ })).toHaveCount(10); // ten fiscal years
    },
  };
  for (const tab of TABS) {
    await analysis.openTab(tab);
    await expect(analysis.tab(tab)).toHaveAttribute('aria-selected', 'true');
    for (const other of TABS.filter((o) => o !== tab)) {
      await expect(analysis.panel(other), `${other} hidden while ${tab} is open`).toBeHidden();
      await expect(analysis.tab(other)).toHaveAttribute('aria-selected', 'false');
    }
    await expect(page).toHaveURL(tab === 'overview' ? /\?t=SMCI&p=30$/ : new RegExp(`\\?t=SMCI&p=30#${tab}$`));
    await content[tab](); // openTab's step already has the tab's screenshot
  }
  expect(consoleErrors).toEqual([]);
});

test('each tab has a short explanation', async ({ analysis }) => {
  await analysis.open('KO');
  for (const tab of TABS) {
    await analysis.openTab(tab);
    const note = analysis.sectionNote(tab);
    await expect(note).toBeVisible();
    const length = (await note.innerText()).length;
    expect(length > 30 && length < 260, `${tab}: ${length} characters`).toBe(true); // a sentence or two
  }
});

// ---------- at a glance + tabs ----------

test('glance summarises each area in one line', async ({ analysis }) => {
  await analysis.open('SMCI');
  await expect(analysis.glanceRows).toHaveCount(6);
  await expect(analysis.glanceTopics).toHaveText(['Revenue', 'Earnings', 'Dividend', 'Red flags', 'SEC record', 'Graham & Buffett']);
  await expect(analysis.glanceRow('Red flags')).toContainText('3 critical');
  await expect(analysis.glanceRow('Red flags')).toContainText('Restatement warning');
  await expect(analysis.glanceRow('SEC record')).toContainText('1 restatement warning · 3 auditor changes · 13 late filings · 14 other serious events');
  await expect(analysis.glanceRow('Dividend')).toContainText('No dividend paid');
});

test('glance rows open their tab', async ({ analysis, page }) => {
  await analysis.open('SMCI');
  await analysis.step('click the "SEC record" line', () => analysis.glanceRow('SEC record').click());
  await expect(analysis.tab('history')).toHaveAttribute('aria-selected', 'true');
  await expect(analysis.panel('history')).toBeVisible();
  await expect(analysis.panel('overview')).toBeHidden();
  await expect(page).toHaveURL(/#history$/);
});

test('clean company glance and badges', async ({ analysis }) => {
  await analysis.open('KO');
  await expect(analysis.glanceRow('SEC record')).toContainText('Clean since 2016');
  await expect(analysis.flagsBadge).toHaveText('');
  await expect(analysis.historyBadge).toHaveText('');
});

test('badges count serious problems', async ({ analysis }) => {
  await analysis.open('SMCI');
  await expect(analysis.flagsBadge).toHaveText('3');
  await expect(analysis.historyBadge).toHaveText('31');
});

test('link with a tab opens that tab', async ({ analysis }) => {
  await analysis.goto('/?t=SMCI#flags');
  await expect(analysis.panel('flags')).toBeVisible();
  await expect(analysis.tab('flags')).toHaveAttribute('aria-selected', 'true');
});

test('tabs work with the keyboard', async ({ analysis, page }) => {
  await analysis.open('KO');
  await analysis.tab('overview').focus();
  await page.keyboard.press('ArrowRight');
  await expect(analysis.tab('flags')).toBeFocused();
  await expect(analysis.panel('flags')).toBeVisible();
  await page.keyboard.press('End');
  await expect(analysis.panel('data')).toBeVisible();
  await page.keyboard.press('ArrowRight'); // wraps around
  await expect(analysis.panel('overview')).toBeVisible();
});

test('charts are drawn only when their tab opens', async ({ analysis, page }) => {
  await analysis.open('AAPL');
  const ids = ['cRevenue', 'cEps', 'cDps', 'cPayout', 'cBalance', 'cDebt', 'cCash', 'cMargin'];
  const drawn = () => page.evaluate((list) =>
    // @ts-expect-error Chart is the page's global Chart.js
    list.filter((id) => window.Chart.getChart(document.querySelector(`[data-testid="chart-${id}"]`))).length, ids);
  expect(await drawn()).toBe(0);
  await analysis.openTab('charts');
  expect(await drawn()).toBe(8);
});

test('new search stays on the current tab', async ({ analysis }) => {
  await analysis.open('KO');
  await analysis.openTab('flags');
  await analysis.search('INTC');
  await expect(analysis.companyName).toHaveText('INTEL CORP (INTC)');
  await expect(analysis.panel('flags')).toBeVisible();
  expect(anyContains(await analysis.flagTitles.allInnerTexts(), 'Recent net losses')).toBe(true);
});

test('page loads nothing from other sites', async ({ analysis, page }) => {
  // Everything (including Chart.js) is served by the app itself, so a slow third-party site can never block the page.
  const requests: string[] = [];
  page.on('request', (req) => requests.push(req.url()));
  await analysis.goto('/?t=AAPL#charts');
  await analysis.chart('cRevenue').waitFor();
  expect(requests.filter((u) => !u.startsWith(BASE_URL))).toEqual([]);
});

test('glance has a title and hint', async ({ analysis }) => {
  await analysis.open('KO');
  await expect(analysis.glanceTitle).toHaveText('At a glance');
  await expect(analysis.glanceHead).toContainText('Click any line for the details');
});

test('previous and next buttons walk through the tabs', async ({ analysis }) => {
  await analysis.open('KO');
  await expect(analysis.panelNavButtons('overview')).toHaveText(['Next: Red flags →']); // no "previous" on the first tab
  await analysis.step('click "Next: Red flags"', () => analysis.nextButton('overview').click());
  await expect(analysis.panel('flags')).toBeVisible();
  await expect(analysis.panelNavButtons('flags')).toHaveText(['← Overview', 'Next: SEC history →']);
  await analysis.step('click "← Overview"', () => analysis.previousButton('flags').click());
  await expect(analysis.panel('overview')).toBeVisible();
  await analysis.openTab('data');
  await expect(analysis.panelNavButtons('data')).toHaveText(['← Charts']); // no "next" on the last tab
});

test('guide card before a search shows an example on that tab', async ({ analysis, page }) => {
  await analysis.goto('/');
  await analysis.step('click the "Red flags" guide card', async () => {
    await analysis.guideCard('flags').click();
    await expect(analysis.companyName).toHaveText('Apple Inc. (AAPL)');
  });
  await expect(analysis.panel('flags')).toBeVisible();
  await expect(page).toHaveURL(/\?t=AAPL#flags$/);
  await expect(analysis.guideTitle).toHaveText('How to read these results');
});

test('guide card after a search opens its tab for that company', async ({ analysis }) => {
  await analysis.open('KO');
  await analysis.guideToggle.click();
  await analysis.step('click the "Graham & Buffett" guide card', () => analysis.guideCard('value').click());
  await expect(analysis.panel('value')).toBeVisible();
  await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)'); // stays on the searched company
});

test('tabs carry the same icons as the guide', async ({ analysis }) => {
  await analysis.open('KO');
  for (const tab of TABS) {
    await expect(analysis.tabIcon(tab)).toHaveAttribute('href', `#i-${tab}`);
    await expect(analysis.guideCardIcon(tab)).toHaveAttribute('href', `#i-${tab}`);
  }
});

// ---------- search box ----------

test('search box has a visible label and works by label', async ({ analysis }) => {
  await analysis.goto('/');
  await expect(analysis.searchBox).toBeFocused(); // ready to type on arrival
  await expect(analysis.searchBox).toHaveAttribute('placeholder', 'Enter a ticker, e.g. AAPL');
  await analysis.searchBox.fill('ko');
  await analysis.searchBox.press('Enter');
  await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
});

test('slash jumps to search but not while typing elsewhere', async ({ analysis, page }) => {
  await analysis.open('KO');
  await analysis.openTab('value');
  await analysis.price.fill('68');
  await analysis.price.press('/'); // typing in another field: no jump
  await expect(analysis.price).toBeFocused();
  await page.mouse.click(5, 5); // somewhere neutral on the page
  await page.keyboard.press('/');
  await expect(analysis.searchBox).toBeFocused();
  expect(await analysis.searchBox.evaluate((el: HTMLInputElement) => el.selectionEnd)).toBe(2); // text selected, ready to replace
});

// ---------- readability ----------

test('previous/next buttons sit at the bottom of every tab', async ({ analysis }) => {
  // Regression: on the Value and Charts tabs the buttons had ended up inside the price box / chart grid.
  await analysis.open('KO');
  for (const tab of TABS) {
    await analysis.openTab(tab); // a hidden panel isn't found by role, so open each one
    const last = await analysis.panel(tab).evaluate((panel) => panel.lastElementChild?.getAttribute('aria-label'));
    expect(last, tab).toBe('Move between sections');
  }
});

test('red flags are grouped with explanations', async ({ analysis }) => {
  await analysis.open('SMCI');
  await analysis.openTab('flags');
  await expect(analysis.flagGroupHeadings).toHaveCount(2);
  await expect(analysis.flagGroupHeadings.nth(0)).toContainText('Needs attention');
  await expect(analysis.flagGroupHeadings.nth(1)).toContainText('Going well');
  const first = analysis.flagCards.first();
  await expect(first).toContainText('Restatement warning');
  await expect(first.getByTestId('flag-help')).toContainText('Why it matters:');
});

test('trend tiles show a sparkline', async ({ analysis }) => {
  await analysis.open('AAPL');
  await expect(analysis.sparklines).toHaveCount(4);
});

test('jargon is explained', async ({ analysis }) => {
  await analysis.open('KO');
  await expect(analysis.jargon(/Compound annual growth rate/).first()).toHaveText('CAGR');
  await expect(analysis.glossary).toBeVisible();
  await analysis.step('open "Terms explained"', () => analysis.glossaryToggle.click());
  await expect(analysis.glossaryTerms).toContainText(['CAGR', 'Free cash flow', 'Graham Number']);
});

test('checklist scores have a bar', async ({ analysis }) => {
  await analysis.open('KO', 68);
  await analysis.openTab('value');
  await expect(analysis.grahamMeter).toHaveAccessibleName('4 of 8 criteria met');
  expect(await analysis.grahamMeterFill.evaluate((el: HTMLElement) => el.style.width)).toBe('50%'); // the bar's width is the score
});

test('value tab is named after Graham and Buffett', async ({ analysis }) => {
  await analysis.open('KO');
  await expect(analysis.tab('value')).toHaveText('Graham & Buffett');
  await analysis.openTab('charts');
  await expect(analysis.previousButton('charts')).toHaveText('← Graham & Buffett');
  await expect(analysis.valueNote).toContainText('Not affiliated with or endorsed by');
});

test('phone tab bar keeps the active tab in view', async ({ analysis, page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await analysis.goto('/?t=KO#value');
  await analysis.panel('value').waitFor();
  const bar = (await analysis.tabList.boundingBox())!;
  const tab = (await analysis.tab('value').boundingBox())!;
  expect(tab.x >= bar.x && tab.x + tab.width <= bar.x + bar.width + 1).toBe(true);
  await expect(analysis.tabList).toHaveClass(/more-(left|right)/); // fade hints at hidden tabs
});

test('price box links to public quote pages', async ({ analysis }) => {
  await analysis.open('KO');
  await analysis.openTab('value');
  await expect(analysis.priceLinks).toHaveText(['Google ↗', 'Yahoo Finance ↗']);
  await expect(analysis.priceLinks.nth(1)).toHaveAttribute('href', 'https://finance.yahoo.com/quote/KO/');
  await expect(analysis.priceLinks.nth(0)).toHaveAttribute('target', '_blank');
});

// ---------- Spanish ----------

test('Spanish link shows the whole page in Spanish', async ({ analysis }) => {
  await analysis.goto('/?t=SMCI&lang=es');
  await analysis.glanceRows.first().waitFor();
  await expect(analysis.root).toHaveAttribute('lang', 'es');
  await expect(analysis.searchLabel).toHaveText('Buscar una empresa');
  await expect(analysis.searchBox).toBeVisible();
  await expect(analysis.glanceTitle).toHaveText('De un vistazo');
  await expect(analysis.tab('flags')).toContainText('Señales de alerta');
  await expect(analysis.glanceRow('Historial SEC')).toContainText('13 presentaciones tardías');
  await expect(analysis.tiles.first()).toContainText('39,1 mil M US$'); // Spain's number format
  await expect(analysis.disclaimer).toContainText('No es asesoramiento de inversión');
  await analysis.openTab('flags');
  await expect(analysis.flagGroupHeadings.first()).toContainText('Requiere atención');
  await expect(analysis.flagCards.first()).toContainText('Por qué importa:');
});

test.describe('a Spanish browser', () => {
  test.use({ locale: 'es-ES' });

  test('gets Spanish automatically', async ({ analysis }) => {
    await analysis.goto('/');
    await expect(analysis.languageButton('es')).toHaveAttribute('aria-pressed', 'true');
    await expect(analysis.searchLabel).toHaveText('Buscar una empresa');
  });
});

test('English browser gets English', async ({ analysis }) => {
  await analysis.goto('/');
  await expect(analysis.languageButton('en')).toHaveAttribute('aria-pressed', 'true');
  await expect(analysis.searchLabel).toHaveText('Look up a company');
});

test('switching language keeps tab and price and updates the link', async ({ analysis, page, consoleErrors }) => {
  await analysis.open('KO', 68);
  await analysis.openTab('value');
  await analysis.step('switch to Spanish', async () => {
    await analysis.switchLanguage('es');
    await expect(analysis.tab('value')).toHaveText('Graham y Buffett');
  });
  await expect(analysis.panel('value')).toBeVisible();
  await expect(analysis.price).toHaveValue('68');
  await expect(analysis.checkRow('PER moderado')).toContainText('PER de 25,6');
  await expect(page).toHaveURL(/\?t=KO&p=68&lang=es#value$/);
  await analysis.step('switch back to English', async () => { // the English is exactly restored
    await analysis.switchLanguage('en');
    await expect(analysis.checkRow('Moderate P/E')).toContainText('P/E 25.6');
  });
  await expect(analysis.guideIntro).toContainText('The tabs, and what each one shows.');
  await expect(page).toHaveURL(/\?t=KO&p=68#value$/);
  expect(consoleErrors).toEqual([]);
});

test('language choice is remembered', async ({ analysis }) => {
  await analysis.goto('/');
  await analysis.switchLanguage('es');
  await analysis.goto('/'); // new visit, no ?lang in the link
  await expect(analysis.searchLabel).toHaveText('Buscar una empresa');
});

test('errors are translated', async ({ analysis }) => {
  await analysis.goto('/?t=ZZZZQ&lang=es');
  await expect(analysis.error).toContainText('No se encuentra el ticker «ZZZZQ»');
});

test('no English left in Spanish results', async ({ analysis }) => {
  await analysis.goto('/?t=INTC&lang=es&p=24');
  await analysis.glanceRows.first().waitFor();
  const english = /\b(the|and|with|Revenue|Earnings|Needs|Why it matters|years? of|Price is|Not met|Show all)\b/;
  const allowed = ['INTEL CORP', 'Semiconductors', '10-Year Stock Value Analysis', 'Yahoo Finance', 'Google'];
  const found: string[] = [];
  for (const tab of TABS) {
    await analysis.openTab(tab);
    for (const line of (await analysis.main.innerText()).split('\n')) {
      if (english.test(line) && !allowed.some((a) => line.includes(a))) found.push(`${tab}: ${line.trim().slice(0, 80)}`);
    }
  }
  expect(found).toEqual([]);
});

test('analytics script is not loaded locally', async ({ analysis, page }) => {
  // Vercel Web Analytics only exists on the deployed site; locally it must not load (or count visits).
  const requests: string[] = [];
  page.on('request', (req) => requests.push(req.url()));
  await analysis.goto('/?t=KO');
  await analysis.glanceRows.first().waitFor();
  expect(requests.filter((u) => u.includes('/_vercel/insights'))).toEqual([]);
  await expect(analysis.footer).toContainText('no cookies, no personal data');
});

test('company header says when the data was fetched', async ({ analysis }) => {
  await analysis.open('KO');
  await expect(analysis.dataAsOf).toContainText('Data from SEC as of');
  await expect(analysis.staleNote).toBeHidden();
  await analysis.switchLanguage('es');
  await expect(analysis.dataAsOf).toContainText('Datos de la SEC a');
});

test('saved-copy notice when SEC is unreachable', async ({ analysis, page }) => {
  const metrics = ['revenue', 'netIncome', 'operatingIncome', 'grossProfit', 'eps', 'dps', 'dividendsPaid',
    'operatingCashFlow', 'capex', 'interestExpense', 'dilutedShares', 'totalAssets', 'totalLiabilities', 'equity',
    'liabilitiesAndEquity', 'currentAssets', 'currentLiabilities', 'cash', 'goodwill', 'receivables', 'inventory',
    'totalDebt', 'longTermDebt'];
  const stale = {
    ticker: 'KO', name: 'COCA COLA CO', cik: 21344, currency: 'USD', years: [2024, 2025],
    periodEnds: ['2024-12-31', '2025-12-31'], splits: [], secHistory: null, sharesOutstanding: null,
    secUrl: 'https://www.sec.gov/x', dataAsOf: '2026-09-20T10:00:00+00:00', stale: true,
    series: Object.fromEntries(metrics.map((k) => [k, [1e9, 1.1e9]])),
  };
  await page.route('**/api/financials*', (route) => route.fulfill({ status: 200, json: stale }));
  await analysis.goto('/?t=KO');
  await expect(analysis.staleNote).toBeVisible();
  await expect(analysis.staleNote).toContainText("SEC couldn't be reached");
});

test('guide toggle looks and reads like a control', async ({ analysis, page }) => {
  await analysis.open('KO'); // guide is collapsed after a search
  await expect(analysis.guideShowText).toBeVisible();
  await expect(analysis.guideShowText).toHaveText('Show guide');
  expect(await analysis.guideToggle.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
  await analysis.guideToggle.focus();
  await page.keyboard.press('Enter'); // opens with the keyboard
  await expect(analysis.guide).toHaveAttribute('open', '');
  await expect(analysis.guideHideText).toHaveText('Hide');
  await analysis.switchLanguage('es');
  await expect(analysis.guideHideText).toHaveText('Ocultar');
});

test('Home button returns to a fresh landing page', async ({ analysis, page, consoleErrors }) => {
  await analysis.open('SMCI', 30);
  await analysis.openTab('flags');
  await analysis.step('press Home', async () => {
    await analysis.homeButton.click();
    await expect(page).toHaveURL(url('/'));
  });
  await expect(analysis.result).toBeHidden();
  await expect(analysis.searchBox).toHaveValue('');
  await expect(analysis.price).toHaveValue('');
  await expect(page).toHaveTitle('10-Year Stock Value Analysis');
  await expect(analysis.homeButton).toBeHidden(); // nothing to go back from on the start page
  // and a new search works normally from there
  await analysis.search('KO');
  await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
  expect(consoleErrors).toEqual([]);
});

test('Home keeps the language', async ({ analysis, page }) => {
  await analysis.goto('/?t=KO&lang=es');
  await analysis.result.waitFor({ state: 'visible' });
  await expect(analysis.homeButton).toHaveText('Inicio');
  await analysis.step('press Inicio (Home)', () => analysis.homeButton.click());
  await expect(page).toHaveURL(url('/?lang=es'));
  await expect(analysis.result).toBeHidden();
  await expect(analysis.analyzeButton).toHaveText('Analizar');
});

test('Home button appears only after a lookup', async ({ analysis }) => {
  await analysis.goto('/');
  await expect(analysis.homeButton).toBeHidden();
  await analysis.search('ZZZZQ');
  await expect(analysis.error).toBeVisible();
  await expect(analysis.homeButton).toBeVisible(); // an error also counts: Home clears it
});

test('Analyze needs a ticker: it stays disabled while the search box is empty', async ({ analysis, page }) => {
  // Regression: an empty box could be submitted (the button did nothing).
  await analysis.goto('/');
  await analysis.step('type a ticker', () => analysis.searchBox.fill('K'));
  await expect(analysis.analyzeButton).toBeEnabled(); // the page's script is running
  await analysis.step('clear the box', () => analysis.searchBox.fill(''));
  await expect(analysis.analyzeButton).toBeDisabled();
  await analysis.step('type only spaces', () => analysis.searchBox.fill('   '));
  await expect(analysis.analyzeButton).toBeDisabled();
  await analysis.step('press Enter in the empty box', () => analysis.searchBox.press('Enter'));
  await expect(analysis.error).toBeHidden();
  await expect(analysis.result).toBeHidden();
  await expect(page).toHaveURL(/\/$/); // nothing was looked up
});

test('Analyze is ready right away when the page opens with a ticker, and after a lookup', async ({ analysis }) => {
  await analysis.open('KO');
  await expect(analysis.searchBox).toHaveValue('KO');
  await expect(analysis.analyzeButton).toBeEnabled();
});

test('search button waits for the script', async ({ analysis, page }) => {
  await slowScript(page, 'js/app.js');
  await analysis.goto('/');
  await expect(analysis.analyzeButton).toBeDisabled();
  await analysis.search('KO'); // the click waits until the script has enabled the button
  await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
});
