// The All companies page (companies.html): loads public/data/companies.json once, then filters, sorts and shows it a
// page at a time. The search, filters and sort stay in the address (?q=coca&ind=2080&ex=NYSE&sort=ticker), so a
// filtered list can be bookmarked and shared. The rules are in companies.ts.
import { $, $$, applyStaticText, bindSlashShortcut, initialLang, targetOf, useLang } from "./page.ts";
import { PAGE_SIZE, exchangeOptions, findCompanies, industryOf, industryOptions, nextSort, type Directory, type Row, type SortKey } from "./companies.ts";
import { esc, langQuery } from "./stock-table.ts";
import { getLang, getLocale, setLang, t } from "./i18n.ts";

let dir: Directory | null = null;
let shown = PAGE_SIZE;
let order: { sort: SortKey; dir: 1 | -1 } = { sort: "name", dir: 1 };

const input = (id: string) => $<HTMLInputElement>(id);
const select = (id: string) => $<HTMLSelectElement>(id);
const count = (n: number) => new Intl.NumberFormat(getLocale()).format(n);
const exchangeName = (ex: string) => (ex === "other" ? t("co.otherExchange") : ex);

function updateUrl() {
  const q = new URLSearchParams();
  const text = input("coSearch").value.trim();
  if (text) q.set("q", text);
  if (select("coIndustry").value) q.set("ind", select("coIndustry").value);
  if (select("coExchange").value) q.set("ex", select("coExchange").value);
  if (order.sort !== "name" || order.dir !== 1) q.set("sort", `${order.dir === -1 ? "-" : ""}${order.sort}`);
  for (const [k, v] of Object.entries(langQuery())) q.set(k, v);
  history.replaceState(null, "", `${location.pathname}${q.toString() ? `?${q}` : ""}`);
}

function fillFilters(d: Directory) {
  const ind = select("coIndustry"), ex = select("coExchange");
  const keepI = ind.value, keepE = ex.value;
  ind.innerHTML = `<option value="">${esc(t("co.allIndustries"))}</option>`
    + industryOptions(d).map(([code, name, n]) => `<option value="${code}">${esc(name)} (${count(n)})</option>`).join("");
  ex.innerHTML = `<option value="">${esc(t("co.allExchanges"))}</option>`
    + exchangeOptions(d).map(([e, n]) => `<option value="${esc(e)}">${esc(exchangeName(e))} (${count(n)})</option>`).join("");
  ind.value = keepI; ex.value = keepE;
}

function header() {
  const col = (key: SortKey, label: string) => {
    const on = order.sort === key, aria = on ? (order.dir === 1 ? "ascending" : "descending") : "none";
    return `<th scope="col" aria-sort="${aria}"><button type="button" class="pf-sort" data-sort="${key}">${esc(label)}${on ? (order.dir === 1 ? " ▲" : " ▼") : ""}</button></th>`;
  };
  return `<thead><tr>${col("name", t("co.col.name"))}${col("ticker", t("co.col.ticker"))}${col("exchange", t("co.col.exchange"))}${col("industry", t("co.col.industry"))}</tr></thead>`;
}

function render() {
  if (!dir) return;
  const d = dir;
  const rows = findCompanies(d, { text: input("coSearch").value, industry: select("coIndustry").value, exchange: select("coExchange").value, ...order });
  const page = rows.slice(0, shown);
  const link = (r: Row) => `/stock/${encodeURIComponent(r[0])}${getLang() !== "en" ? `?lang=${getLang()}` : ""}`;
  $("coTable").innerHTML = header() + "<tbody>" + (page.length
    ? page.map((r) => `<tr data-testid="co-row"><th scope="row"><a href="${link(r)}">${esc(r[1])}</a><span class="co-ind" aria-hidden="true">${esc(industryOf(d, r))}</span></th><td>${esc(r[0])}</td>`
      + `<td>${esc(exchangeName(r[2]))}</td><td>${r[3] ? esc(industryOf(d, r)) : `<span class="muted">${esc(t("co.noIndustry"))}</span>`}</td></tr>`).join("")
    : `<tr><td colspan="4" class="muted">${esc(t("co.none"))}</td></tr>`) + "</tbody>";
  $("coCount").textContent = t(rows.length > page.length ? "co.countSome" : "co.countAll",
    { shown: count(page.length), n: count(rows.length), total: count(d.count) });
  const more = $<HTMLButtonElement>("coMore");
  more.hidden = rows.length <= page.length;
  more.textContent = t("co.more", { n: count(Math.min(PAGE_SIZE, rows.length - page.length)) });
  $("coSource").textContent = t("co.source", { date: d.generated });
  updateUrl();
}

// Typing, filtering and sorting start from the first page again
const restart = () => { shown = PAGE_SIZE; render(); };
let timer = 0;
input("coSearch").addEventListener("input", () => { clearTimeout(timer); timer = window.setTimeout(restart, 120); });
select("coIndustry").addEventListener("change", restart);
select("coExchange").addEventListener("change", restart);
$("coMore").addEventListener("click", () => { shown += PAGE_SIZE; render(); });
$("coTable").addEventListener("click", (e) => {
  const b = targetOf(e).closest<HTMLElement>("[data-sort]");
  if (!b) return;
  order = nextSort(order, b.dataset.sort as SortKey);
  restart();
  $("coTable").querySelector<HTMLElement>(`[data-sort="${order.sort}"]`)?.focus();
});
$$(".lang-switch [data-lang]").forEach((btn) => btn.addEventListener("click", () => {
  if (useLang(btn.dataset.lang)) { if (dir) fillFilters(dir); render(); }
}));

const params = new URLSearchParams(location.search);
setLang(initialLang(params));
applyStaticText();
bindSlashShortcut("coSearch");
input("coSearch").value = params.get("q") ?? "";
const sortParam = params.get("sort") ?? "";
const sortKey = sortParam.replace(/^-/, "");
if (["name", "ticker", "exchange", "industry"].includes(sortKey)) order = { sort: sortKey as SortKey, dir: sortParam.startsWith("-") ? -1 : 1 };
$("coCount").textContent = t("co.loading");
fetch("data/companies.json").then((res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Directory>;
}).then((d) => {
  dir = d;
  fillFilters(d);
  select("coIndustry").value = params.get("ind") ?? "";
  select("coExchange").value = params.get("ex") ?? "";
  render();
}).catch(() => { $("coCount").textContent = t("co.error"); });
