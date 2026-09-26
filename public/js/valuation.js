// Benjamin Graham's defensive-investor criteria and Buffett-style business-quality tests.
// Each row is { name, rule, status: "pass" | "fail" | "na" | "price", actual }.
import { money, pct, perShare } from "./format.js";
import { cagr, lastValue, ratio } from "./series.js";

// Owner earnings (free cash flow) per share, discounted: 10 years of growth, then 3% forever, at 10%.
export function valueChecks(d, price, r) {
  const s = d.series, cur = d.currency, fin = r.financial;
  const m = (v) => money(v, cur), ps = (v) => perShare(v, cur);
  const L = lastValue;
  const vals = (arr) => arr.filter((v) => v != null);
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const tf = (ok) => ok ? "pass" : "fail";
  const row = (name, rule, status, actual) => ({ name, rule, status, actual });
  const NA_BANK = "Not meaningful for banks and insurers";

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
    for (let t = 1; t <= 10; t++) { x *= 1 + g; pv += x / Math.pow(1 + disc, t); }
    iv = pv + (x * (1 + tg)) / (disc - tg) / Math.pow(1 + disc, 10);
  }

  // --- Graham ---
  const graham = [];
  const rev = L(s.revenue);
  graham.push(row("Adequate size", "Revenue of at least $750M (Graham's $100M from 1972, adjusted for inflation)",
    cur !== "USD" || rev == null ? "na" : tf(rev >= 750e6), cur !== "USD" ? `Reported in ${cur}; USD threshold not applied` : `Revenue ${m(rev)}`));
  const cr = L(ratio(s.currentAssets, s.currentLiabilities));
  graham.push(row("Strong current position", "Current assets at least 2x current liabilities",
    fin || cr == null ? "na" : tf(cr >= 2), fin ? NA_BANK : cr == null ? "Not reported" : `Current ratio ${cr.toFixed(2)}`));
  const nca = L(s.currentAssets) != null && L(s.currentLiabilities) != null ? L(s.currentAssets) - L(s.currentLiabilities) : null;
  const ltDebt = L(s.longTermDebt), debt = L(s.totalDebt);
  graham.push(row("Debt covered by working capital", "Long-term debt no more than net current assets",
    fin || nca == null || ltDebt == null ? "na" : tf(ltDebt <= nca),
    fin ? NA_BANK : nca == null ? "Not reported" : ltDebt == null ? "No long-term debt reported" : `Long-term debt ${m(ltDebt)} vs net current assets ${m(nca)}`));
  const ni = vals(s.netIncome), profitable = ni.filter((v) => v > 0).length;
  graham.push(row("Earnings stability", "Positive earnings every year (Graham asked for 10)",
    ni.length < 5 ? "na" : tf(profitable === ni.length), `Profitable ${profitable} of ${ni.length} years`));
  const dps = vals(s.dps), paid = dps.filter((v) => v > 0).length;
  graham.push(row("Dividend record", "Dividend paid every year (Graham asked for 20; 10 years of data here)",
    dps.length < 5 ? (dps.length ? "na" : "fail") : tf(paid === dps.length), dps.length ? `Paid ${paid} of ${dps.length} years` : "No dividends reported"));
  const epsGrowth = epsFirst3 > 0 && eps3 != null ? eps3 / epsFirst3 - 1 : null;
  graham.push(row("Earnings growth", "3-year average EPS up at least 33% over the decade",
    epsGrowth == null ? "na" : tf(epsGrowth >= 0.33), epsGrowth == null ? "Not enough positive EPS history" : `${epsGrowth >= 0 ? "Up" : "Down"} ${pct(Math.abs(epsGrowth), 0)} (${ps(epsFirst3)} → ${ps(eps3)})`));
  graham.push(row("Moderate P/E", "Price no more than 15x the 3-year average EPS",
    !price ? "price" : eps3 > 0 ? tf(pe3 <= 15) : "fail", !price ? "Enter a price above" : eps3 > 0 ? `P/E ${pe3.toFixed(1)}` : "Average earnings are negative"));
  graham.push(row("Moderate price to book", "P/B at most 1.5, or P/E × P/B at most 22.5",
    !price ? "price" : pb != null && pe3 != null ? tf(pb <= 1.5 || pe3 * pb <= 22.5) : "fail",
    !price ? "Enter a price above" : pb == null ? "Book value is zero or negative" : pe3 == null ? `P/B ${pb.toFixed(2)}; P/E not meaningful` : `P/B ${pb.toFixed(2)} · P/E × P/B ${(pe3 * pb).toFixed(1)}`));

  // --- Buffett ---
  const buffett = [];
  const epsG = cagr(s.eps);
  buffett.push(row("Consistent, growing earnings", "Profitable every year and EPS growing at least 7% a year",
    ni.length < 5 ? "na" : tf(profitable === ni.length && epsG != null && epsG >= 0.07),
    `Profitable ${profitable} of ${ni.length} years · EPS ${epsG == null ? "growth n/a" : pct(epsG) + " a year"}`));
  const roe = ratio(s.netIncome, s.equity), roeV = vals(roe), negEq = vals(s.equity).some((v) => v <= 0);
  const roeAvg = avg(roeV), roeHigh = roeV.filter((v) => v >= 0.15).length;
  buffett.push(row("High return on equity", "Average ROE of at least 15%",
    negEq || !roeV.length ? "na" : tf(roeAvg >= 0.15),
    negEq ? "Equity was zero or negative (often from buybacks), so ROE isn't meaningful" : `Average ${pct(roeAvg)} · 15%+ in ${roeHigh} of ${roeV.length} years`));
  const niL = L(s.netIncome);
  buffett.push(row("Conservative debt", "Debt could be repaid from 4 years of earnings or less",
    fin ? "na" : debt == null ? "na" : niL > 0 ? tf(debt / niL <= 4) : "fail",
    fin ? NA_BANK : debt == null ? "No debt reported" : niL > 0 ? `${(debt / niL).toFixed(1)} years of earnings` : "Latest year was a loss"));
  const gm = vals(ratio(s.grossProfit, s.revenue)), nm = vals(r.nm);
  const useGross = gm.length >= 3 && !fin;
  const mAvg = avg(useGross ? gm : nm);
  buffett.push(row("Durable competitive advantage", useGross ? "Average gross margin of at least 40%" : "Average net margin of at least 10%",
    mAvg == null ? "na" : tf(mAvg >= (useGross ? 0.4 : 0.1)), mAvg == null ? "Not reported" : `Average ${useGross ? "gross" : "net"} margin ${pct(mAvg)}`));
  const capexT = vals(s.capex).reduce((a, b) => a + b, 0), niT = s.netIncome.reduce((a, v, i) => a + (s.capex[i] != null && v != null ? v : 0), 0);
  buffett.push(row("Low capital needs", "Capital spending under 50% of net income",
    fin || !vals(s.capex).length ? "na" : niT > 0 ? tf(capexT / niT < 0.5) : "fail",
    fin ? NA_BANK : !vals(s.capex).length ? "Not reported" : niT > 0 ? `Capex was ${pct(capexT / niT, 0)} of net income` : "Net income was negative overall"));
  const sh = vals(s.dilutedShares), shChg = sh.length >= 2 ? sh[sh.length - 1] / sh[0] - 1 : null;
  buffett.push(row("Shareholder-friendly", "Share count flat or falling (buybacks, no dilution)",
    shChg == null ? "na" : tf(shChg <= 0.005), shChg == null ? "Not reported" : `Shares ${shChg <= 0 ? "down" : "up"} ${pct(Math.abs(shChg))} over the period`));
  buffett.push(row("Margin of safety", "Price at least 25% below the owner-earnings value estimate",
    iv == null ? "na" : !price ? "price" : tf(price <= iv * 0.75),
    iv == null ? (fin ? NA_BANK : "Free cash flow isn't positive, so no estimate") : !price ? `Estimate ${ps(iv)}; enter a price above` : `Price ${ps(price)} vs estimate ${ps(iv)} (${price <= iv ? pct(1 - price / iv, 0) + " below" : pct(price / iv - 1, 0) + " above"})`));

  return { graham, buffett, bvps, grahamNumber, iv, oe, g, pe3, pb, disc, tg };
}
