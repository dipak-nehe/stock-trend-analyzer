import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TICKERS, MAX_RECENT, addRecent, chipList, parseRecent } from "../../public/js/recent.js";

test("a company opened again moves to the front, without duplicates, and the list keeps the newest six", () => {
  let list = [];
  for (const tk of ["ko", "AAPL", "MSFT", "KO"]) list = addRecent(list, tk);
  assert.deepEqual(list, ["KO", "MSFT", "AAPL"]);
  for (const tk of ["A", "B", "C", "D", "E"]) list = addRecent(list, tk);
  assert.equal(list.length, MAX_RECENT);
  assert.deepEqual(list, ["E", "D", "C", "B", "A", "KO"]);
  assert.deepEqual(addRecent(["KO"], "<script>"), ["KO"]);  // only well-formed tickers are kept
});

test("a stored list is read defensively: anything malformed is dropped", () => {
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent("not json"), []);
  assert.deepEqual(parseRecent('{"a":1}'), []);
  assert.deepEqual(parseRecent('["KO", 5, "<b>x</b>", "KO", "BRK.B"]'), ["KO", "BRK.B"]);
});

test("the chips show recent companies when there are any, otherwise the examples", () => {
  assert.deepEqual(chipList([]), { recent: false, tickers: DEFAULT_TICKERS });
  assert.deepEqual(chipList(["KO", "AAPL"]), { recent: true, tickers: ["KO", "AAPL"] });
});
