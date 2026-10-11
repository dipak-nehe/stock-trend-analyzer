// The results page, driven in Chromium against offline SEC fixtures. Elements come from the AnalysisPage object.
import type { Locator } from '@playwright/test';
import { anyContains, expect, slowScript, TABS, test } from './fixtures';
import { BASE_URL, url } from './env';

const DISCLAIMER_SECTIONS_EN = ['Not advice', 'Risk of loss', 'Your responsibility', 'No guarantee', 'Limitation of liability'];

test.describe('search', () => {
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

  test('search box has a visible label and works by label', async ({ analysis }) => {
    await analysis.goto('/');
    await expect(analysis.searchBox).toBeFocused(); // ready to type on arrival
    await expect(analysis.searchBox).toHaveAttribute('placeholder', 'Apple or AAPL');
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

  test('Analyze with an empty box shows a hint instead of looking anything up', async ({ analysis, page }) => {
    // Regression: an empty box could be submitted (the button did nothing). The button now looks ready and explains.
    await analysis.goto('/');
    await expect(analysis.analyzeButton).toBeEnabled(); // the page's script is running
    await expect(analysis.searchHint).toBeHidden();
    await analysis.step('click Analyze with an empty box', () => analysis.analyzeButton.click());
    await expect(analysis.searchHint).toBeVisible();
    await expect(analysis.searchHint).toHaveText('Type a ticker first, e.g. AAPL, or pick one below.');
    await expect(analysis.searchBox).toBeFocused();
    await analysis.step('press Enter with only spaces', async () => {
      await analysis.searchBox.fill('   ');
      await analysis.searchBox.press('Enter');
    });
    await expect(analysis.searchHint).toBeVisible();
    await expect(analysis.error).toBeHidden();
    await expect(analysis.result).toBeHidden();
    await expect(page).toHaveURL(/\/$/); // nothing was looked up
    await analysis.step('type a ticker', () => analysis.searchBox.fill('K'));
    await expect(analysis.searchHint).toBeHidden();
  });

  test('the empty-box hint is in Spanish too', async ({ analysis }) => {
    await analysis.goto('/?lang=es');
    await analysis.step('click Analyze with an empty box', () => analysis.analyzeButton.click());
    await expect(analysis.searchHint).toHaveText('Escribe primero un ticker, p. ej. AAPL, o elige uno de abajo.');
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
});

test.describe('start-page quote of the day', () => {
  // Pin the browser's clock: the quote depends on the day of the year (js/quotes.js)
  test('a quote and its author show on the start page, chosen by the day', async ({ analysis, page }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
    await analysis.goto('/');
    await expect(analysis.quotes).toBeVisible();
    await expect(analysis.quotes).toContainText('Quote of the day');
    await expect(analysis.dailyQuote).toHaveText('“It’s far better to buy a wonderful company at a fair price than a fair company at a wonderful price.”');
    await expect(analysis.quoteAuthor).toHaveText('Warren Buffett');
    await expect(analysis.quotes.getByRole('link')).toHaveCount(0); // just the quote and its author
  });

  test('another day brings another quote, from another investor', async ({ analysis, page }) => {
    await page.clock.setFixedTime(new Date('2026-10-11T12:00:00'));
    await analysis.goto('/');
    await expect(analysis.dailyQuote).toHaveText('“When somebody says, ‘Any idiot could run this joint,’ that’s a plus as far as I’m concerned, because sooner or later any idiot probably is going to be running it.”');
    await expect(analysis.quoteAuthor).toHaveText('Peter Lynch');   // just the name: no book or source
  });

  test('the quote is translated into Spanish, and follows a language switch', async ({ analysis, page }) => {
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00'));
    await analysis.goto('/?lang=es');
    await expect(analysis.quotes).toContainText('Cita del día');
    await expect(analysis.dailyQuote).toHaveText('«Es mucho mejor comprar una empresa maravillosa a un precio justo que una empresa corriente a un precio maravilloso.»');
    await analysis.step('switch to English', () => analysis.switchLanguage('en'));
    await expect(analysis.dailyQuote).toHaveText('“It’s far better to buy a wonderful company at a fair price than a fair company at a wonderful price.”');
  });

  test('the quote makes way once a company is shown', async ({ analysis }) => {
    await analysis.goto('/?t=KO');
    await analysis.glanceRows.first().waitFor();
    await expect(analysis.quotes).toBeHidden();
  });
});

test.describe('smart search', () => {
  test('a company name suggests tickers; arrow keys and Enter look one up', async ({ analysis, page }) => {
    await analysis.goto('/');
    await analysis.step('type "coca"', () => analysis.searchBox.fill('coca'));
    await expect(analysis.suggestions).toBeVisible();
    await expect(analysis.searchBox).toHaveAttribute('aria-expanded', 'true');
    await expect(analysis.suggestions.getByRole('option').first()).toHaveText(/KO\s*COCA COLA CO/);
    await analysis.step('arrow down, Enter', async () => {
      await analysis.searchBox.press('ArrowDown');
      await expect(analysis.searchBox).toHaveAttribute('aria-activedescendant', 'sug-0');
      await analysis.searchBox.press('Enter');
    });
    await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
    await expect(page).toHaveURL(/\?t=KO$/);
    await expect(analysis.suggestions).toBeHidden();
  });

  test('Analyze with a company name looks up the best match', async ({ analysis, page }) => {
    await analysis.goto('/');
    await analysis.step('type "apple" and press Analyze', async () => {
      await analysis.searchBox.fill('apple');
      await analysis.analyzeButton.click();
    });
    await expect(analysis.companyName).toHaveText('Apple Inc. (AAPL)');
    await expect(page).toHaveURL(/\?t=AAPL$/);
  });

  test('clicking a suggestion loads it, and Escape closes the list', async ({ analysis }) => {
    await analysis.goto('/');
    await analysis.searchBox.fill('intel');
    await expect(analysis.suggestions).toBeVisible();
    await analysis.step('press Escape', () => analysis.searchBox.press('Escape'));
    await expect(analysis.suggestions).toBeHidden();
    await expect(analysis.searchBox).toHaveAttribute('aria-expanded', 'false');
    await analysis.searchBox.fill('jpmorgan');
    await analysis.step('click the suggestion', () => analysis.suggestions.getByRole('option', { name: /JPM/ }).click());
    await expect(analysis.companyName).toHaveText('JPMORGAN CHASE & CO (JPM)');
  });

  test('typing a ticker still works exactly as before', async ({ analysis }) => {
    await analysis.goto('/');
    await analysis.searchBox.fill('KO');
    await analysis.searchBox.press('Enter');  // no suggestion chosen: the ticker itself
    await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
  });
});

test.describe('wrong tickers and errors', () => {
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
});

test.describe('results guide', () => {
  test('guide starts collapsed, with a gently pulsing "Show guide", and explains the results', async ({ analysis }) => {
    await analysis.goto('/');
    await expect(analysis.guide).not.toHaveAttribute('open', '');
    await expect(analysis.guideShowText).toHaveText('Show guide');
    expect(await analysis.guideToggle.locator('.guide-toggle').evaluate((el) => getComputedStyle(el).animationName)).toBe('guide-pulse');
    await analysis.step('open the guide', () => analysis.guideToggle.click());
    await expect(analysis.guide).toHaveAttribute('open', '');
    // the guide's cards are named after the tabs, so the guide maps directly onto the results
    await expect(analysis.guideCardTitles).toHaveText(
      ['Overview', 'Red flags', 'SEC history', 'Insider trades', 'Graham & Buffett-style analysis', 'Durable advantage', 'Charts', 'Data']);
    await expect(analysis.guideCardArrows.first()).toBeVisible();
  });

  test('guide collapses after a search and can be reopened', async ({ analysis }) => {
    await analysis.open('KO');
    await expect(analysis.guide).not.toHaveAttribute('open', '');
    // the pulse is only for the start page; it would distract from the results
    expect(await analysis.guideToggle.locator('.guide-toggle').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    await expect(analysis.guideCards).toBeHidden();
    await analysis.step('open the guide', () => analysis.guideToggle.click());
    await expect(analysis.guideCards).toBeVisible();
  });

  test('guide card before a search shows an example on that tab', async ({ analysis, page }) => {
    await analysis.goto('/');
    await analysis.step('open the guide', () => analysis.guideToggle.click());
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
});

test.describe('at a glance', () => {
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

  test('glance has a title and hint', async ({ analysis }) => {
    await analysis.open('KO');
    await expect(analysis.glanceTitle).toHaveText('At a glance');
    await expect(analysis.glanceHead).toContainText('Click any line for the details');
  });
});

test.describe('tabs', () => {
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
      durable: async () => {
        await expect(analysis.durableScore).toContainText('Meets');
        await expect(analysis.panel('durable').getByTestId('check')).toHaveCount(14);
      },
      insiders: async () => {
        await expect(analysis.insiderSells).toContainText('6'); // SMCI: six open-market sales, no buys
        await expect(analysis.insiderTrades).toHaveCount(6);
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

  test('previous and next buttons walk through the tabs', async ({ analysis }) => {
    await analysis.open('KO');
    await expect(analysis.panelNavButtons('overview')).toHaveText(['Next: Red flags →']); // no "previous" on the first tab
    await analysis.step('click "Next: Red flags"', () => analysis.nextButton('overview').click());
    await expect(analysis.panel('flags')).toBeVisible();
    await expect(analysis.panelNavButtons('flags')).toHaveText(['← Overview', 'Next: SEC history →']);
    await analysis.step('click "← Overview"', () => analysis.previousButton('flags').click());
    await expect(analysis.panel('overview')).toBeVisible();
    await analysis.openTab('insiders'); // regression: its neighbours' buttons showed "tab.insiders"
    await expect(analysis.panelNavButtons('insiders')).toHaveText(['← SEC history', 'Next: Graham & Buffett →']);
    await analysis.openTab('history');
    await expect(analysis.panelNavButtons('history')).toHaveText(['← Red flags', 'Next: Insiders →']);
    await analysis.openTab('data');
    await expect(analysis.panelNavButtons('data')).toHaveText(['← Charts']); // no "next" on the last tab
  });

  test('tabs carry the same icons as the guide', async ({ analysis }) => {
    await analysis.open('KO');
    for (const tab of TABS) {
      await expect(analysis.tabIcon(tab)).toHaveAttribute('href', `#i-${tab}`);
      await expect(analysis.guideCardIcon(tab)).toHaveAttribute('href', `#i-${tab}`);
    }
  });

  test('previous/next buttons sit at the bottom of every tab', async ({ analysis }) => {
    // Regression: on the Value and Charts tabs the buttons had ended up inside the price box / chart grid.
    await analysis.open('KO');
    for (const tab of TABS) {
      await analysis.openTab(tab); // a hidden panel isn't found by role, so open each one
      const last = await analysis.panel(tab).evaluate((panel) => panel.lastElementChild?.getAttribute('aria-label'));
      expect(last, tab).toBe('Move between sections');
    }
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
});

test.describe('overview and trends', () => {
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

  test('a company that never paid a dividend says so in the growth table', async ({ analysis }) => {
    await analysis.open('SMCI');
    await expect(analysis.growthRow('Dividend / share')).toContainText('No dividend paid');
    await expect(analysis.growthRow('Dividend / share')).not.toContainText('Not enough data');
  });

  test('trend tiles show a sparkline', async ({ analysis }) => {
    await analysis.open('AAPL');
    await expect(analysis.sparklines).toHaveCount(5); // revenue, earnings, EPS, dividend and R&D (Apple reports R&D)
  });

  test('jargon is explained', async ({ analysis }) => {
    await analysis.open('KO');
    await expect(analysis.jargon(/Compound annual growth rate/).first()).toHaveText('CAGR');
    await expect(analysis.glossary).toBeVisible();
    await analysis.step('open "Terms explained"', () => analysis.glossaryToggle.click());
    await expect(analysis.glossaryTerms).toContainText(['CAGR', 'Free cash flow', 'Graham Number']);
  });
});

test.describe('red flags and SEC history', () => {
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
});

test.describe('Graham & Buffett and the share price', () => {
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
    await expect(analysis.priceTiles).toContainText(/Margin of safety\s*\d+% above/);
    await expect(page).toHaveURL(/\?t=KO&p=68#value$/);
  });

  test('business first, price last: the checklists, then the estimates, then the valuation at the price', async ({ analysis }) => {
    await analysis.open('KO');
    await analysis.openTab('value');
    const top = async (l: Locator) => (await l.boundingBox())!.y;
    const buffett = await top(analysis.checkRow('Margin of safety'));
    expect(buffett).toBeLessThan(await top(analysis.valueTiles));
    expect(await top(analysis.valueTiles)).toBeLessThan(await top(analysis.atPrice));
    expect(await top(analysis.price)).toBeGreaterThan(await top(analysis.valueTiles));  // the price box is in the last section
    await expect(analysis.priceTiles).not.toContainText('Graham Number');  // Graham's own P/B test covers the price
    await analysis.step('enter a price of 68', () => analysis.price.fill('68'));
    await expect(analysis.priceTiles).toContainText(/Margin of safety\s*\d+% (below|above)/);
    await expect(analysis.priceTiles).toContainText(/EV \/ free cash flow\s*\d+\.\d/);
    // the overview gets one line for the price, after the business lines
    await analysis.step('back to the overview', () => analysis.openTab('overview'));
    await expect(analysis.glanceRows.last()).toContainText(/At your price\s*\$68\.00: owner earnings yield 1\.8%/);
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

  test('Peter Lynch: PEG, dividend-adjusted, fair value and debt, from 5 years of EPS growth', async ({ analysis }) => {
    await analysis.open('KO', 68);
    await analysis.openTab('value');
    await expect(analysis.lynch.getByTestId('check')).toHaveCount(5);
    await expect(analysis.lynchScore).toContainText('Meets 1 of 5');
    await expect(analysis.checkRow('Earnings growing 10-25% a year')).toContainText('EPS grew 11.2% a year');
    await expect(analysis.checkRow('PEG ratio')).toContainText('PEG 2.00: P/E 22.4 ÷ growth 11.2');
    await expect(analysis.checkRow('Growth plus dividend yield')).toContainText('0.63: (11.2 + 3.0) ÷ P/E 22.4');
    await expect(analysis.checkRow("Price below Lynch's fair value")).toContainText('Price $68.00 vs fair value $33.97');
    await expect(analysis.checkRow('A normal balance sheet')).toContainText('Debt is 141% of equity');
    // Very fast growth rarely lasts: the price tests are N/A rather than a flattering pass
    await analysis.step('look up SMCI (EPS up 73% a year) at 30', () => analysis.open('SMCI', 30));
    await analysis.openTab('value');
    await expect(analysis.checkRow('PEG ratio')).toContainText('above 25%, which rarely lasts');
    await expect(analysis.lynchScore).toContainText('Meets 1 of 2');
  });

  test('checklist scores add up', async ({ analysis }) => {
    await analysis.open('KO', 68);
    await expect(analysis.grahamScore).toContainText('Meets 4 of 8');
    await expect(analysis.buffettScore).toContainText('Meets 7 of 8'); // includes return on tangible capital
    await expect(analysis.piotroskiScore).toContainText('Meets 7 of 9');
  });

  test('the latest 12 months from quarterly reports show on the Overview, against the last fiscal year', async ({ analysis }) => {
    await analysis.open('AAPL');
    await expect(analysis.ttmCard).toContainText('Latest 12 months, to Jun 27, 2026');
    await expect(analysis.ttmCard).toContainText(/Revenue\s*\$466\.8B\s*Fiscal 2025: \$416\.2B \+12\.2%/);
    await expect(analysis.ttmCard.getByTestId('ttm-item')).toHaveCount(4); // revenue, net income, EPS, free cash flow
    await analysis.open('SMCI'); // its fiscal year ended 2026-06-30: no newer quarter yet
    await expect(analysis.companyName).toContainText('SMCI');
    await expect(analysis.ttmCard).toHaveCount(0);
  });

  test('the Overview compares the company with its industry', async ({ analysis }) => {
    await analysis.useTestIndustryData();
    await analysis.open('KO');
    await expect(analysis.industryCard).toContainText('Beverages (SIC 2080) · 21 companies · calendar 2025');
    await expect(analysis.industryCard.getByTestId('industry-row')).toHaveCount(6); // no R&D: Coca-Cola doesn't report it
    await expect(analysis.industryCard.getByTestId('industry-row').filter({ hasText: 'Net margin' })).toContainText(/27\.3%\s*0\.9%\s*Higher than most/);
    await expect(analysis.industryCard.getByTestId('industry-row').filter({ hasText: 'Revenue growth' })).toContainText('Typical');
  });

  test('a small industry falls back to related industries, and banks get only growth and return on equity', async ({ analysis }) => {
    await analysis.useTestIndustryData();
    await analysis.open('AAPL'); // only 7 companies share Apple's code (3571), so the 50 in 357x are used
    await expect(analysis.industryCard).toContainText('Electronic Computers and related industries (SIC 357x) · 50 companies');
    await analysis.open('JPM');
    await expect(analysis.industryCard.getByTestId('industry-row')).toHaveCount(2);
    await expect(analysis.industryCard).toContainText('Return on equity');
  });

  test('R&D spending shows on the Overview for companies that report it, and not otherwise', async ({ analysis }) => {
    await analysis.open('AAPL');
    await expect(analysis.rdTile).toBeVisible();
    await expect(analysis.rdTile).toContainText('R&D (% of revenue)');
    await expect(analysis.rdTile).toContainText('8.3%'); // $34.5B of R&D on $416.2B of revenue
    await expect(analysis.rdTile).toContainText('High: above 5%');
    await expect(analysis.rdTile).toContainText('$34.5B in 2025 · 4.7% in 2016');
    await analysis.open('KO'); // Coca-Cola doesn't report R&D
    await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
    await expect(analysis.rdTile).toHaveCount(0);
  });

  test('the value estimate can be recalculated with your own assumptions, and reset', async ({ analysis }) => {
    await analysis.open('KO', 68);
    await analysis.step('open the Graham & Buffett tab', () => analysis.openTab('value'));
    await analysis.step('open the assumptions', () => analysis.assumptions.locator('summary').click());
    await expect(analysis.assumption('Discount rate (%)')).toHaveAttribute('placeholder', '10');
    await expect(analysis.assumption('Growth after year 10 (%)')).toHaveAttribute('placeholder', '3');
    const defaultValue = await analysis.valueTiles.textContent();
    await analysis.step('set growth to 2% and the discount rate to 12%', async () => {
      await analysis.assumption('Growth, years 1–10 (%)').fill('2');
      await analysis.assumption('Discount rate (%)').fill('12');
    });
    await expect(analysis.valueTiles).toContainText('growing 2.0% for 10 years, then 3.0%, discounted at 12.0%');
    await analysis.step('make the discount rate equal the long-term growth', () => analysis.assumption('Discount rate (%)').fill('3'));
    await expect(analysis.valueTiles).toContainText('The discount rate must be above the growth after year 10');
    await analysis.step('reset', () => analysis.assumptions.getByTestId('assume-reset').click());
    await expect(analysis.assumption('Growth, years 1–10 (%)')).toHaveValue('');
    await expect(analysis.valueTiles).toHaveText(defaultValue ?? '');
  });

  test('the Durable advantage tab scores the statements, with the figures behind each test', async ({ analysis }) => {
    await analysis.open('KO');
    await analysis.step('open the Durable advantage tab', () => analysis.openTab('durable'));
    await expect(analysis.durableScore).toContainText('Meets 12 of 14');
    const panel = analysis.panel('durable');
    await expect(panel.getByTestId('check')).toHaveCount(14);
    await expect(panel.getByTestId('check').filter({ hasText: 'Lean overheads' })).toContainText('52.7% of gross profit over 10 years');
    await expect(panel.getByTestId('check').filter({ hasText: 'Low debt to equity' })).toContainText('0.80 times equity, including shares bought back');
    await expect(panel.getByTestId('check').filter({ hasText: 'Treasury stock held' })).toContainText('$56.4B of its own shares held');
    // The balance-sheet terms, explained under the checks
    await analysis.step('open Balance-sheet terms explained', () => analysis.balanceTerms.locator('summary').click());
    await expect(analysis.balanceTerms.getByRole('term')).toHaveText(['Balance sheet', "Shareholders' equity (book value)", 'Total liabilities',
      'Debt to equity (in these checks)', 'Long-term debt', 'Retained earnings', 'Treasury stock', 'Preferred stock']);
    await expect(analysis.balanceTerms).toContainText('Companies that cancel the shares they buy back hold none');
    await expect(analysis.panelNavButtons('durable')).toHaveText(['← Graham & Buffett', 'Next: Charts →']);
  });

  test('return on tangible capital, the Piotroski F-score and the yields show on the value tab', async ({ analysis }) => {
    await analysis.open('KO');
    await analysis.step('open the Graham & Buffett tab', () => analysis.openTab('value'));
    await expect(analysis.panel('value')).toContainText('High return on tangible capital');
    await expect(analysis.panel('value')).toContainText(/Overall \d+\.\d% · 15%\+ in 10 of 10 years/);
    await expect(analysis.piotroski).toBeVisible();
    await expect(analysis.piotroski.getByTestId('check')).toHaveCount(9);
    await expect(analysis.piotroski).toContainText('2025: cash flow $7.4B, net income $13.1B');
    // the yields wait for a price, then use the latest dividend and free cash flow per share
    await expect(analysis.priceTiles).toContainText('Dividend yield');
    await expect(analysis.priceTiles).toContainText('Enter a price to calculate');
    await analysis.step('enter a price of 68', () => analysis.price.fill('68'));
    await expect(analysis.priceTiles).toContainText(/Dividend yield\s*3\.0%/);
    await expect(analysis.priceTiles).toContainText(/Owner earnings yield\s*1\.8%/);
  });

  test('bank-specific rules are skipped', async ({ analysis }) => {
    await analysis.open('JPM');
    expect(anyContains(await analysis.flagTitles.allInnerTexts(), 'Looks like a bank')).toBe(true);
    await expect(analysis.checkRow('Strong current position')).toContainText('N/A');
    await expect(analysis.checkRow('Low capital needs')).toContainText('N/A');
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
    await analysis.openTab('durable');
    await expect(analysis.previousButton('durable')).toHaveText('← Graham & Buffett');
    await expect(analysis.valueNote).toContainText('Not affiliated with or endorsed by');
  });

  test('price box links to public quote pages', async ({ analysis }) => {
    await analysis.open('KO');
    await analysis.openTab('value');
    await expect(analysis.priceLinks).toHaveText(['Google ↗', 'Yahoo Finance ↗']);
    await expect(analysis.priceLinks.nth(1)).toHaveAttribute('href', 'https://finance.yahoo.com/quote/KO/');
    await expect(analysis.priceLinks.nth(0)).toHaveAttribute('target', '_blank');
  });
});

test.describe('insider trades (Form 4)', () => {
  test('insider trades: open-market buys and sales in the last 12 months, with the filings', async ({ analysis }) => {
    await analysis.open('KO');
    await analysis.openTab('insiders');
    await expect(analysis.insiderBuys).toContainText('2');
    await expect(analysis.insiderBuys).toContainText('$998.7K · 1 insider');
    await expect(analysis.insiderSells).toContainText('31');
    await expect(analysis.insiderSells).toContainText('$255.7M · 11 insiders · 10 pre-planned');
    await expect(analysis.insiderTrades).toHaveCount(10); // the latest ten; the rest are on SEC
    await expect(analysis.insiderTrades.first()).toContainText('Pietracci Bruno');
    await expect(analysis.insiderTrades.first()).toContainText('President, Latin America OU');
    await expect(analysis.insiderTrades.first().getByRole('link')).toHaveAttribute('href', /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/21344\//);
    await expect(analysis.insiders).toContainText('pre-planned');
    await expect(analysis.allInsiderFilingsLink).toHaveAttribute('href', 'https://www.sec.gov/cgi-bin/own-disp?action=getissuer&CIK=0000021344');
    await expect(analysis.insiders).not.toContainText('COCA COLA CO'); // its own investment in another company isn't counted
  });

  test('several insiders buying is called out in the Insiders tab', async ({ analysis }) => {
    await analysis.open('INTC');
    await analysis.openTab('insiders');
    await expect(analysis.insiderSignal).toContainText('2 insiders bought $10.2M of shares on the open market');
  });

  test('insider trades in Spanish', async ({ analysis }) => {
    await analysis.goto('/?t=KO&lang=es#insiders');
    await expect(analysis.insidersHeading).toHaveText('Operaciones de directivos · últimos 12 meses');
    await expect(analysis.insiderSells).toContainText('Ventas en el mercado');
    await expect(analysis.insiders).toContainText('planificada');
  });

  test('insider trades load only when the Insiders tab is opened, and only once', async ({ analysis, page }) => {
    // Reading a company's Form 4s the first time takes seconds, so nothing is fetched until someone asks for them.
    let requests = 0;
    let release = () => {};
    const held = new Promise<void>((r) => { release = r; });
    await page.route('**/api/insiders**', async (route) => { requests++; await held; await route.continue(); });
    await analysis.open('KO');
    await analysis.openTab('flags');
    expect(requests).toBe(0); // the results, At a glance and red flags don't need them
    await expect(analysis.glanceRows).toHaveCount(6);
    await analysis.openTab('insiders');
    await expect(analysis.insiders).toContainText('Loading insider trades from SEC');
    await analysis.step('the insider answer arrives', async () => release());
    await expect(analysis.insiderTrades).toHaveCount(10);
    await analysis.openTab('overview');
    await analysis.openTab('insiders');
    await expect(analysis.insiderTrades).toHaveCount(10);
    expect(requests).toBe(1); // kept, not fetched again
  });

  test('a link to the Insiders tab loads them straight away', async ({ analysis }) => {
    await analysis.goto('/?t=SMCI#insiders');
    await expect(analysis.insiderSells).toContainText('6');
  });

  test('insider trades that fail to load can be tried again', async ({ analysis, page }) => {
    let failures = 1;
    await page.route('**/api/insiders**', (route) => (failures-- > 0 ? route.abort() : route.continue()));
    await analysis.open('KO');
    await analysis.openTab('insiders');
    await expect(analysis.insiders).toContainText("Insider trades couldn't be loaded from SEC right now.");
    await analysis.step('press "Try again"', () => analysis.insidersRetryButton.click());
    await expect(analysis.insiderTrades).toHaveCount(10);
  });
});

test.describe('Spanish and language choice', () => {
  test('Spanish link shows the whole page in Spanish', async ({ analysis }) => {
    await analysis.goto('/?t=SMCI&lang=es');
    await analysis.glanceRows.first().waitFor();
    await expect(analysis.root).toHaveAttribute('lang', 'es');
    await expect(analysis.searchLabel).toHaveText('Busca una empresa por nombre o ticker');
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
      await expect(analysis.searchLabel).toHaveText('Busca una empresa por nombre o ticker');
    });
  });

  test('English browser gets English', async ({ analysis }) => {
    await analysis.goto('/');
    await expect(analysis.languageButton('en')).toHaveAttribute('aria-pressed', 'true');
    await expect(analysis.searchLabel).toHaveText('Look up a company by name or ticker');
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
    await expect(analysis.searchLabel).toHaveText('Busca una empresa por nombre o ticker');
  });

  // Spanish must stay on across every page, whether it was chosen with the ES button or came from a Spanish link.
  // Regression: arriving from a ?lang=es link, the disclaimer's "Back to the analysis" link dropped the language, and
  // a language from a link wasn't remembered, so every page after that was English.
  for (const entry of ['pressing ES', 'a Spanish link'] as const) {
    test(`Spanish stays on across every page after ${entry}`, async ({ analysis, compare, disclaimer, page }) => {
      const spanish = async (where: string) => {
        await expect(analysis.root, where).toHaveAttribute('lang', 'es');
        await expect(analysis.footerDisclaimerLink, where).toHaveText('Aviso legal'); // the footer is on every page
      };
      if (entry === 'pressing ES') {
        await analysis.open('KO');
        await analysis.step('press ES', () => analysis.switchLanguage('es'));
      } else {
        await analysis.goto('/?t=KO&lang=es');
        await analysis.glanceRows.first().waitFor();
      }
      await spanish('results page');
      await analysis.step('open the compare page', () => analysis.compareLink.click());
      await spanish('compare page');
      await compare.step('back to the full analysis', () => compare.backLink.click());
      await analysis.glanceRows.first().waitFor();
      await spanish('back on the results page');
      await analysis.step('open the full disclaimer', () => analysis.fullDisclaimerLink.click());
      await expect(disclaimer.heading).toHaveText('Aviso sobre riesgos de inversión');
      await disclaimer.step('back to the analysis', () => disclaimer.backLink.click());
      await expect(analysis.searchLabel).toHaveText('Busca una empresa por nombre o ticker');
      await analysis.step('footer: disclaimer', () => analysis.footerDisclaimerLink.click());
      await expect(disclaimer.heading).toHaveText('Aviso sobre riesgos de inversión');
      await disclaimer.step('Home', () => disclaimer.homeButton.click());
      await expect(analysis.searchLabel).toHaveText('Busca una empresa por nombre o ticker');
      // A new visit with no ?lang in the address, on each page.
      for (const path of ['/', '/compare.html', '/disclaimer.html']) {
        await analysis.step(`open ${path} directly`, () => page.goto(path).then(() => undefined));
        await spanish(`${path} opened directly`);
      }
    });
  }

  test('switching back to English is remembered the same way', async ({ analysis, disclaimer, page }) => {
    await analysis.goto('/?lang=es');
    await analysis.step('press EN', () => analysis.switchLanguage('en'));
    await disclaimer.goto();
    await expect(disclaimer.heading).toHaveText('Investment risk disclaimer');
    await analysis.step('open the start page directly', () => page.goto('/').then(() => undefined));
    await expect(analysis.searchLabel).toHaveText('Look up a company by name or ticker');
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
      // The Insiders tab loads when opened: read it once the trades are in, not while it says "Cargando…".
      if (tab === 'insiders') await analysis.insiderBuys.waitFor();
      const quoted = (await analysis.sourceEnglish.allInnerTexts()).flatMap((q) => q.split('\n').map((l) => l.trim()));
      for (const line of (await analysis.main.innerText()).split('\n')) {
        if (quoted.includes(line.trim())) continue; // SEC's own English (insiders' job titles), marked lang="en"
        if (english.test(line) && !allowed.some((a) => line.includes(a))) found.push(`${tab}: ${line.trim().slice(0, 80)}`);
      }
    }
    expect(found).toEqual([]);
  });
});

test.describe('Home button', () => {
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
});

test.describe('disclaimer', () => {
  test('disclaimer is always visible, at the bottom of the page', async ({ analysis }) => {
    await analysis.goto('/');
    await expect(analysis.disclaimer).toContainText('Not investment advice');
    await expect(analysis.disclaimer).toBeVisible();
    const top = async (l: Locator) => (await l.boundingBox())!.y;
    const bottom = async (l: Locator) => { const box = (await l.boundingBox())!; return box.y + box.height; };
    expect(await top(analysis.disclaimer)).toBeGreaterThan(await bottom(analysis.guide)); // under the guide
    await analysis.open('KO');
    await expect(analysis.disclaimer).toBeVisible();
    expect(await top(analysis.disclaimer)).toBeGreaterThan(await bottom(analysis.result)); // and under the results
  });

  test('the short notice and the footer link to the full disclaimer', async ({ analysis, disclaimer, page }) => {
    await analysis.open('KO');
    await expect(analysis.footerDisclaimerLink).toHaveAttribute('href', 'disclaimer.html');
    await analysis.step('open "Full disclaimer"', () => analysis.fullDisclaimerLink.click());
    await expect(page).toHaveURL(/\/disclaimer\.html$/);
    await expect(disclaimer.heading).toBeVisible();
    await expect(disclaimer.sectionHeadings).toHaveText(DISCLAIMER_SECTIONS_EN);
    await expect(disclaimer.main).toContainText('possible loss of some or all of your invested capital');
    await expect(disclaimer.main).toContainText('not liable for any loss or damage');
    await disclaimer.step('back to the analysis', () => disclaimer.backLink.click());
    await expect(page).toHaveURL(/\/$/);
  });

  test('the compare page links to the full disclaimer too', async ({ compare }) => {
    await compare.goto('a=KO');
    await expect(compare.fullDisclaimerLink).toHaveAttribute('href', 'disclaimer.html');
    await expect(compare.footerDisclaimerLink).toHaveAttribute('href', 'disclaimer.html');
  });

  test('the disclaimer reads in Spanish, from Spanish pages and by switching', async ({ analysis, disclaimer, page }) => {
    await analysis.goto('/?t=KO&lang=es');
    await analysis.glanceRows.first().waitFor();
    await analysis.step('open "Aviso legal completo"', () => analysis.fullDisclaimerLink.click());
    await expect(page).toHaveURL(/\/disclaimer\.html\?lang=es$/);
    await expect(disclaimer.heading).toHaveText('Aviso sobre riesgos de inversión');
    await expect(disclaimer.sectionHeadings).toHaveText(['No es asesoramiento', 'Riesgo de pérdida', 'Tu responsabilidad', 'Sin garantía', 'Limitación de responsabilidad']);
    await expect(page).toHaveTitle(/^Aviso legal/);
    await expect(disclaimer.root).toHaveAttribute('lang', 'es');
    await disclaimer.step('switch to English', () => disclaimer.switchLanguage('en'));
    await expect(disclaimer.sectionHeadings).toHaveText(DISCLAIMER_SECTIONS_EN);
    await expect(page).toHaveURL(/\/disclaimer\.html$/);
  });
});

test.describe('company pages', () => {
  test('/stock/KO opens Coca-Cola with its own title, and keeps that address', async ({ analysis, page, consoleErrors }) => {
    await analysis.step('open /stock/KO', async () => { await page.goto('/stock/KO'); });
    await expect(page).toHaveTitle(/^Coca-Cola Company \(The\) \(KO\): 10-year analysis from SEC filings/);
    await expect(analysis.companyName).toHaveText('COCA COLA CO (KO)');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://stock-value-analysis.vercel.app/stock/KO');
    await expect(page).toHaveURL(/\/stock\/KO$/);
    await analysis.openTab('flags');
    await expect(page).toHaveURL(/\/stock\/KO#flags$/);
    await analysis.search('AAPL');
    await expect(analysis.companyName).toHaveText('Apple Inc. (AAPL)');
    await expect(page).toHaveURL(/\/stock\/AAPL#flags$/);
    await expect(page).toHaveTitle('AAPL · 10-Year Stock Value Analysis');
    await analysis.search('KO');
    await expect(page).toHaveTitle(/^Coca-Cola Company \(The\) \(KO\)/);   // its own company again: the page's title
    expect(consoleErrors).toEqual([]);   // styles, scripts and data all load from /stock/…
  });

  test('an unknown company page shows the usual error, and the sitemap lists the company pages', async ({ analysis, page, request }) => {
    const res = await page.goto('/stock/ZZZZQ');
    expect(res?.status()).toBe(404);
    await expect(analysis.error).toContainText("Ticker 'ZZZZQ' not found");
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>https://stock-value-analysis.vercel.app/stock/KO</loc>');
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap: https://stock-value-analysis.vercel.app/sitemap.xml');
  });
});

test.describe('downloads', () => {
  test('the Data tab downloads every figure as CSV, as filed', async ({ analysis }) => {
    await analysis.open('KO');
    await analysis.openTab('data');
    const { name, text } = await analysis.step('press Download CSV', () => analysis.downloadCsv());
    expect(name).toBe('KO-10-year-figures.csv');
    const lines = text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Metric,Unit,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025');
    expect(lines.find((l) => l.startsWith('Revenue,USD,'))).toMatch(/^Revenue,USD,\d{8,}(,\d+)*$/);   // raw figures, not "$41.9B"
    expect(lines.find((l) => l.startsWith('EPS (diluted),USD per share,'))).toBeTruthy();
  });
});

test.describe('page basics: layout, privacy and data freshness', () => {
  test('phone layout has no horizontal scroll', async ({ analysis, page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await analysis.open('AAPL');
    const [scroll, client] = await page.evaluate(() => [
      document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll).toBeLessThanOrEqual(client);
  });

  test('page loads nothing from other sites', async ({ analysis, page }) => {
    // Everything (including Chart.js) is served by the app itself, so a slow third-party site can never block the page.
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));
    await analysis.goto('/?t=AAPL#charts');
    await analysis.chart('cRevenue').waitFor();
    expect(requests.filter((u) => !u.startsWith(BASE_URL))).toEqual([]);
  });

  test('analytics scripts are not loaded locally', async ({ analysis, page }) => {
    // Vercel Web Analytics and Speed Insights only exist on the deployed site; locally they must not load (or count visits).
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));
    await analysis.goto('/?t=KO');
    await analysis.glanceRows.first().waitFor();
    expect(requests.filter((u) => u.includes('/_vercel/'))).toEqual([]);
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
});
