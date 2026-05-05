import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "src/shared/grid.js",
  "src/browser/defaults.js",
  "src/browser/geometry.js",
  "src/browser/utils.js",
  "src/browser/dom-collector.js",
  "src/browser/reporter.js",
  "src/browser/hover-sensor.js",
  "src/browser/page-signature.js",
  "src/browser/semantic-map.js",
  "src/browser/scanner.js",
  "src/browser/lens.js",
  "src/browser/index.js",
];

const chunks = [];

for (const file of files) {
  const source = await readFile(resolve(root, file), "utf8");
  chunks.push(`\n/* ${file} */\n${stripModuleSyntax(source)}`);
}

const bundle = `/*
 * PALS Engine browser bundle.
 * Generated from src/browser modules by scripts/build-browser-bundle.js.
 */
(function installPalsEngine(root) {
  "use strict";
${chunks.join("\n")}

  const engine = createPalsEngine(root);
  root.PALS = engine;
  root.PALSEngine = engine;
  root.PonteiroRelacional = createLegacyAdapter(engine);
})(typeof window !== "undefined" ? window : globalThis);
`;

await writeFile(resolve(root, "pals-engine.js"), bundle);
await mkdir(resolve(root, "extension/vendor"), { recursive: true });
await writeFile(resolve(root, "extension/vendor/pals-engine.js"), bundle);
await mkdir(resolve(root, "site/vendor"), { recursive: true });
await writeFile(resolve(root, "site/vendor/pals-engine.js"), bundle);

function stripModuleSyntax(source) {
  return source
    .replace(/^import[\s\S]*?;\n/gm, "")
    .replace(/^export function /gm, "function ")
    .replace(/^export const /gm, "const ")
    .replace(/^export let /gm, "let ")
    .replace(/^export class /gm, "class ")
    .replace(/^export \{[^}]+\};\n/gm, "");
}
