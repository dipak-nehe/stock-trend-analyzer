import { test } from "node:test";
import assert from "node:assert/strict";
import { BUFFETT_QUOTES, OTHER_QUOTES, QUOTES, quoteOfTheDay } from "../../public/js/quotes.js";

test("31 Buffett quotes, each with its letter's year", () => {
  assert.equal(BUFFETT_QUOTES.length, 31);
  for (const q of BUFFETT_QUOTES) assert.ok(q.year >= 1977 && q.year <= 2024, q.en);
});

test("quotes from Peter Lynch, Charlie Munger, John Bogle and JL Collins join them, each with its source", () => {
  const authors = new Set(OTHER_QUOTES.map((q) => q.author));
  assert.deepEqual([...authors].sort(), ["Charlie Munger", "JL Collins", "John Bogle", "Peter Lynch"]);
  for (const q of OTHER_QUOTES) assert.ok(q.source.length > 5, q.en);
});

test("every quote is distinct, has its author, source and a Spanish version, and uses typographic quotes only", () => {
  assert.equal(QUOTES.length, BUFFETT_QUOTES.length + OTHER_QUOTES.length);
  assert.equal(new Set(QUOTES.map((q) => q.en)).size, QUOTES.length);
  for (const q of QUOTES) {
    assert.ok(q.author && q.source, q.en);
    assert.ok(q.en.length > 20 && q.es.length > 20, q.en);
    assert.ok(!/["']/.test(q.en + q.es), `typographic quotes only: ${q.en}`);
  }
});

test("the other authors are spread out: never the same one two days running, and one at least every 3 days", () => {
  let sinceOther = 0;
  for (let i = 0; i < QUOTES.length; i++) {
    const a = QUOTES[i].author, b = QUOTES[(i + 1) % QUOTES.length].author;
    if (a !== "Warren Buffett") assert.notEqual(a, b, `day ${i}`);
    sinceOther = a === "Warren Buffett" ? sinceOther + 1 : 0;
    assert.ok(sinceOther <= 3, `day ${i}: ${sinceOther} Buffett quotes in a row`);
  }
});

test("one quote a day: the same all day, the next one the next day, every quote in turn through the year", () => {
  assert.equal(quoteOfTheDay(new Date(2026, 0, 1, 0, 1)), QUOTES[0]);
  assert.equal(quoteOfTheDay(new Date(2026, 0, 1, 23, 59)), QUOTES[0]);
  assert.equal(quoteOfTheDay(new Date(2026, 0, 2)), QUOTES[1]);
  assert.equal(quoteOfTheDay(new Date(2026, 1, 1)), QUOTES[31]);           // February 1 is the 32nd day
  const seen = new Set(Array.from({ length: QUOTES.length }, (_, i) => quoteOfTheDay(new Date(2026, 0, 1 + i)).en));
  assert.equal(seen.size, QUOTES.length);                                   // all of them within 47 days
});
