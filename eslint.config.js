// ESLint flat config: `npm run lint`.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["public/vendor/**", "node_modules/**", "allure-report/**", "allure-results/**", ".venv/**", "test-results/**", "playwright-report/**", "load/report.html"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module" },
    rules: {
      // A local variable named like an import hid the translate function once ("t is not a function").
      "no-shadow": ["error", { hoist: "functions" }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "eqeqeq": ["error", "always", { null: "ignore" }],   // `x == null` deliberately covers undefined too
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: ["public/js/**/*.js"],
    languageOptions: { globals: { ...globals.browser, Chart: "readonly" } },
  },
  {
    // k6 load scripts run in k6's own JavaScript runtime, which provides __ENV and __VU.
    files: ["load/**/*.js"],
    languageOptions: { globals: { __ENV: "readonly", __VU: "readonly", __ITER: "readonly", console: "readonly" } },
  },
  {
    files: ["tests/js/**", "*.js", "*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
];
