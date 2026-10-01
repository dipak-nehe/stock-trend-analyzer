// k6 browser (UI) load test: real headless Chromium users ramp up 5 → 10 → 15 (LEVELS), hold at each level, then ramp
// down to 0.
//
// Each virtual user is a browser: it opens the page, types a ticker into the search box, presses Analyze and
// checks one checkpoint, the company heading shows that ticker (e.g. "COCA COLA CO (KO)"). Unlike load/ramp.js,
// which sends plain HTTP requests, this loads the JavaScript, CSS and charts and draws the page, so it measures
// what a person waits for. Each browser needs a few hundred MB and a CPU share, so the number a machine can run
// depends on its capacity: pick LEVELS to fit it.
//
// Only the five companies in tests/fixtures are used: on the local test server (the default) they come from the
// saved filings; on the live site setup() looks each one up once first, so the load never reaches SEC.
//
//   npm run load:ui                                         local test server (started for you), HTML report
//   LEVELS=3,6,9 npm run load:ui                      other user levels (default 5,10,15)
//   STEP=20s npm run load:ui                                shorter run: each ramp and hold lasts 20 s
//   BASE_URL=https://stock-value-analysis.vercel.app k6 run load/ui-ramp.js
import http from 'k6/http';
import { browser } from 'k6/browser';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const STEP = __ENV.STEP || '1m';
// User levels to ramp through, holding at each one, then down to 0. The default 5,10,15 follows the request;
// set fewer on a smaller machine (e.g. LEVELS=3,6,9): how many browsers a machine can run depends on its memory and CPU.
const LEVELS = (__ENV.LEVELS || '5,10,15').split(',').map(Number);
const stages = () => [
  ...LEVELS.flatMap((target) => [{ duration: STEP, target }, { duration: STEP, target }]), // ramp up, then hold
  { duration: STEP, target: 0 },                                                          // ramp down
];
const API_VERSION = 6; // public/js/page.js
const TICKERS = ['AAPL', 'KO', 'INTC', 'JPM', 'SMCI'];
const searchToResult = new Trend('search_to_result', true); // from pressing Analyze to the company heading

export const options = {
  scenarios: {
    ui: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: stages(),
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    checks: ['rate>0.99'],                       // the checkpoint passes for over 99% of searches
    search_to_result: ['p(95)<3000'],            // Analyze → company shown, 95% within 3 s
    browser_web_vital_lcp: ['p(95)<2500'],       // largest contentful paint ("good" per Google is 2.5 s)
    browser_web_vital_cls: ['p(95)<0.1'],        // layout shift ("good" is under 0.1)
  },
};

export function setup() {
  // Make sure every ticker is stored before the load starts: one at a time, so at most a few SEC calls.
  for (const t of TICKERS) {
    const res = http.get(`${BASE_URL}/api/financials?ticker=${t}&v=${API_VERSION}`, { timeout: '60s' });
    if (res.status !== 200) throw new Error(`warm-up of ${t} failed: HTTP ${res.status} at ${BASE_URL}`);
  }
}

export default async function () {
  const ticker = TICKERS[Math.floor(Math.random() * TICKERS.length)];
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });

    // Search: type the ticker into the search box (#ticker) and press Analyze (#go).
    await page.locator('#ticker').fill(ticker);
    const started = Date.now();
    await page.locator('#go').click();

    // Checkpoint: the company heading appears and names the ticker searched for.
    const heading = page.locator('[data-testid="company-name"]');
    await heading.waitFor({ state: 'visible', timeout: 15000 });
    searchToResult.add(Date.now() - started);
    const text = (await heading.textContent()) || '';
    check(text, { 'company heading shows the ticker searched for': (t) => t.includes(`(${ticker})`) });
  } catch (e) {
    check(null, { 'company heading shows the ticker searched for': () => false });
    console.warn(`search for ${ticker} failed: ${e}`);
  } finally {
    await page.close();
    await context.close();
  }
  sleep(1 + Math.random() * 2); // a person reading before the next search
}
