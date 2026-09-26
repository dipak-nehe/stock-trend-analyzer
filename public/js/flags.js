// Red-flag rules: turn ten years of financials and the SEC filing record into
// critical / warning / strength / info findings.
import { fixed, money, pct } from "./format.js";
import { has, t, tn } from "./i18n.js";
import { cagr, lastN, lastValue, ratio, yoy } from "./series.js";
import { labelOf } from "./labels.js";

// Returns { flags, fcf, nm, financial }: fcf (free cash flow) and nm (net margin) are reused by other views.
export function analyze(d) {
  const s = d.series, Y = d.years, cur = d.currency, flags = [];
  // Each flag: { id, sev, title, why, help }; the text comes from strings/<lang>.js under flag.<id>.
  const add = (sev, id, why) => flags.push({ id, sev, title: t(`flag.${id}.title`), why, help: has(`flag.${id}.help`) ? t(`flag.${id}.help`) : null });
  const say = (id, vars, variant = "why") => t(`flag.${id}.${variant}`, vars);
  const L = lastValue;

  // Banks & insurers don't report current assets/liabilities; leverage rules differ.
  const liabToAssets = L(s.totalLiabilities) / L(s.totalAssets);
  const financial = s.currentAssets.every((v) => v == null) && liabToAssets > 0.8;
  if (financial) add("info", "bank", say("bank"));

  // Revenue
  const revG = cagr(s.revenue), revY = yoy(s.revenue);
  const revDown5 = revY.slice(-5).filter((v) => v != null && v < 0).length;
  if (revG != null && revG < -0.03) add("critical", "revShrinking", say("revShrinking", { rate: pct(-revG) }));
  else if (revG != null && revG < 0) add("warning", "revSlightlyLower", say("revSlightlyLower", { rate: pct(-revG) }));
  else if (revDown5 >= 3) add("warning", "revInconsistent", say("revInconsistent", { n: revDown5 }));
  else if (revY.filter((v) => v != null).length >= 5 && revY.filter((v) => v != null && v < 0).length <= 1 && revG > 0.03)
    add("good", "revConsistent", say("revConsistent", { rate: pct(revG) }));

  // Profitability
  const lossYears = Y.filter((_, i) => s.netIncome[i] != null && s.netIncome[i] < 0);
  const recentLoss = s.netIncome.slice(-3).some((v) => v != null && v < 0);
  if (recentLoss) add("critical", "recentLosses", say("recentLosses", { years: lossYears.join(", ") }));
  else if (lossYears.length) add("warning", "pastLosses", say("pastLosses", { years: lossYears.join(", ") }));
  else if (s.netIncome.filter((v) => v != null).length >= 5) add("good", "profitable", say("profitable"));

  const nm = ratio(s.netIncome, s.revenue);
  const nmRecent = L(nm), nmAvg = lastN(nm, 6).slice(0, -1);
  if (nmRecent != null && nmAvg.length >= 3) {
    const avg = nmAvg.reduce((a, b) => a + b, 0) / nmAvg.length;
    if (avg > 0 && nmRecent < avg * 0.7) add("warning", "marginShrinking", say("marginShrinking", { latest: pct(nmRecent), avg: pct(avg) }));
  }

  const epsG5 = cagr(s.eps, 5);
  if (epsG5 != null && epsG5 < -0.03) add("warning", "epsFalling", say("epsFalling", { rate: pct(-epsG5) }));

  // Leverage & liquidity (non-financials)
  const eq = L(s.equity);
  if (eq != null && eq < 0) add(financial ? "warning" : "critical", "negativeEquity", say("negativeEquity"));
  if (!financial) {
    const de = ratio(s.totalDebt, s.equity), deL = L(de);
    if (eq > 0 && deL != null) {
      if (deL > 2) add("critical", "debtVeryHigh", say("debtVeryHigh", { ratio: fixed(deL, 2) }));
      else if (deL > 1) add("warning", "debtElevated", say("debtElevated", { ratio: fixed(deL, 2) }));
      else if (deL < 0.5) add("good", "lowLeverage", say("lowLeverage", { ratio: fixed(deL, 2) }));
    }
    const debtG = cagr(s.totalDebt, 5), revG5 = cagr(s.revenue, 5);
    if (debtG != null && revG5 != null && debtG - revG5 > 0.08 && (deL == null || deL > 0.5))
      add("warning", "debtFaster", say("debtFaster", { debt: pct(debtG), rev: pct(revG5) }));
    const cr = ratio(s.currentAssets, s.currentLiabilities), crL = L(cr);
    if (crL != null) {
      if (crL < 0.8) add("critical", "liquidityWeak", say("liquidityWeak", { ratio: fixed(crL, 2) }));
      else if (crL < 1) add("warning", "currentRatioLow", say("currentRatioLow", { ratio: fixed(crL, 2) }));
    }
    const cov = ratio(s.operatingIncome, s.interestExpense), covL = L(cov);
    if (covL != null && L(s.interestExpense) > 0) {
      if (covL < 0) add("critical", "interestNotCovered", say("interestNotCovered"));
      else if (covL < 1.5) add("critical", "interestBarely", say("interestBarely", { cov: fixed(covL, 1) }));
      else if (covL < 3) add("warning", "interestThin", say("interestThin", { cov: fixed(covL, 1) }));
    }
    const cash = L(s.cash), debt = L(s.totalDebt);
    if (cash != null && debt != null && cash > debt) add("good", "netCash", say("netCash", { cash: money(cash, cur), debt: money(debt, cur) }));
  }

  // Earnings quality
  const ocf5 = lastN(s.operatingCashFlow, 5), ni5 = lastN(s.netIncome, 5);
  const weakYears = Y.slice(-5).filter((_, k) => {
    const i = Y.length - 5 + k; return s.operatingCashFlow[i] != null && s.netIncome[i] > 0 && s.operatingCashFlow[i] < s.netIncome[i];
  });
  if (!financial && ocf5.length >= 3 && ni5.length >= 3) {
    const sumO = ocf5.reduce((a, b) => a + b, 0), sumN = ni5.reduce((a, b) => a + b, 0);
    if (weakYears.length >= 3) add("warning", "earningsNotCash", say("earningsNotCash", { years: weakYears.join(", ") }));
    else if (ni5.length >= 5 && ni5.every((v) => v > 0) && sumO / sumN > 1.1) add("good", "earningsQuality", say("earningsQuality", { x: fixed(sumO / sumN, 1) }));
  }
  const fcf = s.operatingCashFlow.map((o, i) => o != null && s.capex[i] != null ? o - s.capex[i] : null);
  const negFcf = fcf.slice(-3).filter((v) => v != null && v < 0).length;
  if (!financial && negFcf >= 2) add("warning", "negativeFcf", say("negativeFcf", { n: negFcf }));

  const rec = cagr(s.receivables, 5), inv = cagr(s.inventory, 5), rev5 = cagr(s.revenue, 5);
  if (rec != null && rev5 != null && rec - rev5 > 0.10) add("warning", "receivables", say("receivables", { rec: pct(rec), rev: pct(rev5) }));
  if (inv != null && rev5 != null && inv - rev5 > 0.10) add("warning", "inventory", say("inventory", { inv: pct(inv), rev: pct(rev5) }));

  const gwA = L(s.goodwill) / L(s.totalAssets), gwE = L(s.goodwill) / eq;
  if (isFinite(gwA) && !financial && (gwA > 0.4 || (eq > 0 && gwE > 1)))
    add("warning", "goodwill", say("goodwill", { assets: pct(gwA, 0), equity: pct(gwE, 0) }, eq > 0 ? "whyEquity" : "why"));

  // Dilution
  const shG = cagr(s.dilutedShares, 5);
  if (shG != null) {
    if (shG > 0.02) add("warning", "dilution", say("dilution", { rate: pct(shG) }));
    else if (shG < -0.01) add("good", "buybacks", say("buybacks", { rate: pct(-shG) }));
  }

  // Dividends
  const dps = s.dps, hasDiv = dps.some((v) => v > 0);
  if (hasDiv) {
    const cuts = Y.filter((_, i) => i && dps[i] != null && dps[i - 1] > 0 && dps[i] < dps[i - 1] * 0.9);
    const suspended = L(dps) === 0;
    const cutId = suspended ? "dividendSuspended" : "dividendCut";
    if (cuts.length) add(cuts.some((y) => y >= Y[Y.length - 3]) ? "critical" : "warning", cutId, say(cutId, { years: cuts.join(", ") }));
    const payout = ratio(s.dividendsPaid, s.netIncome), pL = L(payout);
    if (pL != null && (pL > 1 || pL < 0)) add("critical", "dividendExceeds", say("dividendExceeds", { payout: pct(pL, 0) }, pL < 0 ? "whyLoss" : "why"));
    else if (pL != null && pL > 0.8 && !financial) add("warning", "highPayout", say("highPayout", { payout: pct(pL, 0) }));
    const uncovered = fcf.slice(-3).map((f, k) => { const i = Y.length - 3 + k; return f != null && s.dividendsPaid[i] != null && s.dividendsPaid[i] > f; }).filter(Boolean).length;
    if (!financial && uncovered >= 2) add("warning", "dividendUncovered", say("dividendUncovered", { n: uncovered }));
    const streak = (() => { let n = 0; for (let i = dps.length - 1; i > 0; i--) { if (dps[i] != null && dps[i - 1] != null && dps[i] > dps[i - 1]) n++; else break; } return n; })();
    if (!cuts.length && streak >= 5) add("good", "growingDividend", say("growingDividend", { n: streak, rate: pct(cagr(dps)) }));
  }

  // SEC filing record
  const h = d.secHistory;
  if (h) {
    const on = (type) => h.events.filter((e) => e.type === type).map((e) => e.date);
    const nr = on("non_reliance"), ac = on("auditor_change"), lf = on("late_filing");
    const since = h.since.slice(0, 4);
    if (nr.length) add("critical", "restated", say("restated", { dates: nr.join(", ") }));
    if (ac.length) add("warning", "auditorChanged", say("auditorChanged", { dates: ac.join(", ") }));
    if (lf.length) add(lf.length >= 3 ? "critical" : "warning", "lateFilings", tn("flag.lateFilings.why", lf.length, { since, latest: lf[0] }));
    if (!nr.length && !ac.length && !lf.length) add("good", "cleanRecord", say("cleanRecord", { since }));
  }

  // Data coverage
  const gaps = ["revenue", "netIncome", "totalAssets", "totalLiabilities", "equity", "operatingCashFlow"].filter((k) => s[k].filter((v) => v == null).length > 2);
  if (gaps.length) add("info", "dataMissing", say("dataMissing", { items: gaps.map(labelOf).join(", ") }));

  const order = { critical: 0, warning: 1, good: 2, info: 3 };
  flags.sort((a, b) => order[a.sev] - order[b.sev]);
  return { flags, fcf, nm, financial };
}
