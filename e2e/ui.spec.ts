// The results page, driven in Chromium against offline SEC fixtures (ported from tests/e2e/test_ui.py).
import { anyContains, checkRow, expect, flagTitles, openTab, slowScript, step, TABS, test } from './fixtures';
import { BASE_URL, url } from './env';

test('search shows company trends and charts', async ({ page, consoleErrors }) => {
  await step(page, 'open the start page', () => page.goto('/'));
  await step(page, 'search for aapl', async () => {
    await page.fill('#ticker', 'aapl');
    await page.click('#go');
    await expect(page.locator('#coName')).toHaveText('Apple Inc. (AAPL)');
  });
  await expect(page.locator('#coMeta')).toContainText('Electronic Computers');
  await expect(page.locator('#tiles .tile').first()).toContainText('$416.2B');
  await expect(page.locator('#tiles')).toContainText('Growing');
  await expect(page).toHaveURL(/\?t=AAPL$/);
  await openTab(page, 'charts');
  await expect(page).toHaveURL(/\?t=AAPL#charts$/);
  // all eight charts are drawn
  for (const id of ['cRevenue', 'cEps', 'cDps', 'cPayout', 'cBalance', 'cDebt', 'cCash', 'cMargin']) {
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box?.height, id).toBeGreaterThan(100);
  }
  expect(consoleErrors).toEqual([]);
});

test('chips load a company', async ({ page }) => {
  await page.goto('/');
  await page.click('.chip[data-t=KO]');
  await expect(page.locator('#coName')).toHaveText('COCA COLA CO (KO)');
});

test('growth table compares first and latest year', async ({ openTicker }) => {
  const page = await openTicker('AAPL');
  const revenue = page.locator('#growthTable tr', { hasText: 'Revenue' });
  await expect(revenue).toContainText('$215.6B');
  await expect(revenue).toContainText('$416.2B');
  await expect(revenue).toContainText('93.0%');
  await expect(revenue).toContainText('7.6%');
});

test('loss-making company is described in words', async ({ openTicker }) => {
  const page = await openTicker('INTC');
  await expect(page.locator('#growthTable tr', { hasText: 'Net income' })).toContainText('From profit to loss');
  await expect(page.locator('#growthTable tr', { hasText: 'Dividend / share' })).toContainText('Fell to zero');
  const titles = await flagTitles(page);
  expect(anyContains(titles, 'Recent net losses')).toBe(true);
  expect(anyContains(titles, 'Dividend cut, then suspended')).toBe(true);
});

test('restatements and late filings are flagged', async ({ openTicker }) => {
  const page = await openTicker('SMCI');
  const critical = await page.locator('.flag.critical .title').allInnerTexts();
  expect(anyContains(critical, 'Financial statements were restated')).toBe(true);
  expect(anyContains(critical, 'Late SEC filings')).toBe(true);
  const tiles = page.locator('#historyTiles .tile');
  await expect(tiles.filter({ hasText: 'Late filings' })).toContainText('13');
  await expect(tiles.filter({ hasText: 'Restatement warnings' })).toContainText('Serious');
});

