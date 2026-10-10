// Benjamin Graham's defensive-investor criteria, Buffett-style business-quality tests, Peter Lynch's growth-at-a-
// reasonable-price tests and the Piotroski F-score.
// Each row is { name, rule, status: "pass" | "fail" | "na" | "price", actual }.
import { fixed, money, num, pct, perShare } from "./format.js";
import { t } from "./i18n.js";
import { cagr, lastIdx, lastValue, ratio } from "./series.js";

// Owner earnings (free cash flow) per share, discounted: 10 years of growth, then 3% forever, at 10%.
// `assume` ({ g, disc, tg }, as fractions) replaces any of those defaults with the visitor's own numbers.
export function valueChecks(d, price, r, assume = {}) {
  const s = d.series, cur = d.currency, fin = r.financial;
  const m = (v) => money(v, cur), ps = (v) => perShare(v, cur);
  const L = lastValue;
  const vals = (arr) => arr.filter((v) => v != null);
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const tf = (ok) => ok ? "pass" : "fail";
  const row = (id, status, actual, rule = t(`val.${id}.rule`)) => ({ id, name: t(`val.${id}.name`), rule, status, actual });
  const NA_BANK = t("val.naBank"), NOT_REPORTED = t("val.notReported"), ENTER_PRICE = t("val.enterPrice");

  const shares = (d.sharesOutstanding && d.sharesOutstanding.value) || L(s.dilutedShares);
  const eq = L(s.equity), bvps = eq != null && shares ? eq / shares : null;
  const eps = vals(s.eps), eps3 = eps.length >= 3 ? avg(eps.slice(-3)) : null;
  const epsFirst3 = eps.length >= 6 ? avg(eps.slice(0, 3)) : null;
  const latestEps = L(s.eps);
  const pe3 = price && eps3 > 0 ? price / eps3 : null;
  const pb = price && bvps > 0 ? price / bvps : null;
  const grahamNumber = latestEps > 0 && bvps > 0 ? Math.sqrt(22.5 * latestEps * bvps) : null;

  const fcf3 = vals(r.fcf).slice(-3), dil = L(s.dilutedShares);
  const oe = !fin && fcf3.length === 3 && dil ? avg(fcf3) / dil : null;
  const gAuto = Math.min(Math.max(cagr(s.eps) ?? 0, 0), 0.12);
  const g = assume.g ?? gAuto, disc = assume.disc ?? 0.10, tg = assume.tg ?? 0.03;
  let iv = null;
  if (oe > 0 && disc > tg) {  // the formula only works when the discount rate is above the long-term growth
    let x = oe, pv = 0;
    for (let yr = 1; yr <= 10; yr++) { x *= 1 + g; pv += x / Math.pow(1 + disc, yr); }
    iv = pv + (x * (1 + tg)) / (disc - tg) / Math.pow(1 + disc, 10);
  }

  // Each year's tax rate from its own filing (0-50%); a loss year uses the company's average rate instead.
  const pre = s.pretaxIncome || [], tax = s.incomeTax || [];
  const taxRate = s.operatingIncome.map((_, i) => {
    const rate = pre[i] > 0 && tax[i] != null ? tax[i] / pre[i] : null;
    return rate != null && rate >= 0 && rate <= 0.5 ? rate : null;
  });
  const usualRate = avg(vals(taxRate));
  // Return on tangible capital: operating profit after tax (so before interest: "unleveraged") over the capital the
  // business uses, debt + equity - cash, less goodwill and other intangibles from acquisitions
  const intangibles = s.intangibles || [];
  const nopat = s.operatingIncome.map((oi, i) => {
    const rate = taxRate[i] ?? usualRate;
    return oi != null && rate != null ? oi * (1 - rate) : null;
  });
  const tangible = s.equity.map((equity, i) => equity != null
    ? (s.totalDebt[i] ?? 0) + equity - (s.cash[i] ?? 0) - (s.goodwill[i] ?? 0) - (intangibles[i] ?? 0) : null);
  const rotc = nopat.map((n, i) => n != null && tangible[i] > 0 ? n / tangible[i] : null);
  // Over the whole period: total profit / total capital, so one year of thin capital (a cash pile) can't dominate
  const used = rotc.map((x, i) => x == null ? null : i).filter((i) => i != null);
  const rotcOverall = used.length ? used.reduce((a, i) => a + nopat[i], 0) / used.reduce((a, i) => a + tangible[i], 0) : null;

  // Yields at the entered price: the latest dividend and free cash flow per share, as a share of the price
  const dpsL = L(s.dps), fcfL = L(r.fcf), fcfPs = !fin && fcfL != null && shares ? fcfL / shares : null;
  const divYield = price && dpsL != null ? dpsL / price : null;
  const fcfYield = price && fcfPs != null ? fcfPs / price : null;

  // --- Graham ---
  const graham = [];
  const rev = L(s.revenue);
  graham.push(row("size", cur !== "USD" || rev == null ? "na" : tf(rev >= 750e6),
    cur !== "USD" ? t("val.size.foreign", { cur }) : t("val.size.actual", { rev: m(rev) })));
  const cr = L(ratio(s.currentAssets, s.currentLiabilities));
  graham.push(row("current", fin || cr == null ? "na" : tf(cr >= 2),
    fin ? NA_BANK : cr == null ? NOT_REPORTED : t("val.current.actual", { ratio: fixed(cr, 2) })));
  const nca = L(s.currentAssets) != null && L(s.currentLiabilities) != null ? L(s.currentAssets) - L(s.currentLiabilities) : null;
  const ltDebt = L(s.longTermDebt), debt = L(s.totalDebt);
  graham.push(row("debtCovered", fin || nca == null || ltDebt == null ? "na" : tf(ltDebt <= nca),
    fin ? NA_BANK : nca == null ? NOT_REPORTED : ltDebt == null ? t("val.debtCovered.none") : t("val.debtCovered.actual", { debt: m(ltDebt), nca: m(nca) })));
  const ni = vals(s.netIncome), profitable = ni.filter((v) => v > 0).length;
  const profitableYears = t("val.profitableYears", { n: profitable, total: ni.length });
  graham.push(row("stability", ni.length < 5 ? "na" : tf(profitable === ni.length), profitableYears));
  const dps = vals(s.dps), paid = dps.filter((v) => v > 0).length;
  graham.push(row("dividends", dps.length < 5 ? (dps.length ? "na" : "fail") : tf(paid === dps.length),
    dps.length ? t("val.dividends.actual", { n: paid, total: dps.length }) : t("val.dividends.none")));
  const epsGrowth = epsFirst3 > 0 && eps3 != null ? eps3 / epsFirst3 - 1 : null;
  graham.push(row("growth", epsGrowth == null ? "na" : tf(epsGrowth >= 0.33),
    epsGrowth == null ? t("val.growth.none")
      : t(epsGrowth >= 0 ? "val.growth.up" : "val.growth.down", { pct: pct(Math.abs(epsGrowth), 0), from: ps(epsFirst3), to: ps(eps3) })));
  graham.push(row("pe", !price ? "price" : eps3 > 0 ? tf(pe3 <= 15) : "fail",
    !price ? ENTER_PRICE : eps3 > 0 ? t("val.pe.actual", { pe: fixed(pe3, 1) }) : t("val.pe.negative")));
  graham.push(row("pb", !price ? "price" : pb != null && pe3 != null ? tf(pb <= 1.5 || pe3 * pb <= 22.5) : "fail",
    !price ? ENTER_PRICE : pb == null ? t("val.pb.noBook") : pe3 == null ? t("val.pb.noPe", { pb: fixed(pb, 2) })
      : t("val.pb.actual", { pb: fixed(pb, 2), product: fixed(pe3 * pb, 1) })));

  // --- Buffett ---
  const buffett = [];
  const epsG = cagr(s.eps);
  buffett.push(row("consistent", ni.length < 5 ? "na" : tf(profitable === ni.length && epsG != null && epsG >= 0.07),
    t("val.consistent.actual", { n: profitable, total: ni.length,
      growth: epsG == null ? t("val.consistent.noGrowth") : t("val.consistent.growth", { rate: pct(epsG) }) })));
  const roe = ratio(s.netIncome, s.equity), roeV = vals(roe), negEq = vals(s.equity).some((v) => v <= 0);
  const roeAvg = avg(roeV), roeHigh = roeV.filter((v) => v >= 0.15).length;
  buffett.push(row("roe", negEq || !roeV.length ? "na" : tf(roeAvg >= 0.15),
    negEq ? t("val.roe.negative") : t("val.roe.actual", { avg: pct(roeAvg), n: roeHigh, total: roeV.length })));
  // Buffett's own measure (1983 letter): what the business earns, unleveraged, on the tangible capital it needs
  const rotcV = vals(rotc), rotcHigh = rotcV.filter((v) => v >= 0.15).length;
  buffett.push(row("rotc", fin || rotcV.length < 3 ? "na" : tf(rotcOverall >= 0.15),
    fin ? NA_BANK : rotcV.length < 3 ? NOT_REPORTED : t("val.rotc.actual", { avg: pct(rotcOverall), n: rotcHigh, total: rotcV.length })));
  const niL = L(s.netIncome);
  buffett.push(row("debt", fin ? "na" : debt == null ? "na" : niL > 0 ? tf(debt / niL <= 4) : "fail",
    fin ? NA_BANK : debt == null ? t("val.debt.none") : niL > 0 ? t("val.debt.actual", { years: fixed(debt / niL, 1) }) : t("val.debt.loss")));
  const gm = vals(ratio(s.grossProfit, s.revenue)), nm = vals(r.nm);
  const useGross = gm.length >= 3 && !fin;
  const mAvg = avg(useGross ? gm : nm);
  buffett.push(row("moat", mAvg == null ? "na" : tf(mAvg >= (useGross ? 0.4 : 0.1)),
    mAvg == null ? NOT_REPORTED : t(useGross ? "val.moat.gross" : "val.moat.net", { m: pct(mAvg) }),
    t(useGross ? "val.moat.ruleGross" : "val.moat.ruleNet")));
  const capexT = vals(s.capex).reduce((a, b) => a + b, 0), niT = s.netIncome.reduce((a, v, i) => a + (s.capex[i] != null && v != null ? v : 0), 0);
  buffett.push(row("capex", fin || !vals(s.capex).length ? "na" : niT > 0 ? tf(capexT / niT < 0.5) : "fail",
    fin ? NA_BANK : !vals(s.capex).length ? NOT_REPORTED : niT > 0 ? t("val.capex.actual", { pct: pct(capexT / niT, 0) }) : t("val.capex.negative")));
  const sh = vals(s.dilutedShares), shChg = sh.length >= 2 ? sh[sh.length - 1] / sh[0] - 1 : null;
  buffett.push(row("shares", shChg == null ? "na" : tf(shChg <= 0.005),
    shChg == null ? NOT_REPORTED : t(shChg <= 0 ? "val.shares.down" : "val.shares.up", { pct: pct(Math.abs(shChg)) })));
  buffett.push(row("mos", iv == null ? "na" : !price ? "price" : tf(price <= iv * 0.75),
    iv == null ? (fin ? NA_BANK : t("val.mos.noFcf")) : !price ? t("val.mos.needPrice", { iv: ps(iv) })
      : t(price <= iv ? "val.mos.below" : "val.mos.above",
          { price: ps(price), iv: ps(iv), diff: price <= iv ? pct(1 - price / iv, 0) : pct(price / iv - 1, 0) })));

  // --- Peter Lynch (One Up on Wall Street): growth at a reasonable price ---
  // Growth is the EPS growth rate over the last 5 years. Lynch used the growth he expected; the filings can only show
  // past growth, and the rule texts say so. P/E is on the latest annual EPS, as in his examples.
  const lynch = [];
  const lg = cagr(s.eps, 5), lgPct = lg != null ? lg * 100 : null;
  const lynchPe = price && latestEps > 0 ? price / latestEps : null;
  const yieldPct = (divYield ?? 0) * 100;
  // Why a price-based Lynch test can't be worked out, or null when it can
  const lynchNa = lg == null ? t("val.lynch.noGrowth") : !(latestEps > 0) ? t("val.lynch.loss") : null;
  lynch.push(row("lynchGrowth", lg == null ? "na" : tf(lg >= 0.10 && lg <= 0.25),
    lg == null ? t("val.lynch.noGrowth") : t("val.lynchGrowth.actual", { rate: pct(lg) })));
  // Above 25% a year growth rarely lasts, and a ratio built on it would flatter the price: Lynch didn't stretch his
  // rules that far, so the price-based tests are N/A there (the growth test above already fails it)
  const tooFast = lg > 0.25 ? t("val.lynch.tooFast", { rate: pct(lg) }) : null;
  // PEG: the P/E divided by the growth rate in percent; about 1 is fair, below 1 attractive
  const peg = lynchPe != null && lg > 0 ? lynchPe / lgPct : null;
  const shrinking = lg != null && lg <= 0 ? t("val.lynch.shrinking") : null;
  lynch.push(row("lynchPeg", lynchNa || shrinking || tooFast ? "na" : !price ? "price" : tf(peg <= 1),
    lynchNa || shrinking || tooFast || (!price ? ENTER_PRICE : t("val.lynchPeg.actual", { peg: fixed(peg, 2), pe: fixed(lynchPe, 1), g: fixed(lgPct, 1) }))));
  // Dividend-adjusted, his choice for dividend payers: (growth % + dividend yield %) / P/E; 2 is very good, under 1 poor
  const pegy = lynchPe != null && lg != null ? (lgPct + yieldPct) / lynchPe : null;
  lynch.push(row("lynchPegy", lynchNa || tooFast ? "na" : !price ? "price" : tf(pegy >= 1.5),
    lynchNa || tooFast || (!price ? ENTER_PRICE : t("val.lynchPegy.actual", { v: fixed(pegy, 2), g: fixed(lgPct, 1), y: fixed(yieldPct, 1), pe: fixed(lynchPe, 1) }))));
  // Fair P/E = the growth rate, so a fair price of EPS x growth
  const lynchFair = !lynchNa && !shrinking && !tooFast ? latestEps * lgPct : null;
  lynch.push(row("lynchFair", lynchFair == null ? "na" : !price ? "price" : tf(price <= lynchFair),
    lynchNa || shrinking || tooFast || (!price ? t("val.lynchFair.needPrice", { fair: ps(lynchFair) })
      : t(price <= lynchFair ? "val.lynchFair.below" : "val.lynchFair.above",
          { price: ps(price), fair: ps(lynchFair), diff: price <= lynchFair ? pct(1 - price / lynchFair, 0) : pct(price / lynchFair - 1, 0) }))));
  // A normal balance sheet, he wrote, is about 75% equity and 25% debt: debt at most a third of equity
  lynch.push(row("lynchDebt", fin || debt == null || eq == null ? "na" : eq <= 0 ? "fail" : tf(debt / eq <= 1 / 3),
    fin ? NA_BANK : debt == null ? t("val.debt.none") : eq == null ? NOT_REPORTED : eq <= 0 ? t("val.lynchDebt.negative")
      : t("val.lynchDebt.actual", { pct: pct(debt / eq, 0) })));

  // --- Piotroski F-score: nine yes/no tests of the latest year against the year before ---
  const e = lastIdx(s.netIncome), p = e - 1, yr = d.years[e], prevYr = d.years[p];
  const at = (arr, i) => (arr && i >= 0 && arr[i] != null ? arr[i] : null);
  const div = (a, b) => (a != null && b != null && b !== 0 ? a / b : null);
  const startAssets = (i) => at(s.totalAssets, i - 1) ?? at(s.totalAssets, i);  // assets at the start of the year
  const roa = (i) => div(at(s.netIncome, i), startAssets(i));
  const leverage = (i) => at(s.totalAssets, i) != null ? div(at(s.longTermDebt, i) ?? 0, at(s.totalAssets, i)) : null;
  const curRatio = (i) => div(at(s.currentAssets, i), at(s.currentLiabilities, i));
  const grossM = (i) => div(at(s.grossProfit, i), at(s.revenue, i));
  const turnover = (i) => div(at(s.revenue, i), startAssets(i));
  const fRow = (id, ok, actual) => row(`f.${id}`, fin ? "na" : ok == null ? "na" : tf(ok), fin ? NA_BANK : ok == null ? NOT_REPORTED : actual);
  const change = (fmt, now, was) => now == null || was == null ? null : t("val.f.change", { y: yr, now: fmt(now), py: prevYr, was: fmt(was) });
  const both = (now, was, test) => (now == null || was == null ? null : test(now, was));
  const pct1 = (v) => pct(v), x2 = (v) => fixed(v, 2), num0 = (v) => num(v);
  const ocf = at(s.operatingCashFlow, e), niE = at(s.netIncome, e);
  const piotroski = e < 1 ? [] : [
    fRow("roaPositive", roa(e) == null ? null : roa(e) > 0, t("val.f.one", { y: yr, v: pct1(roa(e)) })),
    fRow("cfoPositive", ocf == null ? null : ocf > 0, t("val.f.one", { y: yr, v: m(ocf) })),
    fRow("roaUp", both(roa(e), roa(p), (a, b) => a > b), change(pct1, roa(e), roa(p))),
    fRow("accruals", ocf == null || niE == null ? null : ocf > niE, t("val.f.accruals", { y: yr, cash: m(ocf), ni: m(niE) })),
    fRow("leverageDown", both(leverage(e), leverage(p), (a, b) => a <= b), change(pct1, leverage(e), leverage(p))),
    fRow("currentUp", both(curRatio(e), curRatio(p), (a, b) => a > b), change(x2, curRatio(e), curRatio(p))),
    fRow("noDilution", both(at(s.dilutedShares, e), at(s.dilutedShares, p), (a, b) => a <= b),
      change(num0, at(s.dilutedShares, e), at(s.dilutedShares, p))),
    fRow("grossMarginUp", both(grossM(e), grossM(p), (a, b) => a > b), change(pct1, grossM(e), grossM(p))),
    fRow("turnoverUp", both(turnover(e), turnover(p), (a, b) => a > b), change(x2, turnover(e), turnover(p))),
  ];

  return { graham, buffett, lynch, piotroski, bvps, grahamNumber, iv, oe, g, pe3, pb, disc, tg, gAuto, rotc, rotcOverall, divYield, fcfYield, fcfPs, dpsL, lynchGrowth: lg, peg, pegy, lynchFair };
}
