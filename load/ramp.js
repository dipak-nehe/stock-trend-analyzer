// k6 load test: visitors ramp up 5 → 10 → 15 (LEVELS), hold at each level, then ramp down to 0.
//
// Each virtual user acts like a visitor: opens the page, looks up a company (/api/financials) and, one time in
// three, opens the Insiders tab (/api/insiders), with a pause between steps like a person reading.
//
// The visitors only use the five companies in tests/fixtures. On the local test server (the default) they come
// from the saved filings, so nothing reaches SEC. On the live site they're looked up once in setup(), one at a
// time, so the visitors' load is served from storage and never makes SEC calls (SEC blocks clients that send
// too many).
//
// First lookups (live site only): a second, separate scenario measures the slow path, a company nobody has
// looked up in the last 24 hours, so the server fetches it from SEC (~3 SEC calls). It runs at a fixed pace,
// one lookup every 12 s however many visitors there are, each company at most once per run, main results only
// (a first Insiders load can take up to 100 SEC calls). It has its own time limit so slow first lookups don't
// hide among the fast stored ones. A company looked up in the last 24 hours comes back from storage: the
// first_lookup_from_sec rate shows how many were really fetched from SEC.
//
//   k6 run load/ramp.js                                   local test server (npm run load starts it)
//   STEP=20s k6 run load/ramp.js                          shorter run: each ramp and hold lasts 20 s
//   LEVELS=3,6,9 k6 run load/ramp.js                      other user levels (default 5,10,15)
//   BASE_URL=https://stock-value-analysis.vercel.app k6 run load/ramp.js
//   BYPASS_CDN=1 ...                                      live only: skip Vercel's CDN cache, so each request runs
//                                                         the Python function and reads Redis
//   FIRST_LOOKUPS=0 ...                                   live only: leave out the first-lookups scenario
import http from 'k6/http';
import exec from 'k6/execution';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const STEP = __ENV.STEP || '1m';
// User levels to ramp through, holding at each one, then down to 0. The default 5,10,15 follows the request;
// set fewer on a smaller machine (e.g. LEVELS=3,6,9): how many users a machine can run depends on its memory and CPU.
const LEVELS = (__ENV.LEVELS || '5,10,15').split(',').map(Number);
const stages = () => [
  ...LEVELS.flatMap((target) => [{ duration: STEP, target }, { duration: STEP, target }]), // ramp up, then hold
  { duration: STEP, target: 0 },                                                          // ramp down
];
const BYPASS_CDN = __ENV.BYPASS_CDN === '1';
const API_VERSION = 6; // public/js/page.js: the page's requests look exactly like this
const TICKERS = ['AAPL', 'KO', 'INTC', 'JPM', 'SMCI'];
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(BASE_URL);
const FIRST_LOOKUPS = !LOCAL && __ENV.FIRST_LOOKUPS !== '0';
// Large US companies that file with SEC, other than the visitors' five and the page's example tickers.
const FIRST_LOOKUP_TICKERS = [
  'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'LLY', 'V', 'MA', 'UNH', 'XOM', 'JNJ', 'WMT', 'PG', 'HD',
  'COST', 'ORCL', 'CVX', 'MRK', 'ABBV', 'PEP', 'ADBE', 'CRM', 'NFLX', 'AMD', 'TMO', 'MCD', 'CSCO', 'ACN', 'ABT',
  'DHR', 'WFC', 'LIN', 'TXN', 'DIS', 'VZ', 'PM', 'NKE', 'IBM', 'QCOM', 'CAT', 'AMGN', 'HON', 'UPS', 'LOW',
  'SBUX', 'GS', 'MS', 'BA', 'DE',
];
const STEPS = 2 * LEVELS.length + 1;
const firstLookupFromSec = new Rate('first_lookup_from_sec');

/** k6 durations like "1m", "20s", "1m30s" → seconds. */
const seconds = (d) => [...d.matchAll(/(\d+)(h|m|s)/g)].reduce((t, [, n, u]) => t + Number(n) * { h: 3600, m: 60, s: 1 }[u], 0);

