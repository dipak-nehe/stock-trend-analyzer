// Builds the browser code: each page's entry in src/ (TypeScript) becomes one minified ES module in public/js/, under
// the same name the page's <script> already loads (js/app.js, js/funds-app.js…). Code shared by several pages goes into
// hashed chunks in public/js/chunks/, so the browser caches it once. Source maps sit next to each file.
//   node scripts/build.mjs           build once (run by `npm run build`, by Vercel on deploy, and before the browser tests)
//   node scripts/build.mjs --watch   rebuild on every change while working on the page
import { build, context } from "esbuild";
import { rmSync } from "node:fs";

const ENTRIES = ["app", "compare-app", "disclaimer-app", "funds-app", "methodology-app", "portfolio-app", "sp500-app", "sp500-view-app"];
const OUT = "public/js";

const options = {
  entryPoints: ENTRIES.map((name) => `src/${name}.ts`),
  outdir: OUT,
  bundle: true,
  splitting: true,          // shared code in chunks, loaded once for every page that needs it
  format: "esm",
  target: "es2022",
  minify: true,
  sourcemap: "linked",
  chunkNames: "chunks/[name]-[hash]",
  entryNames: "[name]",     // public/js/app.js: the HTML stays as it is
  legalComments: "none",
  logLevel: "info",
};

rmSync(OUT, { recursive: true, force: true });
if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