test('filing history filters and expands', async ({ openTicker }) => {
  const page = await openTicker('SMCI');
  await openTab(page, 'history');
  const events = page.locator('#historyList .event');
  await expect(events).toHaveCount(10); // first ten shown
  await step(page, 'show all 17 filings', async () => {
    await page.click('#historyMore');
    await expect(events).toHaveCount(17);
  });
  await step(page, 'filter: SEC letters (none)', async () => {
    await page.click('#historyFilters button[data-f=letters]');
    await expect(page.locator('#historyList')).toContainText('No filings of this kind');
  });
  await step(page, 'filter: red-flag filings', () => page.click('#historyFilters button[data-f=flags]'));
  await expect(page.locator('#historyFilters button[data-f=flags]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#historyList .event a').first()).toHaveAttribute(
    'href', /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1375365\//);
});

test('clean filer gets a strength', async ({ openTicker }) => {
  const page = await openTicker('KO');
  expect(anyContains(await flagTitles(page), 'Clean filing record')).toBe(true);
});

test('price runs valuation tests and is kept in the URL', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await expect(checkRow(page, 'Moderate P/E')).toContainText('Needs price');
  await openTab(page, 'value');
  await step(page, 'enter a share price of 68', async () => {
    await page.fill('#price', '68');
    await expect(checkRow(page, 'Moderate P/E')).toContainText('Not met');
  });
  await expect(checkRow(page, 'Moderate P/E')).toContainText('P/E 25.6');
  await expect(checkRow(page, 'Margin of safety')).toContainText('Not met');
  await expect(page.locator('#valueTiles')).toContainText('Price is');
  await expect(page).toHaveURL(/\?t=KO&p=68#value$/);
});

test('price from link is applied on load', async ({ openTicker }) => {
  const page = await openTicker('KO', 68);
  await expect(page.locator('#price')).toHaveValue('68');
  await expect(checkRow(page, 'Moderate P/E')).toContainText('P/E 25.6');
});

test('new search clears the previous price', async ({ openTicker }) => {
  const page = await openTicker('KO', 68);
  await step(page, 'search for AAPL', async () => {
    await page.fill('#ticker', 'AAPL');
    await page.click('#go');
    await expect(page.locator('#coName')).toHaveText('Apple Inc. (AAPL)');
  });
  await expect(page.locator('#price')).toHaveValue('');
});

test('checklist scores add up', async ({ openTicker }) => {
  const page = await openTicker('KO', 68);
  await expect(page.locator('#grahamScore')).toContainText('Meets 4 of 8');
  await expect(page.locator('#buffettScore')).toContainText('Meets 6 of 7');
});

test('bank-specific rules are skipped', async ({ openTicker }) => {
  const page = await openTicker('JPM');
  expect(anyContains(await flagTitles(page), 'Looks like a bank')).toBe(true);
  await expect(checkRow(page, 'Strong current position')).toContainText('N/A');
  await expect(checkRow(page, 'Low capital needs')).toContainText('N/A');
});

test('unknown ticker shows a friendly error', async ({ page }) => {
  await page.goto('/?t=ZZZZQ');
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error')).toContainText('not found in SEC EDGAR');
  await expect(page.locator('#result')).toBeHidden();
});

test('invalid input is rejected', async ({ page }) => {
  await page.goto('/');
  await page.fill('#ticker', '<b>x');
  await page.click('#go');
  await expect(page.locator('#error')).toContainText("doesn't look like a ticker");
  await expect(page.locator('#error b')).toHaveCount(0); // shown as text, never as HTML
});

test('disclaimer is always visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.disclaimer')).toContainText('Not investment advice');
});