const scenarios = {
  visitors: {
    executor: 'ramping-vus',
    exec: 'visitor',
    startVUs: 0,
    stages: stages(),
  },
};
if (FIRST_LOOKUPS) {
  scenarios.first_lookups = {
    executor: 'constant-arrival-rate',
    exec: 'firstLookup',
    rate: 1,
    timeUnit: '12s',                   // one first lookup every 12 s, however many visitors
    duration: `${Math.min(STEPS * seconds(STEP), 12 * FIRST_LOOKUP_TICKERS.length)}s`,
    preAllocatedVUs: 2,
    maxVUs: 4,
  };
}

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ['rate<0.01'],                         // under 1% errors
    'http_req_duration{name:page}': ['p(95)<500'],
    'http_req_duration{name:financials}': ['p(95)<1000'],
    'http_req_duration{name:insiders}': ['p(95)<1000'],
    checks: ['rate>0.99'],
    ...(FIRST_LOOKUPS ? { 'http_req_duration{name:first_lookup}': ['p(95)<5000'] } : {}),
  },
};

const api = (endpoint, ticker) =>
  `${BASE_URL}/api/${endpoint}?ticker=${ticker}&v=${API_VERSION}${BYPASS_CDN ? `&r=${Math.random().toString(36).slice(2)}` : ''}`;

export function setup() {
  // A new order each run, so the same companies aren't always the ones looked up first.
  const order = FIRST_LOOKUP_TICKERS.map((t) => [Math.random(), t]).sort((a, b) => a[0] - b[0]).map(([, t]) => t);
  // Make sure every ticker is stored before the load starts: sequential, so at most a few SEC calls in total.
  for (const t of TICKERS) {
    const res = http.get(api('financials', t), { tags: { name: 'warmup' }, timeout: '60s' });
    if (res.status !== 200) throw new Error(`warm-up of ${t} failed: HTTP ${res.status} at ${BASE_URL}`);
    http.get(api('insiders', t), { tags: { name: 'warmup' }, timeout: '60s' });
  }
  return { order };
}

/** One visitor: the page, a lookup and, one time in three, the Insiders tab (all served from storage). */
export function visitor() {
  const ticker = TICKERS[Math.floor(Math.random() * TICKERS.length)];

  group('open the page', () => {
    const res = http.get(`${BASE_URL}/`, { tags: { name: 'page' } });
    check(res, { 'page: 200': (r) => r.status === 200 });
  });
  sleep(1 + Math.random());

  group('look up a company', () => {
    const res = http.get(api('financials', ticker), { tags: { name: 'financials' } });
    check(res, {
      'financials: 200': (r) => r.status === 200,
      'financials: right company': (r) => r.json('ticker') === ticker,
      // Served from storage, never fetched from SEC during the load (live, behind the CDN, the header is cached).
      'financials: not fetched from SEC': (r) => r.headers['X-Data-Cache'] !== 'MISS',
    });
  });
  sleep(2 + Math.random() * 2);

  if (Math.random() < 1 / 3) {
    group('open the Insiders tab', () => {
      const res = http.get(api('insiders', ticker), { tags: { name: 'insiders' } });
      check(res, { 'insiders: 200': (r) => r.status === 200 });
    });
    sleep(1 + Math.random() * 2);
  }
}

/** A company nobody has looked up lately: the server fetches it from SEC, then stores it. */
export function firstLookup(data) {
  const ticker = data.order[exec.scenario.iterationInTest];
  if (!ticker) return; // every company used once in this run
  // Always past the CDN: a CDN copy from an earlier run would measure nothing.
  const url = `${BASE_URL}/api/financials?ticker=${ticker}&v=${API_VERSION}&r=${Math.random().toString(36).slice(2)}`;
  const res = http.get(url, { tags: { name: 'first_lookup' }, timeout: '60s' });
  firstLookupFromSec.add(res.headers['X-Data-Cache'] === 'MISS' || res.headers['X-Data-Cache'] === 'REVALIDATED');
  if (res.status !== 200) console.warn(`first lookup of ${ticker} failed: HTTP ${res.status} ${res.body ? String(res.body).slice(0, 200) : res.error}`);
  check(res, {
    'first lookup: 200': (r) => r.status === 200,
    'first lookup: right company': (r) => r.status === 200 && r.json('ticker') === ticker,
  });
}
