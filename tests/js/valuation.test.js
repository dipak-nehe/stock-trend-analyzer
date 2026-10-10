import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../../public/js/flags.js";
import { valueChecks } from "../../public/js/valuation.js";
import { YEARS, company, nulls } from "./company.js";

const checks = (d, price = null) => valueChecks(d, price, analyze(d));
const row = (list, name) => list.find((c) => c.name === name);

test("Graham Number is sqrt(22.5 x EPS x book value per share)", () => {
  const d = company();
  const v = checks(d);
  const eps = d.series.eps.at(-1), bvps = d.series.equity.at(-1) / d.sharesOutstanding.value;
  assert.ok(Math.abs(v.grahamNumber - Math.sqrt(22.5 * eps * bvps)) < 1e-9);
  assert.ok(Math.abs(v.bvps - bvps) < 1e-9);
});

test("valuation rows wait for a price, then pass or fail against it", () => {
  const d = company();
  assert.equal(row(checks(d).graham, "Moderate P/E").status, "price");
  const eps3 = d.series.eps.slice(-3).reduce((a, b) => a + b) / 3;
  assert.equal(row(checks(d, eps3 * 14).graham, "Moderate P/E").status, "pass");
  assert.equal(row(checks(d, eps3 * 16).graham, "Moderate P/E").status, "fail");
  assert.match(row(checks(d, eps3 * 16).graham, "Moderate P/E").actual, /P\/E 16\.0/);
});

test("the owner-earnings estimate rises with growth and supports the margin-of-safety test", () => {
  const slow = checks(company({ eps: YEARS.map(() => 1) })).iv;
  const fast = checks(company()).iv;
  assert.ok(fast > slow && slow > 0);
  assert.equal(row(checks(company(), fast * 0.7).buffett, "Margin of safety").status, "pass");
  assert.equal(row(checks(company(), fast * 0.9).buffett, "Margin of safety").status, "fail");
});

test("growth assumption is capped at 12% a year", () => {
  const rocket = company({ eps: YEARS.map((_, i) => Math.pow(1.5, i)) });
  assert.equal(checks(rocket).g, 0.12);
});

test("balance-sheet rules are N/A for banks", () => {
  const bank = company({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: YEARS.map(() => 100e9),
                         totalLiabilities: YEARS.map(() => 90e9), equity: YEARS.map(() => 10e9) });
  const v = checks(bank);
  for (const name of ["Strong current position", "Debt covered by working capital"]) assert.equal(row(v.graham, name).status, "na", name);
  for (const name of ["Conservative debt", "Low capital needs", "Margin of safety"]) assert.equal(row(v.buffett, name).status, "na", name);
});

test("negative equity makes ROE not meaningful rather than a pass", () => {
  const v = checks(company({ equity: YEARS.map((_, i) => (i === 3 ? -5e6 : 1000e6)) }));
  assert.equal(row(v.buffett, "High return on equity").status, "na");
});

test("Graham's debt test uses long-term debt, Buffett's uses total debt", () => {
  const d = company({ longTermDebt: YEARS.map(() => 300e6), totalDebt: YEARS.map(() => 900e6) });
  const v = checks(d);
  assert.match(row(v.graham, "Debt covered by working capital").actual, /Long-term debt \$300\.0M/);
  const years = 900e6 / d.series.netIncome.at(-1);
  assert.match(row(v.buffett, "Conservative debt").actual, new RegExp(`${years.toFixed(1)} years of earnings`));
});

test("size threshold only applies to USD reporters", () => {
  assert.equal(row(checks(company({}, { currency: "TWD" })).graham, "Adequate size").status, "na");
  assert.equal(row(checks(company()).graham, "Adequate size").status, "pass");
});

// ---------- return on tangible capital (Buffett, 1983 letter) ----------
const flat = (v) => YEARS.map(() => v);
const rotcCo = (operatingIncome, extra = {}) => company({
  operatingIncome: flat(operatingIncome), pretaxIncome: flat(100e6), incomeTax: flat(25e6),   // 25% tax
  totalDebt: flat(300e6), equity: flat(1000e6), cash: flat(100e6),
  goodwill: flat(100e6), intangibles: flat(100e6), ...extra,                                    // tangible capital 1,000M
});
const ROTC = "High return on tangible capital";