test('phone layout has no horizontal scroll', async ({ page, openTicker }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openTicker('AAPL');
  const [scroll, client] = await page.evaluate(() => [
    document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
});

test('"Show all" keeps the price and raises no errors', async ({ openTicker, consoleErrors }) => {
  // Regression: the "Show all" button shares the .chip style with the ticker buttons and used to
  // be wired as one, which cleared the price and threw a JavaScript error.
  const page = await openTicker('SMCI', 30);
  await openTab(page, 'history');
  await page.click('#historyMore');
  await expect(page.locator('#historyList .event')).toHaveCount(17);
  await expect(page.locator('#price')).toHaveValue('30');
  expect(consoleErrors).toEqual([]);
});

test('guide explains the results before a search', async ({ page }) => {
  await page.goto('/');
  const guide = page.locator('#guide');
  await expect(guide).toHaveAttribute('open', '');
  // the guide's cards are named after the tabs, so the guide maps directly onto the results
  await expect(guide.locator('.guide-item .gi-title')).toHaveText(
    ['Overview', 'Red flags', 'SEC history', 'Graham & Buffett-style analysis', 'Charts', 'Data']);
  await expect(guide.locator('.how li')).toHaveCount(3); // the three-step "how it works" strip
  await expect(guide.locator('.guide-item .gi-go').first()).toBeVisible();
});

test('guide collapses after a search and can be reopened', async ({ openTicker }) => {
  const page = await openTicker('KO');
  const guide = page.locator('#guide');
  await expect(guide).not.toHaveAttribute('open', '');
  await expect(guide.locator('.guide-grid')).toBeHidden();
  await page.click('#guide summary');
  await expect(guide.locator('.guide-grid')).toBeVisible();
});

test('each tab has a short explanation', async ({ openTicker }) => {
  const page = await openTicker('KO');
  for (const tab of TABS) {
    await openTab(page, tab);
    const note = page.locator(`#panel-${tab} .section-note`).first();
    await expect(note).toBeVisible();
    const length = (await note.innerText()).length;
    expect(length > 30 && length < 260, `${tab}: ${length} characters`).toBe(true); // a sentence or two
  }
});

// ---------- at a glance + tabs ----------

test('glance summarises each area in one line', async ({ openTicker }) => {
  const page = await openTicker('SMCI');
  const rows = page.locator('#glance .glance-row');
  await expect(rows).toHaveCount(6);
  await expect(rows.locator('.what')).toHaveText(['Revenue', 'Earnings', 'Dividend', 'Red flags', 'SEC record', 'Graham & Buffett']);
  await expect(rows.filter({ hasText: 'Red flags' })).toContainText('2 critical');
  await expect(rows.filter({ hasText: 'Red flags' })).toContainText('Financial statements were restated');
  await expect(rows.filter({ hasText: 'SEC record' })).toContainText('1 restatement · 3 auditor changes · 13 late filings');
  await expect(rows.filter({ hasText: 'Dividend' })).toContainText('No dividend paid');
});

test('glance rows open their tab', async ({ openTicker }) => {
  const page = await openTicker('SMCI');
  await step(page, 'click the "SEC record" line', () => page.locator('#glance .glance-row', { hasText: 'SEC record' }).click());
  await expect(page.locator('#tab-history')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-history')).toBeVisible();
  await expect(page.locator('#panel-overview')).toBeHidden();
  await expect(page).toHaveURL(/#history$/);
});

test('clean company glance and badges', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await expect(page.locator('#glance .glance-row', { hasText: 'SEC record' })).toContainText('Clean since 2016');
  await expect(page.locator('#flagsBadge')).toHaveText('');
  await expect(page.locator('#historyBadge')).toHaveText('');
});

test('badges count serious problems', async ({ openTicker }) => {
  const page = await openTicker('SMCI');
  await expect(page.locator('#flagsBadge')).toHaveText('2');
  await expect(page.locator('#historyBadge')).toHaveText('17');
});

test('link with a tab opens that tab', async ({ page }) => {
  await page.goto('/?t=SMCI#flags');
  await expect(page.locator('#panel-flags')).toBeVisible();
  await expect(page.locator('#tab-flags')).toHaveAttribute('aria-selected', 'true');
});

test('tabs work with the keyboard', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await page.focus('#tab-overview');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-flags')).toBeFocused();
  await expect(page.locator('#panel-flags')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('#panel-data')).toBeVisible();
  await page.keyboard.press('ArrowRight'); // wraps around
  await expect(page.locator('#panel-overview')).toBeVisible();
});

test('charts are drawn only when their tab opens', async ({ openTicker }) => {
  const page = await openTicker('AAPL');
  const drawn = () => page.evaluate(() =>
    [...document.querySelectorAll('#panel-charts canvas')]
      // @ts-expect-error Chart is the page's global Chart.js
      .filter((c) => window.Chart.getChart(c)).length);
  expect(await drawn()).toBe(0);
  await openTab(page, 'charts');
  expect(await drawn()).toBe(8);
});

test('new search stays on the current tab', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await openTab(page, 'flags');
  await step(page, 'search for INTC', async () => {
    await page.fill('#ticker', 'INTC');
    await page.click('#go');
    await expect(page.locator('#coName')).toHaveText('INTEL CORP (INTC)');
  });
  await expect(page.locator('#panel-flags')).toBeVisible();
  expect(anyContains(await flagTitles(page), 'Recent net losses')).toBe(true);
});

test('page loads nothing from other sites', async ({ page }) => {
  // Everything (including Chart.js) is served by the app itself, so a slow third-party site can never block the page.
  const requests: string[] = [];
  page.on('request', (req) => requests.push(req.url()));
  await page.goto('/?t=AAPL#charts');
  await page.locator('#panel-charts canvas').first().waitFor();
  expect(requests.filter((u) => !u.startsWith(BASE_URL))).toEqual([]);
});

test('glance has a title and hint', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await expect(page.locator('#glanceTitle')).toHaveText('At a glance');
  await expect(page.locator('.glance-head')).toContainText('Click any line for the details');
});

test('previous and next buttons walk through the tabs', async ({ openTicker }) => {
  const page = await openTicker('KO');
  const nav = page.locator('#panel-overview .panel-nav');
  await expect(nav.locator('button')).toHaveText(['Next: Red flags →']); // no "previous" on the first tab
  await step(page, 'click "Next: Red flags"', () => nav.locator('button.next').click());
  await expect(page.locator('#panel-flags')).toBeVisible();
  await expect(page.locator('#panel-flags .panel-nav button')).toHaveText(['← Overview', 'Next: SEC history →']);
  await step(page, 'click "← Overview"', () => page.locator('#panel-flags .panel-nav button.prev').click());
  await expect(page.locator('#panel-overview')).toBeVisible();
  await openTab(page, 'data');
  await expect(page.locator('#panel-data .panel-nav button')).toHaveText(['← Charts']); // no "next" on the last tab
});

