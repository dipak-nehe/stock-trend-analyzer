// Page helpers shared by index.html (app.ts) and compare.html (compare-app.ts).
import { detectLang, dictionaries, getLang, setLang, t } from "./i18n.ts";
import type { Financials, Insiders } from "./types.ts";

// Element lookups: callers only use ids that exist in their page. $<HTMLInputElement>("price") for an input's value.
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
export const $$ = (selector: string): HTMLElement[] => [...document.querySelectorAll(selector)].map((el) => (el as HTMLElement));
export const targetOf = (e: Event) => (e.target as HTMLElement);

// Bump when the API response format changes, so no cache serves an older shape to newer code.
export const API_VERSION = 13;

// The server answers in English; show its message as-is in English, otherwise translate by type.
export function errorText(status: number, message: string, ticker: string) {
  if (getLang() === "en") return message;
  const key = status === 400 ? (/enter a ticker/i.test(message) ? "error.empty" : "error.badTicker")
    : status === 404 ? (/no financial data/i.test(message) ? "error.noData" : "error.notFound")
    : status === 502 ? (/limiting/i.test(message) ? "error.busy" : "error.upstream")
    : status === 504 ? "error.timeout" : "error.generic";
  return t(key, { ticker });
}

/** Fetch one company's financials; throws an Error with a message ready to show. */
export async function fetchFinancials(ticker: string): Promise<Financials> {
  const res = await fetch(`/api/financials?ticker=${encodeURIComponent(ticker)}&v=${API_VERSION}`);
  const body = await res.json();
  if (!res.ok) throw new Error(errorText(res.status, body.error || `HTTP ${res.status}`, ticker));
  return body;
}

/**
 * Fetch one company's insider-trades summary (asked for after the main results, because reading its Form 4s the
 * first time takes several seconds). Throws on failure. */
export async function fetchInsiders(ticker: string): Promise<Insiders | null> {
  const res = await fetch(`/api/insiders?ticker=${encodeURIComponent(ticker)}&v=${API_VERSION}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).insiders;
}

// Static text: the English stays in the HTML (kept in data-en the first time) and other languages
// come from the "ui.*" keys in strings/<lang>.ts.
export function applyStaticText() {
  const lang = getLang(), dict = dictionaries[lang];
  document.documentElement.lang = lang;
  for (const el of $$("[data-i18n]")) {
    if (!("en" in el.dataset)) el.dataset.en = el.innerHTML;
    el.innerHTML = (lang === "en" ? el.dataset.en : dict[el.dataset.i18n ?? ""] ?? el.dataset.en) ?? "";
  }
  for (const el of ($$("[data-i18n-placeholder]") as HTMLInputElement[])) {
    if (!("enPlaceholder" in el.dataset)) el.dataset.enPlaceholder = el.placeholder;
    el.placeholder = (lang === "en" ? el.dataset.enPlaceholder : dict[el.dataset.i18nPlaceholder ?? ""] ?? el.dataset.enPlaceholder) ?? "";
  }
  for (const el of $$("[data-i18n-aria]")) {
    if (!("enAria" in el.dataset)) el.dataset.enAria = el.getAttribute("aria-label") ?? "";
    el.setAttribute("aria-label", (lang === "en" ? el.dataset.enAria : dict[el.dataset.i18nAria ?? ""] ?? el.dataset.enAria) ?? "");
  }
  $$(".lang-switch [data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  // Home (and other links back to the start page) go to a fresh landing page in the same language
  $$("a.home-link, a[data-start-link]").forEach((a) => a.setAttribute("href", lang === "en" ? "./" : `./?lang=${lang}`));
  $$("a[data-compare-link]").forEach((a) => a.setAttribute("href", lang === "en" ? "compare.html" : `compare.html?lang=${lang}`));
  $$("a[data-portfolio-link]").forEach((a) => a.setAttribute("href", lang === "en" ? "portfolio.html" : `portfolio.html?lang=${lang}`));
  $$("a[data-sp500-link]").forEach((a) => a.setAttribute("href", lang === "en" ? "sp500.html" : `sp500.html?lang=${lang}`));
  $$("a[data-companies-link]").forEach((a) => a.setAttribute("href", lang === "en" ? "companies.html" : `companies.html?lang=${lang}`));
  $$("a[data-funds-link]").forEach((a) => a.setAttribute("href", lang === "en" ? "funds.html" : `funds.html?lang=${lang}`));
}

/**
 * Language from the link, then the remembered choice, then the browser. A language that comes from the link is
 * remembered too, so it stays on across pages and later visits (a Spanish link would otherwise be forgotten at the
 * first page without ?lang). */
export function initialLang(params: URLSearchParams) {
  const fromLink = params.get("lang");
  if (fromLink && fromLink in dictionaries) {
    try { localStorage.setItem("lang", fromLink); } catch { /* storage unavailable: links still carry ?lang */ }
    return fromLink;
  }
  try { const saved = localStorage.getItem("lang"); if (saved && saved in dictionaries) return saved; } catch { /* ignore */ }
  return detectLang(navigator.languages || [navigator.language]);
}

/** Switch language (remembered for next time). Returns false if it was already active. */
export function useLang(choice: string | undefined) {
  const lang = choice ?? "en";
  if (lang === getLang()) return false;
  setLang(lang);
  try { localStorage.setItem("lang", lang); } catch { /* storage unavailable: the link still carries ?lang */ }
  applyStaticText();
  return true;
}

/** "/" focuses the given search box from anywhere, unless the user is typing in a field. */
export function bindSlashShortcut(inputId: string) {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || targetOf(e).closest("input, textarea, select")) return;
    e.preventDefault();
    $(inputId).focus();
    $<HTMLInputElement>(inputId).select();
  });
}

/**
 * Keep a search button clickable only while its box has something in it (an empty search did nothing). The buttons
 * start disabled in the HTML, so this also enables them once the page's script has loaded. Returns the update function,
 * for callers that change the box's value in code (which fires no input event).
 */
export function enableWhenFilled(inputId: string, buttonId: string) {
  const update = () => { ($(buttonId) as HTMLButtonElement).disabled = !$<HTMLInputElement>(inputId).value.trim(); };
  $(inputId).addEventListener("input", update);
  window.addEventListener("pageshow", update); // the browser can restore a typed value on Back
  update();
  return update;
}

/** Link that adds a ticker to "My portfolio" (portfolio.html), keeping the language. */
export function portfolioHref(ticker: string) {
  const q = new URLSearchParams({ add: ticker });
  if (getLang() !== "en") q.set("lang", getLang());
  return `portfolio.html?${q}`;
}

/** Link to the compare page for a ticker, keeping the language. */
export function compareHref(ticker: string) {
  const q = new URLSearchParams({ a: ticker });
  if (getLang() !== "en") q.set("lang", getLang());
  return `compare.html?${q}`;
}
