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

import { filingProblems, glanceRows } from "../../public/js/views.js";

const glance = (d, price = null) => {
  const r = analyze(d);
  return Object.fromEntries(glanceRows(d, r, valueChecks(d, price, r)).map((row) => [row.what, row]));
};

test("glance: one line per area, each pointing to its tab", () => {
  const rows = glance(company());
  assert.deepEqual(Object.keys(rows), ["Revenue", "Earnings", "Dividend", "Red flags", "SEC record", "Value checklists"]);
  assert.deepEqual(Object.values(rows).map((r) => r.tab), ["overview", "overview", "overview", "flags", "history", "value"]);
  assert.match(rows.Revenue.say, /^Growing, 6\.0% a year$/);
  assert.equal(rows["SEC record"].say, "Clean since 2016");
  assert.match(rows["Value checklists"].say, /add a price for valuation tests$/);
});

test("glance: recent losses, suspended dividends and critical flags stand out", () => {
  const d = company({ netIncome: [...Array(9).fill(100e6), -50e6], dps: [...Array(9).fill(1), 0] });
  const rows = glance(d);
  assert.equal(rows.Earnings.sev, "critical");
  assert.equal(rows.Dividend.say, "Cut to zero (suspended)");
  assert.equal(rows["Red flags"].sev, "critical");
  assert.match(rows["Red flags"].say, /— Recent net losses$/);
});

test("glance: no dividend history and the price prompt disappears once a price is set", () => {
  assert.equal(glance(company({ dps: nulls(), dividendsPaid: nulls() })).Dividend.say, "No dividend paid");
  assert.doesNotMatch(glance(company(), 50)["Value checklists"].say, /add a price/);
});

test("filing problems ignore routine SEC letters and grade severity", () => {
  assert.equal(filingProblems(null), null);
  assert.deepEqual(filingProblems(history(events(["sec_letter", "2020-01-01"]))), { total: 0, sev: "good", text: "" });
  assert.equal(filingProblems(history(events(["auditor_change", "2024-01-01"]))).sev, "warning");
  const smci = filingProblems(history(events(["non_reliance", "2018-01-01"], ["late_filing", "2019-01-01"], ["late_filing", "2020-01-01"])));
  assert.deepEqual(smci, { total: 3, sev: "critical", text: "1 restatement · 2 late filings" });
});

import { FLAG_HELP } from "../../public/js/help.js";
import { DATA_GROUPS, dataTable, flagsList, sparkline } from "../../public/js/views.js";
import { YEARS } from "./company.js";

test("every warning, critical or strength flag has a plain-English 'why it matters' line", () => {
  // Scenarios chosen to trigger as many different rules as possible.
  const scenarios = [
    company(),
    company({ netIncome: [...Array(9).fill(100e6), -50e6], dps: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.6, 0.8, 0],
              totalDebt: YEARS.map(() => 2500e6), currentLiabilities: YEARS.map(() => 900e6),
              operatingIncome: YEARS.map(() => -5e6), dividendsPaid: YEARS.map(() => 300e6),
              goodwill: YEARS.map(() => 1500e6), dilutedShares: YEARS.map((_, i) => 100e6 * 1.05 ** i) },
            { secHistory: history(events(["non_reliance", "2018-01-01"], ["auditor_change", "2024-01-01"],
                                         ["late_filing", "2025-01-01"], ["late_filing", "2024-01-01"], ["late_filing", "2023-01-01"])) }),
    company({ revenue: YEARS.map((_, i) => 1000e6 * 0.9 ** i), operatingCashFlow: YEARS.map(() => 50e6),
              receivables: YEARS.map((_, i) => 100e6 * 1.3 ** i), inventory: YEARS.map((_, i) => 80e6 * 1.3 ** i),
              operatingIncome: YEARS.map(() => 20e6), capex: YEARS.map(() => 200e6) }),
    company({ totalDebt: YEARS.map(() => 1500e6), cash: YEARS.map(() => 5000e6) }),
  ];
  const titles = new Set(scenarios.flatMap((d) => analyze(d).flags.filter((f) => f.sev !== "info").map((f) => f.title)));
  assert.ok(titles.size >= 20, `only ${titles.size} distinct flags exercised`);
  for (const t of titles) assert.ok(FLAG_HELP[t], `no "why it matters" text for: ${t}`);
});

test("flags are grouped into needs attention, going well and notes", () => {
  const flags = [{ sev: "good", title: "Growing dividend", why: "x" }, { sev: "critical", title: "Recent net losses", why: "y" },
                 { sev: "info", title: "Some data missing", why: "z" }, { sev: "warning", title: "High payout ratio", why: "w" }];
  const html = text(flagsList(flags));
  assert.match(html, /^Needs attention 2 .*Recent net losses.*High payout ratio.* Going well 1 .*Growing dividend.* Notes 1 .*Some data missing/);
  assert.match(html, /Why it matters: The company recently spent more than it earned/);
  assert.match(text(flagsList([{ sev: "good", title: "Growing dividend", why: "x" }])), /Nothing needs attention/);
});

test("sparkline draws the yearly shape and skips missing years", () => {
  const svg = sparkline([1, 2, null, 4]);
  assert.equal((svg.match(/[ML]\d/g) || []).length, 3);
  assert.match(svg, /aria-hidden="true"/);
  assert.equal(sparkline([null, 5, null]), "");
  assert.match(sparkline([-2, 3, 5]), /class="zero"/);  // a zero line when values cross zero
});

test("data table groups rows by statement and highlights the latest year", () => {
  const d = company();
  const html = dataTable(d, analyze(d));
  const groups = [...html.matchAll(/<tr class="group"><th[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(groups, DATA_GROUPS.map(([name]) => name));
  assert.equal((html.match(/class="latest"/g) || []).length, 1 + DATA_GROUPS.reduce((n, [, rows]) => n + rows.length, 0));
});

test("footnote only mentions stock splits that affect the years shown", () => {
  const d = company({}, { periodEnds: YEARS.map((y) => `${y}-12-31`),
                          splits: [{ ratio: 2, detectedInFiling: "2013-02-27" }, { ratio: 4, detectedInFiling: "2020-10-30" }] });
  assert.match(footnote(d), /stock splits \(4-for-1\)/);
  assert.doesNotMatch(footnote(d), /2-for-1/);
});
