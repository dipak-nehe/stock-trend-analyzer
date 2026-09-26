import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../../public/js/flags.js";
import { growthView } from "../../public/js/growth.js";
import { historyView } from "../../public/js/history.js";
import { valueChecks } from "../../public/js/valuation.js";
import { flagCounts, footnote, valueView } from "../../public/js/views.js";
import { company, events, history, nulls } from "./company.js";

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const growthRow = (d, label) => text(growthView(d, analyze(d)).table).split(/(?=\b(?:Revenue|Net income|Operating income|EPS|Dividend|Operating cash flow|Free cash flow|Total assets|Shareholders|Total debt|Cash|Diluted shares)\b)/).find((r) => r.startsWith(label));

test("growth table shows first year, latest year, total growth and CAGR", () => {
  const row = growthRow(company({ revenue: [100e6, null, null, null, null, null, null, null, null, 200e6] }), "Revenue");
  assert.match(row, /\$100\.0M \$200\.0M \+\$100\.0M ▲ 100\.0% 8\.0%/);
});

test("growth table explains sign changes instead of showing a percentage", () => {
  const d = company({ netIncome: [...Array(9).fill(100e6), -50e6], dps: [...Array(9).fill(1), 0] });
  assert.match(growthRow(d, "Net income"), /From profit to loss n\/m/);
  assert.match(growthRow(d, "Dividend"), /Fell to zero n\/m/);
});

test("growth table notes when a metric starts in a later year", () => {
  const d = company({ capex: [null, null, 30e6, 30e6, 30e6, 30e6, 30e6, 30e6, 30e6, 30e6] });
  assert.match(growthRow(d, "Free cash flow"), /\(2018\)/);
});

test("filing history filters, counts and paging", () => {
  const evts = events(...Array.from({ length: 12 }, (_, i) => ["late_filing", `2024-01-${String(i + 1).padStart(2, "0")}`]),
                      ["sec_letter", "2020-01-01"]);
  const h = history(evts);
  const all = historyView(h);
  assert.equal(all.total, 13);
  assert.equal((all.events.match(/class="event/g) || []).length, 10);
  assert.equal(all.moreText, "Show all 13");
  assert.equal((historyView(h, "all", true).events.match(/class="event/g) || []).length, 13);
  assert.equal(historyView(h, "flags").total, 12);
  assert.equal(historyView(h, "letters").total, 1);
  assert.match(historyView(h, "amend").events, /No filings of this kind since 2016/);
  assert.match(all.filters, /data-f="all" aria-pressed="true"/);
  assert.match(text(all.tiles), /Late filings 12 ✗ Repeated/);
});

test("flag counts and checklist scores", () => {
  const d = company();
  const r = analyze(d);
  assert.match(text(flagCounts(r.flags)), /^0 critical \d+ warnings \d+ strengths$/);
  const v = valueView(d, null, valueChecks(d, null, r));
  assert.match(text(v.grahamScore), /\(2 need a price\)/);
});

test("footnote describes stock splits in plain words", () => {
  const d = company({}, { splits: [{ ratio: 4 }, { ratio: 0.125 }] });
  assert.match(footnote(d), /stock splits \(4-for-1, 1-for-8\)/);
});
