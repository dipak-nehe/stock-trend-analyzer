import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHECKLISTS, FLAG_GROUPS, checklistHtml, flagsHtml, measuresHtml } from "../../public/js/methodology.js";
import { valueChecks } from "../../public/js/valuation.js";
import { durableChecks } from "../../public/js/durable.js";
import { analyze } from "../../public/js/flags.js";
import { setLang } from "../../public/js/i18n.js";
import EN from "../../public/js/strings/en.js";
import ES from "../../public/js/strings/es.js";
import { company } from "./company.js";

const ids = (key) => CHECKLISTS.find((c) => c[0] === key)[2];

test("the page lists exactly the tests each checklist runs, in the same order", () => {
  const d = company(), r = analyze(d), v = valueChecks(d, 50, r);
  for (const key of ["graham", "buffett", "lynch", "piotroski"]) assert.deepEqual(ids(key), v[key].map((c) => c.id), key);
  assert.deepEqual([...ids("durableIncome"), ...ids("durableBalance"), ...ids("durableCash")], durableChecks(d, r).map((c) => c.id));
});

test("every red flag the code can raise is on the page, with its rule in English and Spanish", () => {
  const src = readFileSync(new URL("../../public/js/flags.js", import.meta.url), "utf8");
  const raised = new Set([...src.matchAll(/add\([^,]+,\s*"(\w+)"/g)].map((m) => m[1]));
  for (const m of src.matchAll(/"(dividend\w+)" : "(dividend\w+)"/g)) { raised.add(m[1]); raised.add(m[2]); }  // the cut / suspended pair
  const listed = FLAG_GROUPS.flatMap(([, flags]) => flags.map(([id]) => id));
  assert.deepEqual([...raised].filter((id) => !listed.includes(id)), [], "flags missing from the page");
  assert.deepEqual(listed.filter((id) => !raised.has(id)), [], "flags on the page that the code never raises");
  for (const id of listed) {
    assert.ok(EN[`meth.flag.${id}`] && ES[`meth.flag.${id}`], `rule text for ${id}`);
    assert.ok(EN[`flag.${id}.title`], `title for ${id}`);
  }
});

test("the tables render in the page's language", () => {
  setLang("en");
  assert.match(checklistHtml("graham", "h-graham"), /aria-labelledby="h-graham".*<th scope="row">Adequate size<\/th>/s);
  assert.match(checklistHtml("buffett", "h-buffett"), /Average gross margin of at least 40%; for companies that don't report gross profit/);
  assert.match(flagsHtml(), /<span class="meth-sev critical">Critical<\/span>/);
  assert.match(measuresHtml(), /Balance-sheet checks passed/);
  setLang("es");
  try {
    assert.match(flagsHtml(), /Crítica/);
    assert.match(checklistHtml("durableBalance", "h-durableBalance"), /Autocartera/);
  } finally {
    setLang("en");
  }
});
