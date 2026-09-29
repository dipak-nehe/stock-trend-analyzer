import { test } from "node:test";
import assert from "node:assert/strict";
import { insiderSummary, insiderView } from "../../public/js/insiders.js";
import { analyze } from "../../public/js/flags.js";
import { company } from "./company.js";

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** An insider summary as the API returns it (backend/insiders.py). */
function insiders({ buys = [0, 0, 0], sells = [0, 0, 0, 0], trades = [], partial = false, filings = 12 } = {}) {
  const [bc, bi, bv] = buys, [sc, si, sv, sp] = sells;
  return {
    since: "2025-09-26", until: "2026-09-26", filings, totalFilings: filings, read: filings, partial,
    buys: { count: bc, shares: 0, value: bv, insiders: bi },
    sells: { count: sc, shares: 0, value: sv, insiders: si, planned: sp },
    trades,
  };
}
const trade = (over = {}) => ({ date: "2026-08-20", type: "sell", shares: 111365, price: 90.93, value: 10126419,
  name: "Pietracci Bruno", role: "President, Latin America", planned: false, url: "https://www.sec.gov/x", ...over });

test("the glance line counts buys and sales, with pre-planned sales", () => {
  assert.equal(insiderSummary(null), null);
  assert.deepEqual(insiderSummary(insiders()), { sev: "info", text: "No open-market buys or sales in 12 months" });
  assert.deepEqual(insiderSummary(insiders({ buys: [2, 1, 998671], sells: [31, 11, 255746062, 10] })),
    { sev: "info", text: "2 buys ($998.7K) · 31 sales ($255.7M, 10 pre-planned)" });
  assert.equal(insiderSummary(insiders({ sells: [1, 1, 5e6, 0] })).text, "1 sale ($5.0M)");
});

test("several insiders buying makes the line and a strength; one insider doesn't", () => {
  assert.equal(insiderSummary(insiders({ buys: [2, 2, 10249970] })).sev, "good");
  const flags = (ins) => analyze(company({}, { insiders: ins })).flags.map((f) => f.title);
  assert.ok(flags(insiders({ buys: [2, 2, 10249970] })).includes("Insiders are buying"));
  assert.ok(!flags(insiders({ buys: [2, 1, 998671] })).includes("Insiders are buying"));
  assert.ok(!flags(insiders({ sells: [30, 10, 9e8, 0] })).some((t) => /insider/i.test(t))); // selling is never a flag
  assert.ok(!flags(null).includes("Insiders are buying"));
});

test("the section shows the totals and the latest trades, each linked to its filing", () => {
  const trades = Array.from({ length: 12 }, (_, i) => trade({ planned: i === 0, date: `2026-08-${String(20 - i).padStart(2, "0")}` }));
  const html = insiderView(insiders({ sells: [12, 1, 12e7, 1], trades }), 21344);
  assert.equal((html.match(/data-testid="insider-trade"/g) || []).length, 10);
  assert.match(text(html), /Open-market sales 12 \$120\.0M · 1 insider · 1 pre-planned/);
  assert.match(text(html), /2026-08-20 Pietracci Bruno President, Latin America Sale pre-planned 111,365 \$90\.93 \$10\.1M Form 4 ↗/);
  assert.equal((html.match(/class="tag"/g) || []).length, 1); // only the planned sale is tagged
  assert.match(html, /<td lang="en">/); // names and job titles are quoted from SEC in English
  assert.match(text(html), /The latest 10 trades are shown\./);
  assert.match(html, /own-disp\?action=getissuer&CIK=0000021344/);
});

test("no open-market trades, a partial summary, and text from filings is escaped", () => {
  assert.equal(insiderView(null, 1), "");
  assert.match(text(insiderView(insiders({ filings: 7 }), 1)), /The 7 insider filings in that time were grants, option exercises/);
  const partial = insiderView({ ...insiders({ trades: [trade()] }), partial: true, read: 100, totalFilings: 140 }, 1);
  assert.match(text(partial), /Based on 100 of the 140 insider filings/);
  const odd = insiderView(insiders({ trades: [trade({ name: "<b>X</b>", role: "A & B" })] }), 1);
  assert.match(odd, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.match(odd, /A &amp; B/);
});
