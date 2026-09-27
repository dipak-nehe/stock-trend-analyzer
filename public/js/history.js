// SEC filing history: restatements, auditor changes, late filings, amendments and comment letters.
import { t } from "./i18n.js";

export const HISTORY_TYPES = {
  non_reliance: { sev: "critical" },
  auditor_change: { sev: "warning" },
  late_filing: { sev: "warning" },
  amendment: { sev: "info" },
  sec_letter: { sev: "info" },
  company_response: { sev: "info" },
};
export const HISTORY_FILTERS = [
  ["all", () => true],
  ["flags", (e) => HISTORY_TYPES[e.type].sev !== "info"],
  ["letters", (e) => e.type === "sec_letter" || e.type === "company_response"],
  ["amend", (e) => e.type === "amendment"],
];

// Describe a filing in the current language (the server's description is English-only).
function describe(e) {
  const form = e.type === "late_filing" ? e.form.replace(/^NT /, "") : e.form.replace(/\/A$/, "");
  return t(`history.desc.${e.type}`, { form });
}

// Returns HTML pieces for the section; `total` is the number of events matching the filter.
export function historyView(h, filter = "all", expanded = false) {
  const c = (type) => h.counts[type] || 0, since = h.since.slice(0, 4);
  const intro = `${t("history.intro", { since })} <a href="${h.filingsUrl}" target="_blank" rel="noopener">${t("history.allFilings")}</a>`;

  const tile = (label, n, badSev, okText, badText, detail) => {
    const sev = n ? badSev : "good";
    const status = n ? `<span class="status ${sev === "critical" ? "down" : "flat"}">${sev === "critical" ? "✗" : "!"} ${badText}</span>` : `<span class="status up">✓ ${okText}</span>`;
    return `<div class="card tile" data-testid="tile"><div class="label">${label}</div><div class="value">${n}</div>${status}<div class="detail">${detail}</div></div>`;
  };
  const none = t("history.status.none"), look = t("history.status.look"), late = c("late_filing");
  const tiles = [
    tile(t("history.tile.restatements"), c("non_reliance"), "critical", none, t("history.status.serious"), t("history.tile.restatements.detail")),
    tile(t("history.tile.auditor"), c("auditor_change"), "warning", none, look, t("history.tile.auditor.detail")),
    tile(t("history.tile.late"), late, late >= 3 ? "critical" : "warning", none, late >= 3 ? t("history.status.repeated") : look, t("history.tile.late.detail")),
    tile(t("history.tile.amended"), c("amendment"), "info", none, t("history.status.checkWhy"), t("history.tile.amended.detail")),
    `<div class="card tile" data-testid="tile"><div class="label">${t("history.tile.letters")}</div><div class="value">${c("sec_letter")}</div><span class="status flat">${
      t("history.tile.letters.replies", { n: c("company_response") })}</span><div class="detail">${t("history.tile.letters.detail")}</div></div>`,
  ].join("");

  const filters = HISTORY_FILTERS.map(([k, fn]) =>
    `<button class="chip" type="button" data-f="${k}" aria-pressed="${k === filter}">${t(`history.filter.${k}`)} (${h.events.filter(fn).length})</button>`).join("");

  const list = h.events.filter(HISTORY_FILTERS.find((f) => f[0] === filter)[1]);
  const shown = expanded ? list : list.slice(0, 10);
  const events = shown.length ? shown.map((e) => `<div class="event ${HISTORY_TYPES[e.type].sev}" data-testid="history-event"><span class="date">${e.date}</span>
      <div><div class="kind">${t(`history.type.${e.type}`)} <span class="muted">· ${e.form}</span></div><div class="desc">${describe(e)}</div></div>
      <a href="${e.url}" target="_blank" rel="noopener">${t("history.open")}</a></div>`).join("")
    : `<div class="empty">${t("history.empty", { since })}</div>`;
  return { intro, tiles, filters, events, total: list.length,
           moreText: expanded ? t("history.showFewer") : t("history.showAll", { n: list.length }) };
}
