import { test } from "node:test";
import assert from "node:assert/strict";
import { BUFFETT_QUOTES, quoteOfTheDay } from "../../public/js/quotes.js";

test("31 distinct Buffett quotes, one for each day of the month, each with its letter's year and a Spanish version", () => {
  assert.equal(BUFFETT_QUOTES.length, 31);
  assert.equal(new Set(BUFFETT_QUOTES.map((q) => q.en)).size, 31);
  for (const q of BUFFETT_QUOTES) {
    assert.ok(q.year >= 1977 && q.year <= 2024, q.en);
    assert.ok(q.en.length > 20 && q.es.length > 20, q.en);
    assert.ok(!/["']/.test(q.en + q.es), `typographic quotes only: ${q.en}`);
  }
});

test("the quote follows the day of the month: same all day, new each day, repeating every month", () => {
  assert.equal(quoteOfTheDay(new Date(2026, 9, 1, 0, 1)), BUFFETT_QUOTES[0]);
  assert.equal(quoteOfTheDay(new Date(2026, 9, 1, 23, 59)), BUFFETT_QUOTES[0]);
  assert.equal(quoteOfTheDay(new Date(2026, 9, 2)), BUFFETT_QUOTES[1]);
  assert.equal(quoteOfTheDay(new Date(2026, 9, 31)), BUFFETT_QUOTES[30]);
  assert.equal(quoteOfTheDay(new Date(2026, 10, 1)), BUFFETT_QUOTES[0]); // a new month starts again
});
