// The S&P 500 picker page (sp500.html): the company list from public/data/sp500.json, search and sector filters, and
// up to 10 picks (kept in the address as ?pick=KO,AAPL, so Back from the results page keeps them). "Show" opens
// sp500-view.html with the picks. The rules (filtering, the limit) are in sp500.ts.
import { $, $$, applyStaticText, bindSlashShortcut, initialLang, useLang } from "./page.ts";
import { MAX_PICKS, filterCompanies, parsePicks, sectors, togglePick } from "./sp500.ts";
import { esc, langQuery } from "./stock-table.ts";
import { getLocale, setLang, t, tn } from "./i18n.ts";

let companies: import("./sp500.ts").Company[] = [];
let picks: string[] = [];
let source = { generated: "", count: 0 };

const byTicker = (ticker: string) => companies.find((c) => c.t === ticker);

function updateUrl() {
  const q = new URLSearchParams({ ...(picks.length ? { pick: picks.join(",") } : {}), ...langQuery() });
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}`);
}

function status(text: string) {
  $("spStatus").textContent = text;
}

// ---------- the list ----------
function renderList() {
  const shown = filterCompanies(companies, $<HTMLInputElement>("spSearch").value, $<HTMLSelectElement>("spSector").value);
  const full = picks.length >= MAX_PICKS;
  $("spCount").textContent = t("sp.count", { shown: shown.length, total: companies.length });
  $("spList").innerHTML = shown.length
    ? `<ul class="sp-rows">${shown.map((c) => {
      const on = picks.includes(c.t), id = `sp-${c.t.replace(/\W/g, "_")}`;
      return `<li class="sp-row${on ? " on" : ""}" data-testid="sp-row"><input type="checkbox" id="${id}" data-t="${esc(c.t)}"${on ? " checked" : ""}${full && !on ? " disabled" : ""}>`
        + `<label for="${id}"><span class="sp-name">${esc(c.n)}</span> <span class="sp-ticker">${esc(c.t)}</span> <span class="sp-sector">${esc(c.s)}</span></label></li>`;
    }).join("")}</ul>`
    : `<p class="muted sp-none">${esc(t("sp.none"))}</p>`;
}

/** After a tick: update the boxes already on screen (redrawing would lose the scroll position and the focus). */
function syncList() {
  const full = picks.length >= MAX_PICKS;
  for (const box of ([...$("spList").querySelectorAll("input[data-t]")] as HTMLInputElement[])) {
    const on = picks.includes(box.dataset.t || "");
    box.checked = on;
    box.disabled = full && !on;
    box.closest("li")?.classList.toggle("on", on);
  }
}

// ---------- the selection ----------
function renderPicks() {
  const n = picks.length;
  $("spPickedTitle").textContent = t("sp.picked", { n, max: MAX_PICKS });
  $("spChips").innerHTML = picks.map((tk) => {
    const c = byTicker(tk);
    return `<button type="button" class="chip sp-chip" data-unpick="${esc(tk)}" aria-label="${esc(t("sp.unpick", { ticker: tk, name: c ? c.n : tk }))}">${esc(tk)} ✕</button>`;
  }).join("");
  const show = $<HTMLAnchorElement>("spShow");
  show.textContent = n ? tn("sp.show", n) : t("sp.showNone");
  show.setAttribute("aria-disabled", String(!n));
  show.href = n ? `sp500-view.html?${new URLSearchParams({ t: picks.join(","), ...langQuery() })}` : "sp500-view.html";
  $("spClear").hidden = !n;
  updateUrl();
}

function toggle(ticker: string) {
  const r = togglePick(picks, ticker);
  if (r.refused) { status(t("sp.full", { max: MAX_PICKS })); return; }
  const added = r.picks.length > picks.length;
  picks = r.picks;
  const c = byTicker(ticker);
  status(t(added ? "sp.added" : "sp.removed", { name: c ? c.n : ticker, n: picks.length, max: MAX_PICKS }));
  renderPicks();
  syncList();
}

// ---------- events ----------
$("spList").addEventListener("change", (e: Event) => {
  const box = (e.target as HTMLInputElement);
  if (!box.dataset.t) return;
  toggle(box.dataset.t);
  if (box.checked !== picks.includes(box.dataset.t)) box.checked = !box.checked;  // an 11th tick is undone
});
$("spChips").addEventListener("click", (e: Event) => {
  const chip = ((e.target as HTMLElement).closest("[data-unpick]") as HTMLElement | null);
  if (chip) { toggle(chip.dataset.unpick || ""); $("spSearch").focus(); }
});
$("spShow").addEventListener("click", (e: Event) => { if (!picks.length) e.preventDefault(); });
$("spClear").addEventListener("click", () => {
  picks = [];
  status(t("sp.cleared"));
  renderPicks();
  syncList();
  $("spSearch").focus();
});
let typing = 0;
$("spSearch").addEventListener("input", () => { clearTimeout(typing); typing = window.setTimeout(renderList, 120); });
$("spSector").addEventListener("change", renderList);
$$(".lang-switch [data-lang]").forEach((btn) => btn.addEventListener("click", () => {
  if (!useLang(btn.dataset.lang)) return;
  renderSource();
  renderPicks();
  renderList();
}));
bindSlashShortcut("spSearch");

function renderSource() {
  if (!source.generated) return;
  const date = new Date(`${source.generated}T12:00:00Z`).toLocaleDateString(getLocale(), { dateStyle: "medium" });
  $("spSource").textContent = t("sp.source", { date, n: source.count });
}

// ---------- start ----------
const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
const fromLink = parsePicks(params.get("pick"));
picks = fromLink.picks;
renderPicks();
if (fromLink.dropped) status(t("sp.dropped", { max: MAX_PICKS, n: fromLink.dropped }));
fetch("data/sp500.json")
  .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
  .then((data) => {
    companies = data.companies;
    source = { generated: data.generated, count: data.count };
    for (const s of sectors(companies)) $("spSector").insertAdjacentHTML("beforeend", `<option>${esc(s)}</option>`);
    picks = picks.filter((tk) => byTicker(tk));  // a link can't pick a company that isn't in the list
    renderSource();
    renderPicks();
    renderList();
  })
  .catch(() => { $("spList").innerHTML = `<p class="error-text">${esc(t("sp.loadError"))}</p>`; });
