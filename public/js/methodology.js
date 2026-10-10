// "How we calculate" (methodology.html): every red flag, checklist test and portfolio measure with its rule, drawn
// from the same texts the results pages show, so the page can't drift from what the site does. A unit test checks
// these lists against the ids the checks produce (valuation.js, durable.js, flags.js). No page code here.
import { COLUMNS } from "./portfolio.js";
import { t } from "./i18n.js";

/** The checklists, in the order of the tabs: [key, string prefix, ids].
 * @type {[string, string, string[]][]} */
export const CHECKLISTS = [
  ["graham", "val", ["size", "current", "debtCovered", "stability", "dividends", "growth", "pe", "pb"]],
  ["buffett", "val", ["consistent", "roe", "rotc", "debt", "moat", "capex", "shares", "mos"]],
  ["lynch", "val", ["lynchGrowth", "lynchPeg", "lynchPegy", "lynchFair", "lynchDebt"]],
  ["piotroski", "val", ["f.roaPositive", "f.cfoPositive", "f.roaUp", "f.accruals", "f.leverageDown", "f.currentUp", "f.noDilution",
    "f.grossMarginUp", "f.turnoverUp"]],
  ["durableIncome", "dur", ["grossMargin", "sga", "rnd", "depreciation", "interest", "netMargin", "earningsTrend"]],
  ["durableBalance", "dur", ["retained", "debtToEquity", "longTermDebt", "preferred", "treasury"]],
  ["durableCash", "dur", ["capex", "buybacks"]],
];

/** The red flags by area: [area, [flag id, severity]]; the rule for each is meth.flag.<id>.
 * @type {[string, [string, string][]][]} */
export const FLAG_GROUPS = [
  ["revenue", [["revShrinking", "critical"], ["revSlightlyLower", "warning"], ["revInconsistent", "warning"], ["revConsistent", "good"]]],
  ["profit", [["recentLosses", "critical"], ["pastLosses", "warning"], ["profitable", "good"], ["marginShrinking", "warning"], ["epsFalling", "warning"]]],
  ["debt", [["negativeEquity", "critical"], ["debtVeryHigh", "critical"], ["debtElevated", "warning"], ["lowLeverage", "good"],
    ["debtFaster", "warning"], ["liquidityWeak", "critical"], ["currentRatioLow", "warning"], ["interestNotCovered", "critical"],
    ["interestBarely", "critical"], ["interestThin", "warning"], ["netCash", "good"]]],
  ["quality", [["earningsNotCash", "warning"], ["earningsQuality", "good"], ["negativeFcf", "warning"], ["receivables", "warning"],
    ["inventory", "warning"], ["goodwill", "warning"]]],
  ["shares", [["dilution", "warning"], ["buybacks", "good"]]],
  ["dividends", [["dividendCut", "warning"], ["dividendSuspended", "warning"], ["dividendExceeds", "critical"], ["highPayout", "warning"],
    ["dividendUncovered", "warning"], ["growingDividend", "good"]]],
  ["sec", [["bankruptcy", "critical"], ["restated", "critical"], ["delistingNotice", "warning"], ["auditorChanged", "warning"],
    ["lateFilings", "warning"], ["cyberIncident", "warning"], ["writeDowns", "warning"], ["cleanRecord", "good"]]],
  ["other", [["bank", "info"], ["dataMissing", "info"]]],
];

/** A checklist test's rule; Buffett's margins test has one rule for companies with gross profit and one without.
 * @param {string} prefix @param {string} id */
function ruleOf(prefix, id) {
  if (prefix === "val" && id === "moat") return t("meth.moatRule", { gross: t("val.moat.ruleGross"), net: t("val.moat.ruleNet") });
  return t(`${prefix}.${id}.rule`);
}

// Wide tables scroll sideways on narrow screens: the scroll box is focusable and named after its heading, so it can be
// scrolled with the keyboard.
const table = (/** @type {string} */ head, /** @type {string} */ rows, /** @type {string} */ labelledBy) =>
  `<div class="table-wrap" tabindex="0" role="region" aria-labelledby="${labelledBy}"><table class="meth-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;

/** One checklist as a table of test and rule. @param {string} key @param {string} labelledBy the id of its heading */
export function checklistHtml(key, labelledBy) {
  const [, prefix, ids] = /** @type {[string, string, string[]]} */ (CHECKLISTS.find((c) => c[0] === key));
  const head = `<tr><th scope="col">${t("meth.col.test")}</th><th scope="col">${t("meth.col.rule")}</th></tr>`;
  return table(head, ids.map((id) => `<tr><th scope="row">${t(`${prefix}.${id}.name`)}</th><td>${ruleOf(prefix, id)}</td></tr>`).join(""), labelledBy);
}

/** Every red flag, grouped by area, with its rule and result. */
export function flagsHtml() {
  const head = `<tr><th scope="col">${t("meth.col.flag")}</th><th scope="col">${t("meth.col.rule")}</th><th scope="col">${t("meth.col.result")}</th></tr>`;
  const rows = FLAG_GROUPS.map(([area, flags]) => `<tr class="group"><th colspan="3" scope="colgroup">${t(`meth.area.${area}`)}</th></tr>`
    + flags.map(([id, sev]) => `<tr data-testid="meth-flag"><th scope="row">${t(`flag.${id}.title`)}</th><td>${t(`meth.flag.${id}`)}</td>`
      + `<td><span class="meth-sev ${sev}">${t(`meth.sev.${sev}`)}</span></td></tr>`).join("")).join("");
  return table(head, rows, "h-flags");
}

/** The portfolio and S&P 500 columns with what each measures. */
export function measuresHtml() {
  const head = `<tr><th scope="col">${t("meth.col.column")}</th><th scope="col">${t("meth.col.meaning")}</th></tr>`;
  return table(head, COLUMNS.map((c) => `<tr><th scope="row">${t(`pf.col.${c.key}`)}</th><td>${t(`pf.help.${c.key}`)}</td></tr>`).join(""), "h-portfolio");
}
