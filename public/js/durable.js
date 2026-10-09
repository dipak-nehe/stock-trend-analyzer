// "Durable advantage: what the statements show": standard ratios from the income statement, balance sheet and cash
// flow that tend to separate businesses with a lasting edge from those in fiercely competitive markets.
// Each row is { id, name, rule, status: "pass" | "fail" | "na", actual }, like the value checklists.
import { fixed, pct } from "./format.js";
import { t } from "./i18n.js";

export function durableChecks(d, r) {
  const s = d.series, fin = r.financial, n = d.years.length, last = n - 1;
  const at = (k, i) => (s[k] && s[k][i] != null ? s[k][i] : null);
  const tf = (ok) => (ok ? "pass" : "fail");
  const row = (id, status, actual) => ({ id, name: t(`dur.${id}.name`), rule: t(`dur.${id}.rule`), status, actual });
  const NA_BANK = t("val.naBank"), NOT_REPORTED = t("val.notReported");
  // one series against another over the years both are reported, as total / total so one odd year can't dominate
  const overall = (a, b) => {
    let top = 0, bottom = 0, years = 0;
    for (let i = 0; i < n; i++) {
      if (at(a, i) != null && at(b, i) != null) { top += at(a, i); bottom += at(b, i); years++; }
    }
    return years ? { v: bottom > 0 ? top / bottom : null, years } : null;
  };
  // in how many year-on-year steps a series went up
  const rises = (k) => {
    let up = 0, steps = 0;
    for (let i = 1; i < n; i++) if (at(k, i) != null && at(k, i - 1) != null) { steps++; if (at(k, i) > at(k, i - 1)) up++; }
    return { up, steps };
  };
  const share = (o, key) => t(key, { pct: pct(o.v), n: o.years });
  const rows = [];
  const add = (id, status, actual, bankToo = false) => rows.push(fin && !bankToo ? row(id, "na", NA_BANK) : row(id, status, actual));

  // ---- income statement ----
  const gm = overall("grossProfit", "revenue");
  add("grossMargin", gm && gm.v != null ? tf(gm.v >= 0.4) : "na", gm && gm.v != null ? share(gm, "dur.ofRevenue") : NOT_REPORTED);
  const sga = overall("sga", "grossProfit");
  add("sga", sga && sga.v != null ? tf(sga.v <= 0.8) : "na",
    sga && sga.v != null ? share(sga, "dur.ofGross") + (sga.v <= 0.3 ? t("dur.sga.excellent") : "") : NOT_REPORTED);
  const rnd = overall("researchAndDevelopment", "grossProfit"), hasGross = overall("grossProfit", "revenue");
  add("rnd", rnd && rnd.v != null ? tf(rnd.v <= 0.3) : hasGross ? "pass" : "na",
    rnd && rnd.v != null ? share(rnd, "dur.ofGross") : hasGross ? t("dur.rnd.none") : NOT_REPORTED);
  const dep = overall("depreciation", "grossProfit");
  add("depreciation", dep && dep.v != null ? tf(dep.v <= 0.1) : "na", dep && dep.v != null ? share(dep, "dur.ofGross") : NOT_REPORTED);
  const intr = overall("interestExpense", "operatingIncome");
  add("interest", !intr ? "na" : intr.v == null ? "fail" : tf(intr.v <= 0.15),
    !intr ? NOT_REPORTED : intr.v == null ? t("dur.interest.loss") : share(intr, "dur.ofOperating"));
  const nm = overall("netIncome", "revenue");
  add("netMargin", nm && nm.v != null ? tf(nm.v >= 0.2) : "na", nm && nm.v != null ? share(nm, "dur.ofRevenue") : NOT_REPORTED);
  const eps = rises("eps");
  add("earningsTrend", eps.steps >= 5 ? tf(eps.up >= 0.7 * eps.steps) : "na",
    eps.steps >= 5 ? t("dur.rose", { up: eps.up, steps: eps.steps }) : NOT_REPORTED, true);

  // ---- balance sheet ----
  const ret = rises("retainedEarnings");
  const sh = [at("dilutedShares", 0), at("dilutedShares", last)];
  const fewerShares = sh[0] != null && sh[1] != null && sh[1] < sh[0];
  const retainedGrew = ret.steps >= 5 && ret.up >= 0.7 * ret.steps;
  add("retained", ret.steps < 5 ? "na" : tf(retainedGrew || fewerShares),
    ret.steps < 5 ? NOT_REPORTED : retainedGrew || !fewerShares ? t("dur.rose", { up: ret.up, steps: ret.steps })
      : t("dur.retained.buybacks", { up: ret.up, steps: ret.steps, pct: pct(1 - sh[1] / sh[0], 0) }), true);
  const liab = at("totalLiabilities", last), eq = at("equity", last), treasury = at("treasuryStock", last) ?? 0;
  const adjEquity = eq != null ? eq + Math.abs(treasury) : null;
  const dte = adjEquity > 0 ? Math.round((liab / adjEquity) * 100) / 100 : null;  // judged as shown, so "0.80" never passes "under 0.8"
  add("debtToEquity", liab == null || adjEquity == null ? "na" : dte != null ? tf(dte < 0.8) : "fail",
    liab == null || adjEquity == null ? NOT_REPORTED : adjEquity > 0
      ? t(treasury ? "dur.dte.treasury" : "dur.dte.plain", { ratio: fixed(liab / adjEquity, 2) }) : t("dur.dte.negative"));
  const ltd = at("longTermDebt", last), ni = at("netIncome", last);
  add("longTermDebt", !ltd ? "pass" : ni > 0 ? tf(ltd / ni <= 4) : "fail",
    !ltd ? t("dur.ltd.none") : ni > 0 ? t("dur.ltd.years", { years: fixed(ltd / ni, 1) }) : t("val.debt.loss"));
  const pref = at("preferredStock", last);
  add("preferred", pref > 0 ? "fail" : "pass", pref > 0 ? t("dur.preferred.some") : t("dur.preferred.none"), true);

  // ---- cash flow ----
  const capex = overall("capex", "netIncome");
  add("capex", !capex ? "na" : capex.v == null ? "fail" : tf(capex.v < 0.5),
    !capex ? NOT_REPORTED : capex.v == null ? t("val.capex.negative") : share(capex, "dur.ofEarnings"));
  add("buybacks", sh[0] == null || sh[1] == null ? "na" : tf(fewerShares),
    sh[0] == null || sh[1] == null ? NOT_REPORTED
      : t(fewerShares ? "val.shares.down" : "val.shares.up", { pct: pct(Math.abs(sh[1] / sh[0] - 1)) }), true);
  return rows;
}
