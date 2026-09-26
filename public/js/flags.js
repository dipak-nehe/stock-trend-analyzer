// Red-flag rules: turn ten years of financials and the SEC filing record into
// critical / warning / strength / info findings.
import { money, pct } from "./format.js";
import { cagr, lastN, lastValue, ratio, yoy } from "./series.js";
import { labelOf } from "./labels.js";

// Returns { flags, fcf, nm, financial }: fcf (free cash flow) and nm (net margin) are reused by other views.
export function analyze(d) {
  const s = d.series, Y = d.years, cur = d.currency, flags = [];
  const add = (sev, title, why) => flags.push({ sev, title, why });
  const L = lastValue;

  // Banks & insurers don't report current assets/liabilities; leverage rules differ.
  const liabToAssets = L(s.totalLiabilities) / L(s.totalAssets);
  const financial = s.currentAssets.every((v) => v == null) && liabToAssets > 0.8;
  if (financial) add("info", "Looks like a bank or insurer", "No classified balance sheet and liabilities are over 80% of assets. High leverage is normal here, so debt and liquidity rules are skipped.");

  // Revenue
  const revG = cagr(s.revenue), revY = yoy(s.revenue);
  const revDown5 = revY.slice(-5).filter((v) => v != null && v < 0).length;
  if (revG != null && revG < -0.03) add("critical", "Revenue is shrinking", `Revenue fell ${pct(-revG)} a year on average across the period.`);
  else if (revG != null && revG < 0) add("warning", "Revenue slightly lower than 10 years ago", `Revenue fell ${pct(-revG)} a year on average across the period.`);
  else if (revDown5 >= 3) add("warning", "Revenue is inconsistent", `Revenue fell in ${revDown5} of the last 5 years.`);
  else if (revY.filter((v) => v != null).length >= 5 && revY.filter((v) => v != null && v < 0).length <= 1 && revG > 0.03)
    add("good", "Consistent revenue growth", `Revenue rose in almost every year (${pct(revG)} a year).`);

  // Profitability
  const lossYears = Y.filter((_, i) => s.netIncome[i] != null && s.netIncome[i] < 0);
  const recentLoss = s.netIncome.slice(-3).some((v) => v != null && v < 0);
  if (recentLoss) add("critical", "Recent net losses", `Net loss in: ${lossYears.join(", ")}.`);
  else if (lossYears.length) add("warning", "Past net losses", `Loss years: ${lossYears.join(", ")}. Profitable in the last 3 years.`);
  else if (s.netIncome.filter((v) => v != null).length >= 5) add("good", "Profitable every year", "No net loss across the period.");

  const nm = ratio(s.netIncome, s.revenue);
  const nmRecent = L(nm), nmAvg = lastN(nm, 6).slice(0, -1);
  if (nmRecent != null && nmAvg.length >= 3) {
    const avg = nmAvg.reduce((a, b) => a + b, 0) / nmAvg.length;
    if (avg > 0 && nmRecent < avg * 0.7) add("warning", "Profit margin is shrinking", `Latest net margin ${pct(nmRecent)} vs the prior 5-year average of ${pct(avg)}.`);
  }

  const epsG5 = cagr(s.eps, 5);
  if (epsG5 != null && epsG5 < -0.03) add("warning", "EPS falling over 5 years", `Diluted EPS down ${pct(-epsG5)} a year over the last 5 years.`);

  // Leverage & liquidity (non-financials)
  const eq = L(s.equity);
  if (eq != null && eq < 0) add(financial ? "warning" : "critical", "Negative shareholders' equity",
    "Liabilities exceed assets. This can come from heavy buybacks (as at some mature consumer brands) but also means no balance-sheet cushion.");
  if (!financial) {
    const de = ratio(s.totalDebt, s.equity), deL = L(de);
    if (eq > 0 && deL != null) {
      if (deL > 2) add("critical", "Very high debt vs equity", `Debt/equity is ${deL.toFixed(2)}x.`);
      else if (deL > 1) add("warning", "Elevated debt vs equity", `Debt/equity is ${deL.toFixed(2)}x.`);
      else if (deL < 0.5) add("good", "Low leverage", `Debt/equity is ${deL.toFixed(2)}x.`);
    }
    const debtG = cagr(s.totalDebt, 5), revG5 = cagr(s.revenue, 5);
    if (debtG != null && revG5 != null && debtG - revG5 > 0.08 && (deL == null || deL > 0.5))
      add("warning", "Debt growing faster than revenue", `Debt up ${pct(debtG)} a year vs revenue ${pct(revG5)} a year (last 5 years).`);
    const cr = ratio(s.currentAssets, s.currentLiabilities), crL = L(cr);
    if (crL != null) {
      if (crL < 0.8) add("critical", "Weak short-term liquidity", `Current ratio is ${crL.toFixed(2)}: current liabilities exceed current assets.`);
      else if (crL < 1) add("warning", "Current ratio below 1", `Current ratio is ${crL.toFixed(2)}.`);
    }
    const cov = ratio(s.operatingIncome, s.interestExpense), covL = L(cov);
    if (covL != null && L(s.interestExpense) > 0) {
      if (covL < 0) add("critical", "Interest not covered", "The company had an operating loss, so operations did not cover interest costs.");
      else if (covL < 1.5) add("critical", "Interest barely covered", `Operating income covers interest only ${covL.toFixed(1)}x.`);
      else if (covL < 3) add("warning", "Thin interest coverage", `Operating income covers interest ${covL.toFixed(1)}x (under 3x is tight).`);
    }
    const cash = L(s.cash), debt = L(s.totalDebt);
    if (cash != null && debt != null && cash > debt) add("good", "Net cash position", `Cash (${money(cash, cur)}) exceeds debt (${money(debt, cur)}).`);
  }

  // Earnings quality
  const ocf5 = lastN(s.operatingCashFlow, 5), ni5 = lastN(s.netIncome, 5);
  const weakYears = Y.slice(-5).filter((_, k) => {
    const i = Y.length - 5 + k; return s.operatingCashFlow[i] != null && s.netIncome[i] > 0 && s.operatingCashFlow[i] < s.netIncome[i];
  });
  if (!financial && ocf5.length >= 3 && ni5.length >= 3) {
    const sumO = ocf5.reduce((a, b) => a + b, 0), sumN = ni5.reduce((a, b) => a + b, 0);
    if (weakYears.length >= 3) add("warning", "Earnings not backed by cash", `Operating cash flow was below net income in ${weakYears.join(", ")}. Could point to aggressive accounting or rising working capital.`);
    else if (ni5.length >= 5 && ni5.every((v) => v > 0) && sumO / sumN > 1.1) add("good", "High-quality earnings", `5-year operating cash flow is ${(sumO / sumN).toFixed(1)}x net income.`);
  }
  const fcf = s.operatingCashFlow.map((o, i) => o != null && s.capex[i] != null ? o - s.capex[i] : null);
  const negFcf = fcf.slice(-3).filter((v) => v != null && v < 0).length;
  if (!financial && negFcf >= 2) add("warning", "Negative free cash flow", `Free cash flow was negative in ${negFcf} of the last 3 years.`);

  const rec = cagr(s.receivables, 5), inv = cagr(s.inventory, 5), rev5 = cagr(s.revenue, 5);
  if (rec != null && rev5 != null && rec - rev5 > 0.10) add("warning", "Receivables outpacing sales", `Receivables up ${pct(rec)} a year vs revenue ${pct(rev5)} a year. Customers may be paying slower, or sales may be pulled forward.`);
  if (inv != null && rev5 != null && inv - rev5 > 0.10) add("warning", "Inventory building up", `Inventory up ${pct(inv)} a year vs revenue ${pct(rev5)} a year.`);

  const gwA = L(s.goodwill) / L(s.totalAssets), gwE = L(s.goodwill) / eq;
  if (isFinite(gwA) && !financial && (gwA > 0.4 || (eq > 0 && gwE > 1)))
    add("warning", "Large goodwill balance", `Goodwill is ${pct(gwA, 0)} of assets${eq > 0 ? ` and ${pct(gwE, 0)} of equity` : ""}. Write-downs could hit equity.`);

  // Dilution
  const shG = cagr(s.dilutedShares, 5);
  if (shG != null) {
    if (shG > 0.02) add("warning", "Shareholder dilution", `Diluted share count up ${pct(shG)} a year over 5 years.`);
    else if (shG < -0.01) add("good", "Share buybacks", `Share count down ${pct(-shG)} a year over 5 years.`);
  }

  // Dividends
  const dps = s.dps, hasDiv = dps.some((v) => v > 0);
  if (hasDiv) {
    const cuts = Y.filter((_, i) => i && dps[i] != null && dps[i - 1] > 0 && dps[i] < dps[i - 1] * 0.9);
    const suspended = L(dps) === 0;
    if (cuts.length) add(cuts.some((y) => y >= Y[Y.length - 3]) ? "critical" : "warning", suspended ? "Dividend cut, then suspended" : "Dividend cut",
      `Dividend per share dropped over 10% in ${cuts.join(", ")}${suspended ? " and is now zero" : ""}.`);
    const payout = ratio(s.dividendsPaid, s.netIncome), pL = L(payout);
    if (pL != null && (pL > 1 || pL < 0)) add("critical", "Dividend exceeds earnings", `Dividends paid were ${pL < 0 ? "paid despite a loss" : pct(pL, 0) + " of net income"} in the latest year.`);
    else if (pL != null && pL > 0.8 && !financial) add("warning", "High payout ratio", `${pct(pL, 0)} of earnings paid out, leaving little room for cuts in profit.`);
    const uncovered = fcf.slice(-3).map((f, k) => { const i = Y.length - 3 + k; return f != null && s.dividendsPaid[i] != null && s.dividendsPaid[i] > f; }).filter(Boolean).length;
    if (!financial && uncovered >= 2) add("warning", "Dividend not covered by free cash flow", `Dividends exceeded free cash flow in ${uncovered} of the last 3 years.`);
    const streak = (() => { let n = 0; for (let i = dps.length - 1; i > 0; i--) { if (dps[i] != null && dps[i - 1] != null && dps[i] > dps[i - 1]) n++; else break; } return n; })();
    if (!cuts.length && streak >= 5) add("good", "Growing dividend", `Dividend raised ${streak} years in a row (${pct(cagr(dps))} a year).`);
  }

  // SEC filing record
  const h = d.secHistory;
  if (h) {
    const on = (t) => h.events.filter((e) => e.type === t).map((e) => e.date);
    const nr = on("non_reliance"), ac = on("auditor_change"), lf = on("late_filing");
    const since = h.since.slice(0, 4);
    if (nr.length) add("critical", "Financial statements were restated", `Filed a notice that earlier financials can't be relied on (8-K item 4.02) on ${nr.join(", ")}.`);
    if (ac.length) add("warning", "Auditor changed", `Filed an auditor-change notice (8-K item 4.01) on ${ac.join(", ")}.`);
    if (lf.length) add(lf.length >= 3 ? "critical" : "warning", "Late SEC filings", `${lf.length} late-filing notice${lf.length > 1 ? "s" : ""} since ${since}, most recently ${lf[0]}.`);
    if (!nr.length && !ac.length && !lf.length) add("good", "Clean filing record", `No restatements, auditor changes or late filings since ${since}.`);
  }

  // Data coverage
  const gaps = ["revenue", "netIncome", "totalAssets", "totalLiabilities", "equity", "operatingCashFlow"].filter((k) => s[k].filter((v) => v == null).length > 2);
  if (gaps.length) add("info", "Some data missing", `Few filings tagged: ${gaps.map(labelOf).join(", ")}. Related checks may be skipped.`);

  const order = { critical: 0, warning: 1, good: 2, info: 3 };
  flags.sort((a, b) => order[a.sev] - order[b.sev]);
  return { flags, fcf, nm, financial };
}
