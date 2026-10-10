// Plain-English meanings of the balance-sheet terms the checks use, shown under the checks on the Durable advantage tab
// and under the tables on My portfolio and the S&P 500 picks. Defined once here so all three pages say the same thing.
import { t } from "./i18n.js";

export const BALANCE_TERMS = ["balanceSheet", "equity", "liabilities", "debtToEquity", "longTermDebt", "retainedEarnings",
  "treasuryStock", "preferredStock"];

/** The terms as <dt>/<dd> pairs for a <dl>, in the current language. */
export function termsHtml() {
  return BALANCE_TERMS.map((id) => `<dt>${t(`bs.${id}.term`)}</dt><dd>${t(`bs.${id}.def`)}</dd>`).join("");
}
