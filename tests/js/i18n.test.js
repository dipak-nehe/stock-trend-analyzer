import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import EN from "../../public/js/strings/en.js";
import ES from "../../public/js/strings/es.js";
import { detectLang, getLang, setLang, t, tn } from "../../public/js/i18n.js";
import { fixed, money, num, pct, perShare } from "../../public/js/format.js";
import { analyze } from "../../public/js/flags.js";
import { company } from "./company.js";

afterEach(() => setLang("en"));

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s) => [...s.matchAll(/<(\/?)(\w+)/g)].map((m) => m[1] + m[2]).sort();

test("every English string has a Spanish translation with the same placeholders and markup", () => {
  const missing = Object.keys(EN).filter((k) => !(k in ES));
  assert.deepEqual(missing, [], `missing Spanish keys: ${missing.join(", ")}`);
  for (const [k, en] of Object.entries(EN)) {
    assert.deepEqual(placeholders(ES[k]), placeholders(en), `placeholders differ for ${k}`);
    assert.deepEqual(tags(ES[k]), tags(en), `HTML tags differ for ${k}`);
  }
  const extra = Object.keys(ES).filter((k) => !(k in EN) && !k.startsWith("ui."));
  assert.deepEqual(extra, [], `Spanish keys with no English: ${extra.join(", ")}`);
});

test("every translatable element in every page has a Spanish entry, and no Spanish entry is unused", () => {
  const tagged = (/** @type {string} */ page) => {
    const html = readFileSync(new URL(`../../public/${page}`, import.meta.url), "utf8");
    return [...html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)].map((m) => m[1]);
  };
  const index = tagged("index.html"), compare = tagged("compare.html"), disclaimer = tagged("disclaimer.html");
  const portfolio = tagged("portfolio.html");
  assert.ok(index.length > 100, `only ${index.length} tagged elements in index.html`);
  assert.ok(compare.length > 20, `only ${compare.length} tagged elements in compare.html`);
  assert.ok(disclaimer.length > 15, `only ${disclaimer.length} tagged elements in disclaimer.html`);
  assert.ok(portfolio.length > 15, `only ${portfolio.length} tagged elements in portfolio.html`);
  const keys = [...index, ...compare, ...disclaimer, ...portfolio];
  const missing = keys.filter((k) => !(k in ES));
  assert.deepEqual(missing, [], `untranslated page text: ${missing.join(", ")}`);
  const unused = Object.keys(ES).filter((k) => k.startsWith("ui.") && !keys.includes(k));
  assert.deepEqual(unused, [], `unused Spanish page strings: ${unused.join(", ")}`);
});

test("Spanish numbers follow Spain's conventions", () => {
  setLang("es");
  assert.equal(money(416161e6, "USD"), "416,2 mil M US$");
  assert.equal(money(-267e6, "USD"), "-267,0 M US$");
  assert.equal(money(2.26e12, "TWD"), "2,3 B TWD");
  assert.equal(perShare(-0.06, "USD"), "-0,06 US$");
  assert.equal(pct(0.0756), "7,6 %");
  assert.equal(num(15004.7e6), "15,00 mil M");
  assert.equal(fixed(1.41, 2), "1,41");
});

test("English numbers are unchanged", () => {
  assert.equal(money(416161e6, "USD"), "$416.2B");
  assert.equal(pct(0.0756), "7.6%");
  assert.equal(fixed(1.41, 2), "1.41");
});

test("t() fills placeholders, falls back to English, and tn() picks singular or plural", () => {
  setLang("es");
  assert.equal(t("glance.clean", { year: 2016 }), "Limpio desde 2016");
  assert.equal(tn("problems.late", 1), "1 presentación tardía");
  assert.equal(tn("problems.late", 13), "13 presentaciones tardías");
  assert.equal(t("no.such.key"), "no.such.key");
  setLang("fr");                     // unsupported languages fall back to English
  assert.equal(getLang(), "en");
});

test("the browser language decides the default", () => {
  assert.equal(detectLang(["es-ES", "en"]), "es");
  assert.equal(detectLang(["es-MX"]), "es");
  assert.equal(detectLang(["fr-FR", "es"]), "es");
  assert.equal(detectLang(["de-DE"]), "en");
  assert.equal(detectLang([]), "en");
});

test("the analysis itself is produced in Spanish", () => {
  setLang("es");
  const flags = analyze(company({ netIncome: [...Array(9).fill(100e6), -50e6] })).flags;
  const loss = flags.find((f) => f.id === "recentLosses");
  assert.equal(loss.title, "Pérdidas recientes");
  assert.equal(loss.why, "Pérdidas netas en: 2025.");
  assert.match(loss.help, /^La empresa ha gastado/);
});

test("every results tab has a name in both languages, for the previous / next buttons", () => {
  // Regression: the Insiders tab had none, so its neighbours' buttons read "Next: tab.insiders →"
  const tabs = [...readFileSync(new URL("../../public/index.html", import.meta.url), "utf8").matchAll(/role="tab"[^>]*data-tab="(\w+)"/g)].map((m) => m[1]);
  assert.ok(tabs.length >= 7, `found tabs: ${tabs}`);
  for (const tab of tabs) {
    assert.ok(EN[`tab.${tab}`], `English name for the ${tab} tab`);
    assert.ok(ES[`tab.${tab}`], `Spanish name for the ${tab} tab`);
  }
});