test("return on tangible capital is after-tax operating profit over debt + equity - cash - goodwill - intangibles", () => {
  for (const x of checks(rotcCo(200e6)).rotc) assert.ok(Math.abs(x - 0.15) < 1e-12);  // 200M x (1 - 25%) / 1,000M
  const v = checks(rotcCo(220e6));  // 16.5%
  assert.equal(row(v.buffett, ROTC).status, "pass");
  assert.match(row(v.buffett, ROTC).actual, /Overall 16\.5% · 15%\+ in 10 of 10 years/);
  assert.equal(row(checks(rotcCo(100e6)).buffett, ROTC).status, "fail");  // 7.5%
});

test("goodwill and other intangibles from acquisitions don't count as capital the business needs", () => {
  const tangible = checks(rotcCo(200e6)).rotc[0];
  const withPremium = checks(rotcCo(200e6, { goodwill: flat(0), intangibles: flat(0) })).rotc[0];  // capital 1,200M
  assert.ok(Math.abs(withPremium - 0.125) < 1e-12);
  assert.ok(tangible > withPremium);
});

test("one year of thin capital (a cash pile) can't dominate the overall return", () => {
  // 2020: cash jumps to 1,050M, leaving 50M of tangible capital and a 300% return for that one year
  const v = checks(rotcCo(200e6, { cash: YEARS.map((y) => (y === 2020 ? 1050e6 : 100e6)) }));
  assert.ok(Math.abs(v.rotc[4] - 3) < 1e-9);
  assert.ok(Math.abs(v.rotcOverall - (150e6 * 10) / (1000e6 * 9 + 50e6)) < 1e-12);  // about 16.6%, not a 43% average
});

test("a loss year's tax rate is replaced by the company's usual rate", () => {
  const v = checks(rotcCo(200e6, { pretaxIncome: YEARS.map((_, i) => (i === 4 ? -50e6 : 100e6)) }));
  assert.ok(Math.abs(v.rotc[4] - 0.15) < 1e-12);  // the other years' 25%, not a meaningless negative rate
});

test("return on tangible capital is not reported without tax figures and N/A for banks", () => {
  const none = checks(company({ pretaxIncome: undefined, incomeTax: undefined }));
  assert.equal(row(none.buffett, ROTC).status, "na");
  assert.equal(row(none.buffett, ROTC).actual, "Not reported");
  const bank = company({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: flat(100e9),
                         totalLiabilities: flat(90e9), equity: flat(10e9) });
  assert.equal(row(checks(bank).buffett, ROTC).actual, "Not meaningful for banks and insurers");
});

// ---------- yields at the entered price ----------
test("dividend and free-cash-flow yields use the latest year and need a price", () => {
  const d = company();
  assert.equal(checks(d).divYield, null);
  const v = checks(d, 20);
  assert.ok(Math.abs(v.divYield - d.series.dps.at(-1) / 20) < 1e-12);
  const fcf = d.series.operatingCashFlow.at(-1) - d.series.capex.at(-1);
  assert.ok(Math.abs(v.fcfYield - fcf / d.sharesOutstanding.value / 20) < 1e-12);
});

// ---------- Peter Lynch: growth at a reasonable price ----------
const growing = (rate, start = 1.5) => YEARS.map((_, i) => start * Math.pow(1 + rate, i));  // EPS growing at `rate`
const lynchRow = (d, name, price = null) => row(checks(d, price).lynch, name);

test("Lynch's growth test wants 10-25% EPS growth a year over the last 5 years", () => {
  assert.equal(lynchRow(company({ eps: growing(0.15) }), "Earnings growing 10-25% a year").status, "pass");
  assert.match(lynchRow(company({ eps: growing(0.15) }), "Earnings growing 10-25% a year").actual, /EPS grew 15\.0% a year/);
  assert.equal(lynchRow(company({ eps: growing(0.05) }), "Earnings growing 10-25% a year").status, "fail");
  assert.equal(lynchRow(company({ eps: growing(0.40) }), "Earnings growing 10-25% a year").status, "fail");  // rarely lasts
  // Only the last 5 years count: a slump before them doesn't matter
  const recovered = company({ eps: YEARS.map((_, i) => (i < 4 ? 5 - i : Math.pow(1.15, i - 4))) });
  assert.equal(checks(recovered).lynchGrowth.toFixed(4), "0.1500");
  // A loss at the start of the 5 years leaves no growth rate
  const fromLoss = company({ eps: YEARS.map((_, i) => (i === 4 ? -1 : 1 + i)) });
  assert.equal(lynchRow(fromLoss, "Earnings growing 10-25% a year").status, "na");
});

