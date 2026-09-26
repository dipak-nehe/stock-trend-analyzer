// Page helpers shared by index.html (app.js) and compare.html (compare-app.js).
import { detectLang, dictionaries, getLang, setLang, t } from "./i18n.js";

// Element lookups. Typed loosely (inputs, buttons, details…): callers only use ids that exist in their page.
/** @param {string} id @returns {any} */
export const $ = (id) => document.getElementById(id);
/** @param {string} selector @returns {HTMLElement[]} */
export const $$ = (selector) => [...document.querySelectorAll(selector)].map((el) => /** @type {HTMLElement} */ (el));
/** @param {Event} e */
export const targetOf = (e) => /** @type {HTMLElement} */ (e.target);

// Bump when the API response format changes, so no cache serves an older shape to newer code.
export const API_VERSION = 4;

// The server answers in English; show its message as-is in English, otherwise translate by type.
/** @param {number} status @param {string} message @param {string} ticker */
export function errorText(status, message, ticker) {
  if (getLang() === "en") return message;
  const key = status === 400 ? (/enter a ticker/i.test(message) ? "error.empty" : "error.badTicker")
    : status === 404 ? (/no financial data/i.test(message) ? "error.noData" : "error.notFound")
    : status === 502 ? (/limiting/i.test(message) ? "error.busy" : "error.upstream")
    : status === 504 ? "error.timeout" : "error.generic";
  return t(key, { ticker });
}

/** Fetch one company's financials; throws an Error with a message ready to show. @param {string} ticker */
export async function fetchFinancials(ticker) {
  const res = await fetch(`/api/financials?ticker=${encodeURIComponent(ticker)}&v=${API_VERSION}`);
  const body = await res.json();
  if (!res.ok) throw new Error(errorText(res.status, body.error || `HTTP ${res.status}`, ticker));
  return body;
}

// Static text: the English stays in the HTML (kept in data-en the first time) and other languages
// come from the "ui.*" keys in strings/<lang>.js.
export function applyStaticText() {
  const lang = getLang(), dict = dictionaries[lang];
  document.documentElement.lang = lang;
  for (const el of $$("[data-i18n]")) {
    if (!("en" in el.dataset)) el.dataset.en = el.innerHTML;
    el.innerHTML = lang === "en" ? el.dataset.en : (dict[el.dataset.i18n] ?? el.dataset.en);
  }
  for (const el of /** @type {HTMLInputElement[]} */ ($$("[data-i18n-placeholder]"))) {
    if (!("enPlaceholder" in el.dataset)) el.dataset.enPlaceholder = el.placeholder;
    el.placeholder = lang === "en" ? el.dataset.enPlaceholder : (dict[el.dataset.i18nPlaceholder] ?? el.dataset.enPlaceholder);
  }
  $$(".lang-switch [data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
}

/** Language from the link, then the remembered choice, then the browser. @param {URLSearchParams} params */
export function initialLang(params) {
  if (params.get("lang") && dictionaries[params.get("lang")]) return params.get("lang");
  try { const saved = localStorage.getItem("lang"); if (saved && dictionaries[saved]) return saved; } catch { /* ignore */ }
  return detectLang(navigator.languages || [navigator.language]);
}

/** Switch language (remembered for next time). Returns false if it was already active. @param {string} lang */
export function useLang(lang) {
  if (lang === getLang()) return false;
  setLang(lang);
  try { localStorage.setItem("lang", lang); } catch { /* storage unavailable: the link still carries ?lang */ }
  applyStaticText();
  return true;
}

/** "/" focuses the given search box from anywhere, unless the user is typing in a field. @param {string} inputId */
export function bindSlashShortcut(inputId) {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || targetOf(e).closest("input, textarea, select")) return;
    e.preventDefault();
    $(inputId).focus();
    $(inputId).select();
  });
}

/** Link to the compare page for a ticker, keeping the language. @param {string} ticker */
export function compareHref(ticker) {
  const q = new URLSearchParams({ a: ticker });
  if (getLang() !== "en") q.set("lang", getLang());
  return `compare.html?${q}`;
}