test('guide card before a search shows an example on that tab', async ({ page }) => {
  await step(page, 'open the start page', () => page.goto('/'));
  await step(page, 'click the "Red flags" guide card', async () => {
    await page.locator('.guide-item', { hasText: 'Red flags' }).click();
    await expect(page.locator('#coName')).toHaveText('Apple Inc. (AAPL)');
  });
  await expect(page.locator('#panel-flags')).toBeVisible();
  await expect(page).toHaveURL(/\?t=AAPL#flags$/);
  await expect(page.locator('.guide-title')).toHaveText('How to read these results');
});

test('guide card after a search opens its tab for that company', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await page.click('#guide summary');
  await page.locator('.guide-item[data-tab="value"]').click();
  await expect(page.locator('#panel-value')).toBeVisible();
  await expect(page.locator('#coName')).toHaveText('COCA COLA CO (KO)'); // stays on the searched company
});

test('tabs carry the same icons as the guide', async ({ openTicker }) => {
  const page = await openTicker('KO');
  for (const tab of TABS) {
    await expect(page.locator(`#tab-${tab} use`)).toHaveAttribute('href', `#i-${tab}`);
    await expect(page.locator(`.guide-item[data-tab="${tab}"] use`)).toHaveAttribute('href', `#i-${tab}`);
  }
});

// ---------- search box ----------

test('search box has a visible label and works by label', async ({ page }) => {
  await page.goto('/');
  const box = page.getByLabel('Look up a company');
  await expect(box).toBeFocused(); // ready to type on arrival
  await expect(box).toHaveAttribute('placeholder', 'Enter a ticker, e.g. AAPL');
  await box.fill('ko');
  await box.press('Enter');
  await expect(page.locator('#coName')).toHaveText('COCA COLA CO (KO)');
});

test('slash jumps to search but not while typing elsewhere', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await openTab(page, 'value');
  await page.fill('#price', '68');
  await page.locator('#price').press('/'); // typing in another field: no jump
  await expect(page.locator('#price')).toBeFocused();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('/');
  await expect(page.locator('#ticker')).toBeFocused();
  // existing text selected, ready to replace
  expect(await page.evaluate(() => (document.getElementById('ticker') as HTMLInputElement).selectionEnd)).toBe(2);
});

// ---------- readability ----------

test('previous/next buttons sit at the bottom of every tab', async ({ openTicker }) => {
  // Regression: on the Value and Charts tabs the buttons had ended up inside the price box / chart grid.
  const page = await openTicker('KO');
  for (const tab of TABS) {
    const isLast = await page.evaluate(
      (t) => document.getElementById(`panel-${t}`)!.lastElementChild!.classList.contains('panel-nav'), tab);
    expect(isLast, tab).toBe(true);
  }
});

test('red flags are grouped with explanations', async ({ openTicker }) => {
  const page = await openTicker('SMCI');
  await openTab(page, 'flags');
  const groups = page.locator('#flags .flag-group h3');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toContainText('Needs attention');
  await expect(groups.nth(1)).toContainText('Going well');
  const first = page.locator('#flags .flag').first();
  await expect(first).toContainText('Financial statements were restated');
  await expect(first.locator('.help')).toContainText('Why it matters:');
});

test('trend tiles show a sparkline', async ({ openTicker }) => {
  const page = await openTicker('AAPL');
  await expect(page.locator('#tiles .tile svg.spark')).toHaveCount(4);
});

test('jargon is explained', async ({ openTicker }) => {
  const page = await openTicker('KO');
  const cagr = page.locator('#panel-overview abbr', { hasText: 'CAGR' }).first();
  await expect(cagr).toHaveAttribute('title', /Compound annual growth rate/);
  const glossary = page.locator('#glossary');
  await expect(glossary).toBeVisible();
  await glossary.locator('summary').click();
  await expect(glossary.locator('dt')).toContainText(['CAGR', 'Free cash flow', 'Graham Number']);
});

test('checklist scores have a bar', async ({ openTicker }) => {
  const page = await openTicker('KO', 68);
  await expect(page.locator('#grahamScore .meter')).toHaveAttribute('aria-label', '4 of 8 criteria met');
  expect(await page.evaluate(() => (document.querySelector('#grahamScore .meter span') as HTMLElement).style.width)).toBe('50%');
});

