// Allure 3 report settings: `npm run report` turns allure-results/ into a static site in allure-report/.
import { defineConfig } from "allure";

export default defineConfig({
  name: "10-Year Stock Value Analysis · test report",
  output: "./allure-report",
  plugins: {
    awesome: {
      options: {
        reportName: "10-Year Stock Value Analysis · test report",
        reportLanguage: "en",
        groupBy: ["parentSuite", "suite", "subSuite"],
        singleFile: true, // one self-contained index.html: opens straight from a downloaded CI artifact
      },
    },
  },
});
