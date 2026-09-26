// A node:test reporter that writes Allure result files, so the JavaScript unit tests appear in the Allure report
// next to the Python and browser tests. Usage:
//   node --test --test-reporter=spec --test-reporter-destination=stdout \
//        --test-reporter=./tests/js/allure-reporter.mjs --test-reporter-destination=stdout tests/js/*.test.js
// Results go to $ALLURE_RESULTS_DIR (default ./allure-results).
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const OUT = process.env.ALLURE_RESULTS_DIR || "allure-results";

export default async function* allureReporter(source) {
  mkdirSync(OUT, { recursive: true });
  let written = 0;
  for await (const event of source) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    const { name, file = "", nesting, details = {} } = event.data;
    if (nesting > 0 || details.type === "suite") continue;         // top-level tests only
    const stop = Date.now(), start = Math.round(stop - (details.duration_ms || 0));
    const suite = basename(file).replace(/\.test\.js$/, "");
    const err = details.error?.cause || details.error;
    const result = {
      uuid: randomUUID(),
      historyId: createHash("md5").update(`${suite}#${name}`).digest("hex"),
      name,
      fullName: `${suite}: ${name}`,
      status: event.type === "test:pass" ? "passed" : (err?.code === "ERR_ASSERTION" ? "failed" : "broken"),
      stage: "finished",
      start,
      stop,
      labels: [
        { name: "parentSuite", value: "0 · JavaScript unit (Node)" },
        { name: "suite", value: suite },
        { name: "language", value: "javascript" },
        { name: "framework", value: "node:test" },
      ],
      ...(err ? { statusDetails: { message: String(err.message || err), trace: String(err.stack || "") } } : {}),
    };
    writeFileSync(join(OUT, `${result.uuid}-result.json`), JSON.stringify(result));
    written++;
  }
  yield `Allure: wrote ${written} JavaScript test results to ${OUT}/\n`;
}
