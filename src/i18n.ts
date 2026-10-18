// Translations. t("key", { name: value }) returns the current language's text with {name} filled in;
// tn() picks a ".one" or ".other" form by count. English is the fallback for any missing key.
import EN from "./strings/en.ts";
import ES from "./strings/es.ts";

export type Lang = "en" | "es";
/** Values filled into a text's {placeholders}. */
export type Vars = Record<string, string | number>;
type Dict = Record<string, string>;

export const LANGS: Record<Lang, string> = { en: "English", es: "Español" };
const DICTS: Record<Lang, Dict> = { en: EN, es: ES };
const LOCALES: Record<Lang, string> = { en: "en-US", es: "es-ES" };
const isLang = (l: string): l is Lang => l in DICTS;
let lang: Lang = "en";

export const getLang = (): Lang => lang;
export const getLocale = (): string => LOCALES[lang];
export function setLang(l: string): Lang { lang = isLang(l) ? l : "en"; return lang; }

export function t(key: string, vars: Vars = {}): string {
  const text = DICTS[lang][key] ?? (EN as Dict)[key];
  if (text == null) return key;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const has = (key: string): boolean => DICTS[lang][key] != null || (EN as Dict)[key] != null;

export const tn = (key: string, count: number, vars: Vars = {}): string => t(`${key}.${count === 1 ? "one" : "other"}`, { n: count, ...vars });

// Best match for the visitor's browser languages, e.g. ["es-MX", "en"] -> "es".
export function detectLang(languages: readonly string[] = []) {
  for (const l of languages) {
    const base = String(l).toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en" as Lang;
}

export const dictionaries = DICTS;
