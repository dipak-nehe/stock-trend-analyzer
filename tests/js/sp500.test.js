import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PICKS, filterCompanies, parsePicks, sectors, togglePick } from "../../public/js/sp500.js";
import { addToSaved, loader, nextSort, savedTickers, tableHtml } from "../../public/js/stock-table.js";
import { portfolioRow } from "../../public/js/portfolio.js";
import { company } from "./company.js";

const LIST = [
  { t: "KO", n: "Coca-Cola Company (The)", s: "Consumer Staples" },
  { t: "PEP", n: "PepsiCo", s: "Consumer Staples" },
  { t: "BRK.B", n: "Berkshire Hathaway", s: "Financials" },
  { t: "NVDA", n: "Nvidia", s: "Information Technology" },
  { t: "BF.B", n: "Brown–Forman", s: "Consumer Staples" },
];
const tickers = (list) => list.map((c) => c.t);

test("search matches a ticker's start or every word of a name, ignoring case and punctuation", () => {
  assert.deepEqual(tickers(filterCompanies(LIST, "coca cola", "")), ["KO"]);
  assert.deepEqual(tickers(filterCompanies(LIST, "Cola", "")), ["KO"]);
  assert.deepEqual(tickers(filterCompanies(LIST, "pep", "")), ["PEP"]);
  assert.deepEqual(tickers(filterCompanies(LIST, "brk-b", "")), ["BRK.B"]);   // the dash form finds the dot form
  assert.deepEqual(tickers(filterCompanies(LIST, "brown forman", "")), ["BF.B"]);  // the en dash in the name
  assert.deepEqual(tickers(filterCompanies(LIST, "  ", "")), tickers(LIST));
  assert.deepEqual(filterCompanies(LIST, "zzz", ""), []);
});

test("the sector filter narrows the list, and the sectors are listed A-Z", () => {
  assert.deepEqual(tickers(filterCompanies(LIST, "", "Consumer Staples")), ["KO", "PEP", "BF.B"]);
  assert.deepEqual(tickers(filterCompanies(LIST, "pep", "Financials")), []);
  assert.deepEqual(sectors(LIST), ["Consumer Staples", "Financials", "Information Technology"]);
});

test("no more than 10 picks: an 11th is refused, and unticking makes room", () => {
  assert.equal(MAX_PICKS, 10);
  let picks = [];
  for (let i = 0; i < 10; i++) picks = togglePick(picks, `T${i}`).picks;
  const eleventh = togglePick(picks, "T10");
  assert.equal(eleventh.refused, true);
  assert.equal(eleventh.picks.length, 10);
  const fewer = togglePick(picks, "T3");
  assert.deepEqual([fewer.refused, fewer.picks.length, fewer.picks.includes("T3")], [false, 9, false]);
  assert.equal(togglePick(fewer.picks, "T10").picks.length, 10);
});

test("picks from an address are cleaned and cut to 10, counting what was left out", () => {
  assert.deepEqual(parsePicks("ko,aapl,KO"), { picks: ["KO", "AAPL"], dropped: 0 });
  const many = Array.from({ length: 40 }, (_, i) => `T${i}`).join(",");
  assert.deepEqual(parsePicks(many).dropped, 30);  // not capped at the portfolio's 30 first
  assert.equal(parsePicks(many).picks.length, 10);
  assert.deepEqual(parsePicks(null), { picks: [], dropped: 0 });
});

test("the shared table: sort buttons, a row per stock, a median from two stocks, and remove buttons only when asked", () => {
  const row = portfolioRow(company());
  /** @type {import("../../public/js/stock-table.js").Entry} */
  const ok = { ticker: "TEST", status: "ok", row };
  /** @type {import("../../public/js/stock-table.js").Entry} */
  const failed = { ticker: "ZZZ", status: "error", error: "Ticker 'ZZZ' not found" };
  const html = tableHtml([ok, failed], { key: "", dir: 1 });
  assert.match(html, /data-sort="revenue"/);
  assert.match(html, /Test Co \(TEST\)/);
  assert.match(html, /Ticker &#?\w*;?ZZZ|Ticker 'ZZZ' not found/);
  assert.doesNotMatch(html, /pf-median/);               // one loaded stock: no median yet
  assert.doesNotMatch(html, /data-remove/);
  /** @type {import("../../public/js/stock-table.js").Entry} */
  const second = { ...ok, ticker: "TWO", row: { ...row, ticker: "TWO" } };
  const two = tableHtml([ok, second], { key: "roe", dir: -1 }, { removable: true });
  assert.match(two, /data-testid="pf-median"/);
  assert.match(two, /data-remove="TWO"/);
  assert.match(two, /aria-sort="descending"[^>]*><button[^>]*data-sort="roe"/);
});

test("the loader fetches three companies at a time and records each result or error", async () => {
  const realFetch = globalThis.fetch;
  let inFlight = 0, most = 0;
  const d = company();
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (async (url) => {
    inFlight++; most = Math.max(most, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    const ticker = new URL(String(url), "http://x").searchParams.get("ticker");
    return ticker === "BAD"
      ? { ok: false, status: 404, json: async () => ({ error: "Ticker 'BAD' not found in SEC EDGAR." }) }
      : { ok: true, status: 200, json: async () => ({ ...d, ticker }) };
  }));
  try {
    /** @type {import("../../public/js/stock-table.js").Entry[]} */
    const entries = ["A", "B", "BAD", "C", "D"].map((ticker) => ({ ticker, status: "loading" }));
    await new Promise((done) => {
      let changes = 0;
      loader(() => entries, () => { if (++changes === entries.length) done(undefined); })();
    });
    assert.equal(most, 3);
    assert.deepEqual(entries.map((e) => e.status), ["ok", "ok", "error", "ok", "ok"]);
    assert.equal(entries[0].row.ticker, "A");
    assert.match(entries[2].error, /not found/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("sorting: numbers start best-first, names A-Z, and a second click reverses", () => {
  assert.deepEqual(nextSort({ key: "", dir: 1 }, "roe"), { key: "roe", dir: -1 });
  assert.deepEqual(nextSort({ key: "roe", dir: -1 }, "roe"), { key: "roe", dir: 1 });
  assert.deepEqual(nextSort({ key: "roe", dir: -1 }, "ticker"), { key: "ticker", dir: 1 });
});

test("saving picks to My portfolio skips ones already saved and stops at 30", () => {
  const store = new Map();
  // a minimal stand-in for the browser's storage (only the two calls stock-table.js makes)
  globalThis.localStorage = /** @type {Storage} */ (/** @type {unknown} */ ({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) }));
  try {
    store.set("portfolio", "KO,brk-b");
    const r = addToSaved(["KO", "AAPL", "BRK.B"]);
    assert.deepEqual(r, { added: ["AAPL"], skipped: ["KO", "BRK.B"], full: [] });
    assert.deepEqual(savedTickers(), ["KO", "BRK-B", "AAPL"]);
    store.set("portfolio", Array.from({ length: 29 }, (_, i) => `T${i}`).join(","));
    assert.deepEqual(addToSaved(["A1", "A2"]), { added: ["A1"], skipped: [], full: ["A2"] });
  } finally {
    delete globalThis.localStorage;
  }
});
