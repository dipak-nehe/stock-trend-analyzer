// Translations. t("key", { name: value }) returns the current language's text with {name} filled in;
// tn() picks a ".one" or ".other" form by count. English is the fallback for any missing key.
import EN from "./strings/en.js";
import ES from "./strings/es.js";

export const LANGS = { en: "English", es: "Español" };
const DICTS = { en: EN, es: ES };
const LOCALES = { en: "en-US", es: "es-ES" };
let lang = "en";

export const getLang = () => lang;
export const getLocale = () => LOCALES[lang];
export function setLang(l) { lang = DICTS[l] ? l : "en"; return lang; }

export function t(key, vars = {}) {
  const text = DICTS[lang][key] ?? EN[key];
  if (text == null) return key;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export const has = (key) => DICTS[lang][key] != null || EN[key] != null;

export const tn = (key, count, vars = {}) => t(`${key}.${count === 1 ? "one" : "other"}`, { n: count, ...vars });

// Best match for the visitor's browser languages, e.g. ["es-MX", "en"] -> "es".
export function detectLang(languages = []) {
  for (const l of languages) {
    const base = String(l).toLowerCase().split("-")[0];
    if (DICTS[base]) return base;
  }
  return "en";
}

export const dictionaries = DICTS;
