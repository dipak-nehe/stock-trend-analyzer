// The disclaimer page: static text in English (in the HTML) or Spanish (strings/es.ts), and the language switch.
import { $$, applyStaticText, initialLang, useLang } from "./page.ts";
import { setLang } from "./i18n.ts";

setLang(initialLang(new URLSearchParams(location.search)));
applyStaticText();

$$(".lang-switch [data-lang]").forEach((btn) => btn.addEventListener("click", () => {
  if (!useLang(btn.dataset.lang ?? "en")) return;
  // keep the address shareable in the chosen language
  history.replaceState(null, "", btn.dataset.lang === "en" ? location.pathname : `${location.pathname}?lang=${btn.dataset.lang}`);
}));