test("the PEG ratio is the P/E on the latest EPS divided by the growth rate, and needs a price", () => {
  const d = company({ eps: growing(0.15) }), eps = d.series.eps.at(-1);
  assert.equal(lynchRow(d, "PEG ratio").status, "price");
  const fair = lynchRow(d, "PEG ratio", eps * 15);                      // P/E 15, growth 15%: PEG 1
  assert.equal(lynchRow(d, "PEG ratio", eps * 14.5).status, "pass");     // PEG 0.97
  assert.match(fair.actual, /PEG 1\.00: P\/E 15\.0 ÷ growth 15\.0/);
  assert.equal(lynchRow(d, "PEG ratio", eps * 20).status, "fail");        // PEG 1.33
  assert.equal(lynchRow(company({ eps: growing(-0.05) }), "PEG ratio", 10).status, "na");  // shrinking earnings
  // Growth above 25% would make almost any price look cheap: N/A, not a flattering pass
  const fast = company({ eps: growing(0.40) });
  assert.equal(lynchRow(fast, "PEG ratio", 10).status, "na");
  assert.match(lynchRow(fast, "PEG ratio", 10).actual, /above 25%, which rarely lasts/);
  assert.equal(lynchRow(fast, "Growth plus dividend yield against the P/E", 10).status, "na");
});

test("the dividend-adjusted measure adds the yield to growth and divides by the P/E", () => {
  const d = company({ eps: growing(0.10), dps: YEARS.map(() => 1) }), eps = d.series.eps.at(-1);
  const price = eps * 8;                                     // P/E 8
  const v = checks(d, price), expected = (10 + (1 / price) * 100) / 8;
  assert.ok(Math.abs(v.pegy - expected) < 1e-9);
  assert.equal(row(v.lynch, "Growth plus dividend yield against the P/E").status, expected >= 1.5 ? "pass" : "fail");
  assert.equal(lynchRow(d, "Growth plus dividend yield against the P/E", eps * 30).status, "fail");  // (10 + ~0) / 30
  assert.equal(lynchRow(d, "Growth plus dividend yield against the P/E").status, "price");
});

test("Lynch's fair value is EPS x growth rate; it isn't stretched to growth above 25% or used for losses", () => {
  const d = company({ eps: growing(0.15) }), eps = d.series.eps.at(-1), fairValue = eps * 15;
  assert.ok(Math.abs(checks(d).lynchFair - fairValue) < 1e-9);
  assert.match(lynchRow(d, "Price below Lynch's fair value").actual, /Fair value \$\d+\.\d\d; enter a price above/);
  assert.equal(lynchRow(d, "Price below Lynch's fair value", fairValue * 0.9).status, "pass");
  assert.match(lynchRow(d, "Price below Lynch's fair value", fairValue * 0.9).actual, /\(10% below\)/);
  assert.equal(lynchRow(d, "Price below Lynch's fair value", fairValue * 1.2).status, "fail");
  const fast = lynchRow(company({ eps: growing(0.30) }), "Price below Lynch's fair value", 100);
  assert.equal(fast.status, "na");
  assert.match(fast.actual, /above 25%/);
  const loss = company({ eps: YEARS.map((_, i) => (i === 9 ? -0.5 : 1 + i)) });
  assert.equal(lynchRow(loss, "Price below Lynch's fair value", 10).status, "na");
  assert.equal(lynchRow(loss, "PEG ratio", 10).status, "na");
});

test("a normal balance sheet has debt of at most a third of equity; N/A for banks", () => {
  const ok = company(), equity = ok.series.equity.at(-1);
  assert.equal(lynchRow(ok, "A normal balance sheet").status, "pass");
  assert.match(lynchRow(ok, "A normal balance sheet").actual, new RegExp(`Debt is ${Math.round(300e6 / equity * 100)}% of equity`));
  assert.equal(lynchRow(company({ totalDebt: YEARS.map(() => 800e6) }), "A normal balance sheet").status, "fail");
  assert.equal(lynchRow(company({ equity: YEARS.map(() => -5e6) }), "A normal balance sheet").status, "fail");
  const bank = company({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: YEARS.map(() => 100e9),
                         totalLiabilities: YEARS.map(() => 90e9), equity: YEARS.map(() => 10e9) });
  assert.equal(lynchRow(bank, "A normal balance sheet").status, "na");
});