test('value tab is named after Graham and Buffett', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await expect(page.locator('#tab-value')).toHaveText('Graham & Buffett');
  await expect(page.locator('#panel-charts .panel-nav button.prev')).toHaveText('← Graham & Buffett');
  await expect(page.locator('#valueNote')).toContainText('Not affiliated with or endorsed by');
});

test('phone tab bar keeps the active tab in view', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?t=KO#value');
  await page.locator('#panel-value').waitFor();
  const bar = (await page.locator('#tabs').boundingBox())!;
  const tab = (await page.locator('#tab-value').boundingBox())!;
  expect(tab.x >= bar.x && tab.x + tab.width <= bar.x + bar.width + 1).toBe(true);
  await expect(page.locator('#tabs')).toHaveClass(/more-(left|right)/); // fade hints at hidden tabs
});

test('price box links to public quote pages', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await openTab(page, 'value');
  const links = page.locator('#priceLinks a');
  await expect(links).toHaveText(['Google ↗', 'Yahoo Finance ↗']);
  await expect(links.nth(1)).toHaveAttribute('href', 'https://finance.yahoo.com/quote/KO/');
  await expect(links.nth(0)).toHaveAttribute('target', '_blank');
});

// ---------- Spanish ----------

test('Spanish link shows the whole page in Spanish', async ({ page }) => {
  await page.goto('/?t=SMCI&lang=es');
  await page.locator('#glance .glance-row').first().waitFor();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByLabel('Buscar una empresa')).toBeVisible();
  await expect(page.locator('#glanceTitle')).toHaveText('De un vistazo');
  await expect(page.locator('#tab-flags')).toContainText('Señales de alerta');
  await expect(page.locator('#glance .glance-row', { hasText: 'Historial SEC' })).toContainText('13 presentaciones tardías');
  await expect(page.locator('#tiles .tile').first()).toContainText('39,1 mil M US$'); // Spain's number format
  await expect(page.locator('.disclaimer')).toContainText('No es asesoramiento de inversión');
  await openTab(page, 'flags');
  await expect(page.locator('#flags .flag-group h3').first()).toContainText('Requiere atención');
  await expect(page.locator('#flags .flag').first()).toContainText('Por qué importa:');
});

test.describe('a Spanish browser', () => {
  test.use({ locale: 'es-ES' });

  test('gets Spanish automatically', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lang-switch [data-lang=es]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.search-label label')).toHaveText('Buscar una empresa');
  });
});

test('English browser gets English', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.lang-switch [data-lang=en]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.search-label label')).toHaveText('Look up a company');
});

