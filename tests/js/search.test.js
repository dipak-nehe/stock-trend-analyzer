import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resolveTicker } from "../../public/js/page.js";

// resolveTicker asks /api/search; a fake fetch stands in for the server
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
/** @param {{ticker: string, name: string}[]} results */
const answer = (results, ok = true) => {
  globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (async () => ({ ok, json: async () => ({ results }) })));
};

test("a company name becomes the best-matching company's ticker", async () => {
  answer([{ ticker: "KO", name: "COCA COLA CO" }, { ticker: "COKE", name: "Coca-Cola Consolidated, Inc." }]);
  assert.equal(await resolveTicker("coca cola"), "KO");
});

test("a ticker SEC knows is kept as typed, even when other companies match too", async () => {
  answer([{ ticker: "APP", name: "AppLovin Corp" }, { ticker: "AAPL", name: "Apple Inc." }]);
  assert.equal(await resolveTicker("aapl"), "aapl");
  answer([{ ticker: "BRK-B", name: "BERKSHIRE HATHAWAY INC" }]);
  assert.equal(await resolveTicker("BRK.B"), "BRK.B");  // the same ticker, written with a dot
});

test("no match, or search unavailable, leaves the text unchanged so the usual message shows", async () => {
  answer([]);
  assert.equal(await resolveTicker("zzzzqqq"), "zzzzqqq");
  answer([], false);
  assert.equal(await resolveTicker("coca"), "coca");
  assert.equal(await resolveTicker("   "), "");
});
