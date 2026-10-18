// "How we calculate" page wiring: the rule tables (methodology.ts) in the page's language.
import { $, $$, applyStaticText, initialLang, useLang } from "./page.ts";
import { checklistHtml, flagsHtml, measuresHtml } from "./methodology.ts";
import { setLang, t } from "./i18n.ts";

function render() {
  $("methFlags").innerHTML = flagsHtml();
  $("methGraham").innerHTML = checklistHtml("graham", "h-graham");
  $("methBuffett").innerHTML = checklistHtml("buffett", "h-buffett");
  $("methLynch").innerHTML = checklistHtml("lynch", "h-lynch");
  $("methPiotroski").innerHTML = checklistHtml("piotroski", "h-piotroski");
  $("methDurable").innerHTML = ["durableIncome", "durableBalance", "durableCash"]
    .map((key) => `<h5 id="h-${key}">${t(`meth.group.${key}`)}</h5>${checklistHtml(key, `h-${key}`)}`).join("");
  $("methMeasures").innerHTML = measuresHtml();
}

$$(".lang-switch [data-lang]").forEach((btn) => btn.addEventListener("click", () => { if (useLang(btn.dataset.lang ?? "en")) render(); }));

setLang(initialLang(new URLSearchParams(location.search)));
applyStaticText();
render();