test('switching language keeps tab and price and updates the link', async ({ openTicker, consoleErrors }) => {
  const page = await openTicker('KO', 68);
  await openTab(page, 'value');
  await step(page, 'switch to Spanish', async () => {
    await page.click('.lang-switch [data-lang=es]');
    await expect(page.locator('#tab-value')).toHaveText('Graham y Buffett');
  });
  await expect(page.locator('#panel-value')).toBeVisible();
  await expect(page.locator('#price')).toHaveValue('68');
  await expect(checkRow(page, 'PER moderado')).toContainText('PER de 25,6');
  await expect(page).toHaveURL(/\?t=KO&p=68&lang=es#value$/);
  await step(page, 'switch back to English', async () => { // the English is exactly restored
    await page.click('.lang-switch [data-lang=en]');
    await expect(checkRow(page, 'Moderate P/E')).toContainText('P/E 25.6');
  });
  await expect(page.locator('.guide-intro')).toContainText('The tabs, and what each one shows.');
  await expect(page).toHaveURL(/\?t=KO&p=68#value$/);
  expect(consoleErrors).toEqual([]);
});

test('language choice is remembered', async ({ page }) => {
  await page.goto('/');
  await page.click('.lang-switch [data-lang=es]');
  await page.goto('/'); // new visit, no ?lang in the link
  await expect(page.locator('.search-label label')).toHaveText('Buscar una empresa');
});

test('errors are translated', async ({ page }) => {
  await page.goto('/?t=ZZZZQ&lang=es');
  await expect(page.locator('#error')).toContainText('No se encuentra el ticker «ZZZZQ»');
});

test('no English left in Spanish results', async ({ page }) => {
  await page.goto('/?t=INTC&lang=es&p=24');
  await page.locator('#glance .glance-row').first().waitFor();
  const english = /\b(the|and|with|Revenue|Earnings|Needs|Why it matters|years? of|Price is|Not met|Show all)\b/;
  const allowed = ['INTEL CORP', 'Semiconductors', '10-Year Stock Value Analysis', 'Yahoo Finance', 'Google'];
  const found: string[] = [];
  for (const tab of TABS) {
    await openTab(page, tab);
    for (const line of (await page.innerText('main')).split('\n')) {
      if (english.test(line) && !allowed.some((a) => line.includes(a))) found.push(`${tab}: ${line.trim().slice(0, 80)}`);
    }
  }
  expect(found).toEqual([]);
});

test('analytics script is not loaded locally', async ({ page }) => {
  // Vercel Web Analytics only exists on the deployed site; locally it must not load (or count visits).
  const requests: string[] = [];
  page.on('request', (req) => requests.push(req.url()));
  await page.goto('/?t=KO');
  await page.locator('#glance .glance-row').first().waitFor();
  expect(requests.filter((u) => u.includes('/_vercel/insights'))).toEqual([]);
  await expect(page.locator('footer')).toContainText('no cookies, no personal data');
});

test('company header says when the data was fetched', async ({ openTicker }) => {
  const page = await openTicker('KO');
  await expect(page.locator('#coAsOf')).toContainText('Data from SEC as of');
  await expect(page.locator('#staleNote')).toBeHidden();
  await page.click('.lang-switch [data-lang=es]');
  await expect(page.locator('#coAsOf')).toContainText('Datos de la SEC a');
});

test('saved-copy notice when SEC is unreachable', async ({ page }) => {
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
  await page.goto('/?t=KO');
  await expect(page.locator('#staleNote')).toBeVisible();
  await expect(page.locator('#staleNote')).toContainText("SEC couldn't be reached");
});

test('guide toggle looks and reads like a control', async ({ openTicker }) => {
  const page = await openTicker('KO'); // guide is collapsed after a search
  const summary = page.locator('#guide summary');
  await expect(summary.locator('.when-closed')).toBeVisible();
  await expect(summary.locator('.when-closed')).toHaveText('Show guide');
  expect(await summary.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
  await summary.focus();
  await page.keyboard.press('Enter'); // opens with the keyboard
  await expect(page.locator('#guide')).toHaveAttribute('open', '');
  await expect(summary.locator('.when-open')).toHaveText('Hide');
  await page.click('.lang-switch [data-lang=es]');
  await expect(summary.locator('.when-open')).toHaveText('Ocultar');
});

test('Home button returns to a fresh landing page', async ({ openTicker, consoleErrors }) => {
  const page = await openTicker('SMCI', 30);
  await openTab(page, 'flags');
  await step(page, 'press Home', async () => {
    await page.click('.home-btn');
    await expect(page).toHaveURL(url('/'));
  });
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#ticker')).toHaveValue('');
  await expect(page.locator('#price')).toHaveValue('');
  await expect(page).toHaveTitle('10-Year Stock Value Analysis');
  await expect(page.locator('.home-btn')).toBeHidden(); // nothing to go back from on the start page
  // and a new search works normally from there
  await step(page, 'search for KO from the fresh page', async () => {
    await page.fill('#ticker', 'KO');
    await page.click('#go');
    await expect(page.locator('#coName')).toHaveText('COCA COLA CO (KO)');
  });
  expect(consoleErrors).toEqual([]);
});

test('Home keeps the language', async ({ page }) => {
  await page.goto('/?t=KO&lang=es');
  await page.locator('#result').waitFor({ state: 'visible' });
  const home = page.locator('.home-btn');
  await expect(home).toHaveText('Inicio');
  await home.click();
  await expect(page).toHaveURL(url('/?lang=es'));
  await expect(page.locator('#result')).toBeHidden();
  await expect(page.locator('#go')).toHaveText('Analizar');
});

test('Home button appears only after a lookup', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.home-btn')).toBeHidden();
  await page.fill('#ticker', 'ZZZZQ');
  await page.click('#go');
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('.home-btn')).toBeVisible(); // an error also counts: Home clears it
});

test('search button waits for the script', async ({ page }) => {
  await slowScript(page, 'js/app.js');
  await page.goto('/');
  await expect(page.locator('#go')).toBeDisabled();
  await page.fill('#ticker', 'KO');
  await page.click('#go');
  await expect(page.locator('#coName')).toHaveText('COCA COLA CO (KO)');
});
