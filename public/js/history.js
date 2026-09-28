// SEC filing history: restatements, auditor changes, late filings, other serious 8-K events, amendments and letters.
import { has, t } from "./i18n.js";

export const HISTORY_TYPES = {
  non_reliance: { sev: "critical" },
  auditor_change: { sev: "warning" },
  late_filing: { sev: "warning" },
  amendment: { sev: "info" },
  sec_letter: { sev: "info" },
  company_response: { sev: "info" },
  bankruptcy: { sev: "critical", other: true },
  delisting_notice: { sev: "warning", other: true },
  cyber_incident: { sev: "warning", other: true },
  impairment: { sev: "warning", other: true },
  acquisition: { sev: "info" },
};
// Types this page doesn't know yet (a newer server) show as plain information rather than breaking the list.
const typeOf = (e) => HISTORY_TYPES[e.type] || { sev: "info" };
// The rarer serious 8-K events share one tile ("Other serious events") to keep the section compact.
export const OTHER_SERIOUS = Object.keys(HISTORY_TYPES).filter((k) => HISTORY_TYPES[k].other);
export const HISTORY_FILTERS = [
  ["all", () => true],
  ["flags", (e) => typeOf(e).sev !== "info"],
  ["letters", (e) => e.type === "sec_letter" || e.type === "company_response"],
  ["amend", (e) => e.type === "amendment"],
];

// Describe a filing in the current language (the server's description is English-only).
function describe(e) {
  if (!has(`history.desc.${e.type}`)) return e.description; // a type this page doesn't know: the server's English text
  const form = e.type === "late_filing" ? e.form.replace(/^NT /, "") : e.form.replace(/\/A$/, "");
  return t(`history.desc.${e.type}`, { form });
}
const typeName = (e) => (has(`history.type.${e.type}`) ? t(`history.type.${e.type}`) : e.form);

// One tile for bankruptcy, delisting notices, cybersecurity incidents and write-downs: the count, and which kinds.
function otherTile(h, c) {
  const n = OTHER_SERIOUS.reduce((sum, k) => sum + c(k), 0);
  // Same grading as the red flags: a bankruptcy is serious, repeated exchange notices are repeated trouble.
  const text = c("bankruptcy") ? t("history.status.serious") : c("delisting_notice") >= 3 ? t("history.status.repeated") : null;
  const status = !n ? `<span class="status up">✓ ${t("history.status.none")}</span>`
    : text ? `<span class="status down">✗ ${text}</span>` : `<span class="status flat">! ${t("history.status.look")}</span>`;
  const detail = n
    ? OTHER_SERIOUS.filter((k) => c(k)).map((k) => `${c(k)} × ${t(`history.type.${k}`).toLowerCase()}`).join(" · ")
    : t("history.tile.other.detail");
  return `<div class="card tile" data-testid="tile"><div class="label">${t("history.tile.other")}</div><div class="value">${n}</div>${status}<div class="detail">${detail}</div></div>`;
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
    otherTile(h, c),
    tile(t("history.tile.amended"), c("amendment"), "info", none, t("history.status.checkWhy"), t("history.tile.amended.detail")),
    `<div class="card tile" data-testid="tile"><div class="label">${t("history.tile.letters")}</div><div class="value">${c("sec_letter")}</div><span class="status flat">${
      t("history.tile.letters.replies", { n: c("company_response") })}</span><div class="detail">${t("history.tile.letters.detail")}</div></div>`,
  ].join("");

  const filters = HISTORY_FILTERS.map(([k, fn]) =>
    `<button class="chip" type="button" data-f="${k}" aria-pressed="${k === filter}">${t(`history.filter.${k}`)} (${h.events.filter(fn).length})</button>`).join("");

  const list = h.events.filter(HISTORY_FILTERS.find((f) => f[0] === filter)[1]);
  const shown = expanded ? list : list.slice(0, 10);
  const events = shown.length ? shown.map((e) => `<div class="event ${typeOf(e).sev}" data-testid="history-event"><span class="date">${e.date}</span>
      <div><div class="kind">${typeName(e)} <span class="muted">· ${e.form}</span></div><div class="desc">${describe(e)}</div></div>
      <a href="${e.url}" target="_blank" rel="noopener">${t("history.open")}</a></div>`).join("")
    : `<div class="empty">${t("history.empty", { since })}</div>`;
  return { intro, tiles, filters, events, total: list.length,
           moreText: expanded ? t("history.showFewer") : t("history.showAll", { n: list.length }) };
}