// ---------- Piotroski F-score ----------
const fscore = (v) => v.piotroski.filter((c) => c.status === "pass").length;

test("a steadily improving company scores 9 of 9 on the Piotroski tests", () => {
  const up = (start, rate) => YEARS.map((_, i) => start * Math.pow(1 + rate, i));
  const d = company({
    netIncome: up(100e6, 0.15), operatingCashFlow: up(150e6, 0.15), totalAssets: up(2000e6, 0.03),
    longTermDebt: up(300e6, -0.05), currentAssets: up(600e6, 0.05), currentLiabilities: flat(250e6),
    dilutedShares: up(100e6, -0.01), grossProfit: up(400e6, 0.10), revenue: up(1000e6, 0.08),
  });
  const v = checks(d);
  assert.equal(v.piotroski.length, 9);
  assert.equal(fscore(v), 9);
  assert.match(row(v.piotroski, "No new shares").actual, /^2025: .* · 2024: /);
});

test("each Piotroski test fails on its own warning sign", () => {
  const last = (arr, v) => arr.map((x, i) => (i === arr.length - 1 ? v : x));
  const base = company();
  const fails = (overrides, name) => assert.equal(row(checks(company(overrides)).piotroski, name).status, "fail", name);
  fails({ netIncome: last(base.series.netIncome, -1e6) }, "Profitable");
  fails({ operatingCashFlow: last(base.series.operatingCashFlow, -1e6) }, "Cash-generating");
  fails({ operatingCashFlow: last(base.series.operatingCashFlow, 1e6) }, "Earnings backed by cash");
  fails({ longTermDebt: last(base.series.longTermDebt, 900e6) }, "Debt not rising");
  fails({ currentAssets: last(base.series.currentAssets, 300e6) }, "Better liquidity");
  fails({ dilutedShares: last(base.series.dilutedShares, 120e6) }, "No new shares");
  fails({ grossProfit: last(base.series.grossProfit, 100e6) }, "Better gross margin");
});

test("Piotroski tests without the figures they need are not reported, and all are N/A for banks", () => {
  assert.equal(row(checks(company({ grossProfit: nulls() })).piotroski, "Better gross margin").actual, "Not reported");
  const bank = company({ currentAssets: nulls(), currentLiabilities: nulls(), totalAssets: flat(100e9),
                         totalLiabilities: flat(90e9), equity: flat(10e9) });
  assert.ok(checks(bank).piotroski.every((c) => c.status === "na"));
});

// ---------- the visitor's own value-estimate assumptions ----------
test("the value estimate uses the visitor's growth, discount and long-term rates in place of the defaults", () => {
  const d = company(), r = analyze(d);
  const base = valueChecks(d, null, r);
  assert.equal(base.disc, 0.10); assert.equal(base.tg, 0.03); assert.equal(base.g, base.gAuto);
  assert.ok(valueChecks(d, null, r, { g: base.g + 0.05 }).iv > base.iv);        // faster growth, higher value
  assert.ok(valueChecks(d, null, r, { disc: 0.15 }).iv < base.iv);              // a higher discount rate, lower value
  assert.ok(valueChecks(d, null, r, { tg: 0.05 }).iv > base.iv);                // more growth after year 10, higher value
  const own = valueChecks(d, null, r, { g: 0.05, disc: 0.09, tg: 0.02 });
  assert.equal(own.g, 0.05); assert.equal(own.disc, 0.09); assert.equal(own.tg, 0.02);
});

test("the margin-of-safety test follows the visitor's value estimate", () => {
  const d = company(), r = analyze(d);
  const own = valueChecks(d, null, r, { g: 0.0, disc: 0.12 });
  assert.equal(row(valueChecks(d, own.iv * 0.7, r, { g: 0.0, disc: 0.12 }).buffett, "Margin of safety").status, "pass");
  assert.equal(row(valueChecks(d, own.iv * 0.9, r, { g: 0.0, disc: 0.12 }).buffett, "Margin of safety").status, "fail");
});

test("a discount rate not above the long-term growth gives no value estimate rather than a nonsense one", () => {
  const d = company(), r = analyze(d);
  assert.equal(valueChecks(d, null, r, { disc: 0.03, tg: 0.03 }).iv, null);
  assert.equal(valueChecks(d, null, r, { disc: 0.02, tg: 0.03 }).iv, null);
});

