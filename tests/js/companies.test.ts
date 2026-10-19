import { test } from "node:test";
import assert from "node:assert/strict";
import { exchangeOptions, findCompanies, industryOptions, nextSort, type Directory } from "../../src/companies.ts";

const DIR: Directory = {
  generated: "2026-10-18", count: 6,
  industries: { "2080": "Beverages", "2086": "Bottled & Canned Soft Drinks & Carbonated Waters", "3571": "Electronic Computers" },
  companies: [
    ["AAPL", "Apple Inc.", "Nasdaq", "3571"],
    ["BRK-B", "BERKSHIRE HATHAWAY INC", "NYSE", ""],
    ["KO", "COCA COLA CO", "NYSE", "2080"],
    ["COKE", "Coca-Cola Consolidated, Inc.", "Nasdaq", "2086"],
    ["KOF", "COCA COLA FEMSA SAB DE CV", "NYSE", "2086"],
    ["PEP", "PepsiCo, Inc.", "Nasdaq", "2080"],
  ],
};
const tickers = (rows: [string, string, string, string][]) => rows.map((r) => r[0]);

test("search: a ticker that starts with the text, or a name with every word of it, ignoring case and punctuation", () => {
  assert.deepEqual(tickers(findCompanies(DIR, { text: "coca cola" })), ["KO", "COKE", "KOF"]);
  assert.deepEqual(tickers(findCompanies(DIR, { text: "ko" })), ["KO", "KOF"]);          // the exact ticker first
  assert.deepEqual(tickers(findCompanies(DIR, { text: "brk.b" })), ["BRK-B"]);            // BRK.B and BRK-B are the same
  assert.deepEqual(findCompanies(DIR, { text: "zzz" }), []);
});

test("filters: an industry code, a 2-digit industry group, and an exchange", () => {
  assert.deepEqual(tickers(findCompanies(DIR, { industry: "2080" })), ["KO", "PEP"]);
  assert.deepEqual(tickers(findCompanies(DIR, { industry: "20" })), ["KO", "COKE", "KOF", "PEP"]);
  assert.deepEqual(tickers(findCompanies(DIR, { industry: "2086", exchange: "NYSE" })), ["KOF"]);
});

test("sorting by any column, either way; companies without an industry go last both ways", () => {
  assert.deepEqual(tickers(findCompanies(DIR, { sort: "ticker" })), ["AAPL", "BRK-B", "COKE", "KO", "KOF", "PEP"]);
  assert.deepEqual(tickers(findCompanies(DIR, { sort: "ticker", dir: -1 })), ["PEP", "KOF", "KO", "COKE", "BRK-B", "AAPL"]);
  assert.equal(findCompanies(DIR, { sort: "industry" }).at(-1)?.[0], "BRK-B");
  assert.equal(findCompanies(DIR, { sort: "industry", dir: -1 }).at(-1)?.[0], "BRK-B");
  assert.deepEqual(nextSort({ sort: "name", dir: 1 }, "name"), { sort: "name", dir: -1 });
  assert.deepEqual(nextSort({ sort: "name", dir: -1 }, "ticker"), { sort: "ticker", dir: 1 });
});

test("filter choices: industries A-Z with how many companies, exchanges largest first", () => {
  assert.deepEqual(industryOptions(DIR).map(([c, , n]) => [c, n]), [["2080", 2], ["2086", 2], ["3571", 1]]);
  assert.deepEqual(exchangeOptions(DIR), [["Nasdaq", 3], ["NYSE", 3]]);   // a tie goes A-Z
});
