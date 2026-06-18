/**
 * Pre-builds Tailwind CSS once before Vite starts.
 * This avoids the Tailwind file-watcher/HMR loop caused by
 * the 500KB+ SuperAdminDashboard.tsx in the Replit environment.
 *
 * Output: src/styles/tailwind-built.css  (imported by main.tsx)
 * Run  : node scripts/build-css.mjs
 */

import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath  = resolve(__dirname, "../src/styles/index.css");
const outputPath = resolve(__dirname, "../src/styles/tailwind-built.css");

console.log("Building Tailwind CSS...");

try {
  const css = readFileSync(inputPath, "utf-8");
  const result = await postcss([tailwindcss(), autoprefixer()]).process(css, {
    from: inputPath,
    to:   outputPath,
  });
  writeFileSync(outputPath, result.css);
  console.log("✓ Tailwind CSS built →", outputPath);
} catch (err) {
  console.error("CSS build failed:", err.message);
  process.exit(1);
}
