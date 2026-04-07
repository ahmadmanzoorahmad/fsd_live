#!/usr/bin/env node
/**
 * Build script: embed the Excel data file as a base64 string inside the
 * Netlify Function bundle so no runtime filesystem path resolution is needed.
 *
 * Run before `vite build` in the Netlify build command.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const src = path.join(root, "artifacts/api-server/data/fuel-subsidy.xlsx");
const dst = path.join(__dirname, "functions/initial-data.ts");

if (!fs.existsSync(src)) {
  console.error(`[generate-initial-data] ERROR: Source file not found: ${src}`);
  process.exit(1);
}

const buf = fs.readFileSync(src);
const b64 = buf.toString("base64");

const output = `// AUTO-GENERATED — do not edit manually. Run netlify/generate-initial-data.mjs to refresh.
// Base64-encoded fuel-subsidy.xlsx embedded at build time.
export const INITIAL_DATA = "${b64}";
`;

fs.writeFileSync(dst, output, "utf8");
console.log(
  `[generate-initial-data] Embedded ${src} → ${dst} (${(buf.length / 1024).toFixed(1)} KB)`,
);
