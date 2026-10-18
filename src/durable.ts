// "Durable advantage: what the statements show": standard ratios from the income statement, balance sheet and cash
// flow that tend to separate businesses with a lasting edge from those in fiercely competitive markets.
// Each row is { id, name, rule, status: "pass" | "fail" | "na", actual }, like the value checklists.
import { fixed, money, pct } from "./format.ts";
import { t } from "./i18n.ts";
import type { Financials } from "./types.ts";
import type { Analysis } from "./flags.ts";
import type { Check, Status } from "./valuation.ts";
import { positive } from "./series.ts";

export function durableChecks(d: Financials, r: Analysis) {
  const s = d.series, fin = r.financial, n = d.years.length, last = n - 1;
  const at = (k: string, i: number): number | null => { const arr = s[k]; return arr && arr[i] != null ? arr[i] : null; };
  const tf = (ok: boolean): Status => (ok ? "pass" : "fail");
  const row = (id: string, status: Status, actual: string): Check => ({ id, name: t(`dur.${id}.name`), rule: t(`dur.${id}.rule`), status, actual });
  const NA_BANK = t("val.naBank"), NOT_REPORTED = t("val.notReported");
  // one series against another over the years both are reported, as total / total so one odd year can't dominate
  const overall = (a: string, b: string) => {
    let top = 0, bottom = 0, years = 0;
    for (let i = 0; i < n; i++) {
      const x = at(a, i), y = at(b, i);
      if (x != null && y != null) { top += x; bottom += y; years++; }
    }
    return years ? { v: bottom > 0 ? top / bottom : null, years } : null;
  };
  // in how many year-on-year steps a series went up
  const rises = (k: string) => {
    let up = 0, steps = 0;
    for (let i = 1; i < n; i++) {
      const now = at(k, i), prev = at(k, i - 1);
      if (now != null && prev != null) { steps++; if (now > prev) up++; }
    }
    return { up, steps };
  };
  const share = (o: { v: number | null; years: number }, key: string) => t(key, { pct: pct(o.v), n: o.years });
  const rows: Check[] = [];
  const add = (id: string, status: Status, actual: string, bankToo = false) => rows.push(fin && !bankToo ? row(id, "na", NA_BANK) : row(id, status, actual));

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
  const sh0 = at("dilutedShares", 0), sh1 = at("dilutedShares", last);
  const fewerShares = sh0 != null && sh1 != null && sh1 < sh0;
  const retainedGrew = ret.steps >= 5 && ret.up >= 0.7 * ret.steps;
  add("retained", ret.steps < 5 ? "na" : tf(retainedGrew || fewerShares),
    ret.steps < 5 ? NOT_REPORTED : retainedGrew || !fewerShares ? t("dur.rose", { up: ret.up, steps: ret.steps })
      : t("dur.retained.buybacks", { up: ret.up, steps: ret.steps, pct: pct(1 - sh1! / sh0!, 0) }), true);  // (fewer shares: both known)
  const liab = at("totalLiabilities", last), eq = at("equity", last), treasury = at("treasuryStock", last) ?? 0;
  const adjEquity = eq != null ? eq + Math.abs(treasury) : null;
  const dte = positive(adjEquity) ? Math.round(((liab ?? 0) / adjEquity) * 100) / 100 : null;  // judged as shown, so "0.80" never passes "under 0.8"
  add("debtToEquity", liab == null || adjEquity == null ? "na" : dte != null ? tf(dte < 0.8) : "fail",
    liab == null || adjEquity == null ? NOT_REPORTED : positive(adjEquity)
      ? t(treasury ? "dur.dte.treasury" : "dur.dte.plain", { ratio: fixed(liab / adjEquity, 2) }) : t("dur.dte.negative"));
  const ltd = at("longTermDebt", last), ni = at("netIncome", last);
  add("longTermDebt", !ltd ? "pass" : positive(ni) ? tf(ltd / ni <= 4) : "fail",
    !ltd ? t("dur.ltd.none") : positive(ni) ? t("dur.ltd.years", { years: fixed(ltd / ni, 1) }) : t("val.debt.loss"));
  const pref = at("preferredStock", last);
  add("preferred", positive(pref) ? "fail" : "pass", positive(pref) ? t("dur.preferred.some") : t("dur.preferred.none"), true);
  // Treasury stock: shares bought back and held. Holding some is a fact; holding none isn't a fault, because many
  // companies cancel the shares they buy back (no treasury stock, or 0), so then the test doesn't apply.
  const held = Math.abs(at("treasuryStock", last) ?? 0);
  add("treasury", held > 0 ? "pass" : "na",
    held > 0 ? t("dur.treasury.held", { amount: money(held, d.currency) }) : t("dur.treasury.none"), true);

  // ---- cash flow ----
  const capex = overall("capex", "netIncome");
  add("capex", !capex ? "na" : capex.v == null ? "fail" : tf(capex.v < 0.5),
    !capex ? NOT_REPORTED : capex.v == null ? t("val.capex.negative") : share(capex, "dur.ofEarnings"));
  add("buybacks", sh0 == null || sh1 == null ? "na" : tf(fewerShares),
    sh0 == null || sh1 == null ? NOT_REPORTED
      : t(fewerShares ? "val.shares.down" : "val.shares.up", { pct: pct(Math.abs(sh1 / sh0 - 1)) }), true);
  return rows;
}
