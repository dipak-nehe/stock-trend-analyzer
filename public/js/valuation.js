// Benjamin Graham's defensive-investor criteria and Buffett-style business-quality tests.
// Each row is { name, rule, status: "pass" | "fail" | "na" | "price", actual }.
import { fixed, money, pct, perShare } from "./format.js";
import { t } from "./i18n.js";
import { cagr, lastValue, ratio } from "./series.js";

// Owner earnings (free cash flow) per share, discounted: 10 years of growth, then 3% forever, at 10%.
export function valueChecks(d, price, r) {
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
  const g = Math.min(Math.max(cagr(s.eps) ?? 0, 0), 0.12), disc = 0.10, tg = 0.03;
  let iv = null;
  if (oe > 0) {
    let x = oe, pv = 0;
    for (let yr = 1; yr <= 10; yr++) { x *= 1 + g; pv += x / Math.pow(1 + disc, yr); }
    iv = pv + (x * (1 + tg)) / (disc - tg) / Math.pow(1 + disc, 10);
  }

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

  return { graham, buffett, bvps, grahamNumber, iv, oe, g, pe3, pb, disc, tg };
}
