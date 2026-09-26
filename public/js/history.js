// SEC filing history: restatements, auditor changes, late filings, amendments and comment letters.

export const HISTORY_TYPES = {
  non_reliance: { label: "Restatement warning", sev: "critical" },
  auditor_change: { label: "Auditor change", sev: "warning" },
  late_filing: { label: "Late filing", sev: "warning" },
  amendment: { label: "Amended annual report", sev: "info" },
  sec_letter: { label: "SEC comment letter", sev: "info" },
  company_response: { label: "Company reply to SEC", sev: "info" },
};
export const HISTORY_FILTERS = [
  ["all", "All", () => true],
  ["flags", "Red flags", (e) => HISTORY_TYPES[e.type].sev !== "info"],
  ["letters", "SEC letters & replies", (e) => e.type === "sec_letter" || e.type === "company_response"],
  ["amend", "Amendments", (e) => e.type === "amendment"],
];

// Returns HTML pieces for the section; `total` is the number of events matching the filter.
export function historyView(h, filter = "all", expanded = false) {
  const c = (t) => h.counts[t] || 0, since = h.since.slice(0, 4);
  const intro = `Notable filings since ${since}, straight from the company's EDGAR record. Each entry links to the original document. <a href="${h.filingsUrl}" target="_blank" rel="noopener">All filings on SEC ↗</a>`;

  const tile = (label, n, badSev, okText, badText, detail) => {
    const sev = n ? badSev : "good";
    const status = n ? `<span class="status ${sev === "critical" ? "down" : "flat"}">${sev === "critical" ? "✗" : "!"} ${badText}</span>` : `<span class="status up">✓ ${okText}</span>`;
    return `<div class="card tile"><div class="label">${label}</div><div class="value">${n}</div>${status}<div class="detail">${detail}</div></div>`;
  };
  const letters = c("sec_letter");
  const tiles = [
    tile("Restatement warnings", c("non_reliance"), "critical", "None", "Serious", "8-K item 4.02: earlier financials can't be relied on"),
    tile("Auditor changes", c("auditor_change"), "warning", "None", "Worth a look", "8-K item 4.01: auditor resigned or was replaced"),
    tile("Late filings", c("late_filing"), c("late_filing") >= 3 ? "critical" : "warning", "None", c("late_filing") >= 3 ? "Repeated" : "Worth a look", "NT 10-K / NT 10-Q: report not filed on time"),
    tile("Amended annual reports", c("amendment"), "info", "None", "Check why", "Often just adds executive pay details; sometimes corrects numbers"),
    `<div class="card tile"><div class="label">SEC comment letters</div><div class="value">${letters}</div><span class="status flat">${c("company_response")} company replies</span><div class="detail">SEC reviews every listed company at least every 3 years. Letters are routine, not an accusation.</div></div>`,
  ].join("");

  const filters = HISTORY_FILTERS.map(([k, label, fn]) =>
    `<button class="chip" type="button" data-f="${k}" aria-pressed="${k === filter}">${label} (${h.events.filter(fn).length})</button>`).join("");

  const list = h.events.filter(HISTORY_FILTERS.find((f) => f[0] === filter)[2]);
  const shown = expanded ? list : list.slice(0, 10);
  const events = shown.length ? shown.map((e) => {
    const t = HISTORY_TYPES[e.type];
    return `<div class="event ${t.sev}"><span class="date">${e.date}</span>
      <div><div class="kind">${t.label} <span class="muted">· ${e.form}</span></div><div class="desc">${e.description}</div></div>
      <a href="${e.url}" target="_blank" rel="noopener">Open ↗</a></div>`;
  }).join("") : `<div class="empty">No filings of this kind since ${since}.</div>`;
  return { intro, tiles, filters, events, total: list.length, moreText: expanded ? "Show fewer" : `Show all ${list.length}` };
}
