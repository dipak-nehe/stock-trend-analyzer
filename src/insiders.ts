// Insider trades (SEC Form 4): open-market buys and sales by officers, directors and 10% owners in the last
// 12 months. The server does the counting (backend/insiders.py); this turns its summary into the Insiders tab,
// which loads it only when opened.
import type { Insiders } from "./types.ts";
import { esc } from "./html.ts";
import { money, perShare } from "./format.ts";
import { getLocale, t, tn } from "./i18n.ts";

const SHOWN = 10; // latest trades in the table; the rest are one click away on SEC
/** Share counts in full ("111,365" / "111.365"). */
const shares = (v: number) => Math.round(v).toLocaleString(getLocale());


/**
 * HTML for the section, or "" when there's nothing to show.
 * @param [state] "loading" | "error" | "done"
 */
export function insiderView(ins: Insiders | null | undefined, cik: number | string, state?: string) {
  const heading = `<h3 class="panel-h" id="insidersTitle">${t("insiders.title")}</h3>`;
  if (state === "loading") {
    return `${heading}<div class="card insiders" data-testid="insiders"><p class="loading-note" role="status">${t("insiders.loading.long")}</p></div>`;
  }
  if (state === "error") {
    return `${heading}<div class="card insiders" data-testid="insiders"><p role="alert">${t("insiders.error.long")}</p>
      <button type="button" class="chip" id="insidersRetry">${t("insiders.retry")}</button></div>`;
  }
  if (!ins) return "";
  const { buys, sells } = ins;
  const total = (label: string, side: Insiders["buys"], detail: string, id: string) =>
    `<div class="insider-total" data-testid="${id}"><div class="label">${label}</div><div class="value">${side.count}</div><div class="detail">${detail}</div></div>`;
  const buyDetail = buys.count ? `${money(buys.value, "USD")} · ${tn("insiders.people", buys.insiders)}` : t("insiders.noneYet");
  const sellDetail = sells.count
    ? [money(sells.value, "USD"), tn("insiders.people", sells.insiders), ...(sells.planned ? [tn("insiders.planned", sells.planned)] : [])].join(" · ")
    : t("insiders.noneYet");
  const secLink = `https://www.sec.gov/cgi-bin/own-disp?action=getissuer&CIK=${String(cik).padStart(10, "0")}`;

  const rows = ins.trades.slice(0, SHOWN).map((tr) => `<tr data-testid="insider-trade">
      <td class="date">${tr.date}</td>
      <td lang="en"><span class="who">${esc(tr.name)}</span>${tr.role ? `<span class="role">${esc(tr.role)}</span>` : ""}</td>
      <td><span class="trade ${tr.type}">${t(`insiders.type.${tr.type}`)}</span>${tr.planned ? ` <span class="tag" title="${t("insiders.plannedHelp")}">${t("insiders.plannedTag")}</span>` : ""}</td>
      <td class="num">${shares(tr.shares)}</td>
      <td class="num">${tr.price ? perShare(tr.price, "USD") : "–"}</td>
      <td class="num">${tr.value ? money(tr.value, "USD") : "–"}</td>
      <td><a href="${esc(tr.url)}" target="_blank" rel="noopener">${t("insiders.form4")}</a></td></tr>`).join("");
  const table = rows
    ? `<div class="table-wrap" tabindex="0" role="region" aria-labelledby="insidersTitle"><table class="insider-table" data-testid="insider-trades">
        <thead><tr><th scope="col">${t("insiders.col.date")}</th><th scope="col">${t("insiders.col.who")}</th><th scope="col">${t("insiders.col.trade")}</th>
        <th scope="col" class="num">${t("insiders.col.shares")}</th><th scope="col" class="num">${t("insiders.col.price")}</th>
        <th scope="col" class="num">${t("insiders.col.value")}</th><th scope="col"><span class="sr-only">${t("insiders.col.filing")}</span></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<p class="empty" data-testid="insiders-empty">${tn("insiders.none.long", ins.filings)}</p>`;
  const notes = [
    ...(ins.trades.length > SHOWN ? [tn("insiders.latest", SHOWN)] : []),
    ...(ins.partial ? [t("insiders.partial", { read: ins.read, total: ins.totalFilings })] : []),
  ];
  return `${heading}
    <div class="card insiders" data-testid="insiders">
      <p class="note">${t("insiders.intro")}</p>
      <div class="insider-totals">${total(t("insiders.buys"), buys, buyDetail, "insider-buys")}${total(t("insiders.sells"), sells, sellDetail, "insider-sells")}</div>
      ${buys.insiders >= 2 ? `<p class="insider-signal" data-testid="insider-signal">✓ ${t("insiders.signal", { n: buys.insiders, value: money(buys.value, "USD") })}</p>` : ""}
      ${table}
      <p class="note">${notes.map((n) => `${n} `).join("")}<a href="${secLink}" target="_blank" rel="noopener">${t("insiders.allOnSec")}</a></p>
    </div>`;
}
