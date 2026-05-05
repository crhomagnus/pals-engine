#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildViewportGrid } from "../src/shared/grid.js";
import {
  buildRefinementPoints,
  buildSemanticSeedPoints,
  comparePageSignatures,
  pointKey,
  summarizeRegions,
} from "../src/shared/adaptive.js";
import {
  aggregatePointerSamples,
  generateMarkdownReport,
} from "../src/report/markdown.js";
import { compareScans, generateCompareMarkdown } from "../src/report/compare.js";
import { generateFindings } from "../src/report/findings.js";
import { generatePlaywrightSpec } from "../src/report/playwright-export.js";
import { createCdpBrowser } from "../src/node/cdp-driver.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

main().catch((error) => {
  console.error(`pals: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "scan") {
    await scanCommand(args);
    return;
  }

  if (command === "compare") {
    await compareCommand(args);
    return;
  }

  if (command === "export-playwright") {
    await exportPlaywrightCommand(args);
    return;
  }

  throw new Error(`unknown command "${command}"`);
}

async function exportPlaywrightCommand(args) {
  const options = parseExportPlaywrightArgs(args);
  const scan = JSON.parse(await readFile(options.scan, "utf8"));
  const spec = generatePlaywrightSpec(scan, {
    maxTargets: options.maxTargets,
    maxFields: options.maxFields,
    maxHoverRegions: options.maxHoverRegions,
    maxFindings: options.maxFindings,
  });
  await writeFile(options.out, spec);
  console.log(`PALS Playwright spec exported: ${options.out}`);
}

async function compareCommand(args) {
  const options = parseCompareArgs(args);
  const before = JSON.parse(await readFile(options.before, "utf8"));
  const after = JSON.parse(await readFile(options.after, "utf8"));
  const diff = compareScans(before, after);
  await writeFile(options.out, generateCompareMarkdown(diff));

  if (options.json) {
    await writeFile(options.json, JSON.stringify(diff, null, 2));
  }

  console.log(`PALS diff completed: ${options.out}`);
  if (options.json) console.log(`Raw diff saved: ${options.json}`);
}

async function scanCommand(args) {
  const options = parseScanArgs(args);
  const bundle = await readFile(resolve(root, "pals-engine.js"), "utf8");
  const playwright = await loadPlaywright();

  const scan = playwright
    ? await scanWithPlaywright(playwright, bundle, options)
    : await scanWithCdp(bundle, options);

  const markdown = generateMarkdownReport(scan);
  await writeFile(options.out, markdown);

  if (options.json) {
    await writeFile(options.json, JSON.stringify(scan, null, 2));
  }

  console.log(`PALS scan completed: ${options.out}`);
  if (options.json) console.log(`Raw scan saved: ${options.json}`);
}

async function scanWithPlaywright(playwright, bundle, options) {
  const browser = await playwright.chromium.launch({ headless: options.headless });

  try {
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
    });
    await page.goto(options.url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeout,
    });
    await page.addScriptTag({ content: bundle });

    const coarsePoints = buildViewportGrid({
      width: options.width,
      height: options.height,
      step: options.step,
      margin: options.margin,
    });
    const semanticSeed = await page.evaluate(() => window.PALS.tools.semanticMap());
    const scanPlan = await runPointerPlan({
      coarsePoints,
      options,
      semanticSeed,
      samplePoint: (point, phase) => samplePlaywrightPoint(page, point, phase, options),
    });

    const scan = {
      engine: "PALS",
      version: await page.evaluate(() => window.PALS.version),
      mode: options.adaptive
        ? "adaptive-pointer-grid-playwright"
        : "active-pointer-grid-playwright",
      url: options.url,
      createdAt: new Date().toISOString(),
      viewport: { width: options.width, height: options.height },
      grid: {
        step: options.step,
        margin: options.margin,
        coarsePoints: coarsePoints.length,
        semanticPoints: scanPlan.semanticPoints.length,
        refinedPoints: scanPlan.refinedPoints.length,
      },
      adaptive: options.adaptive,
      samples: scanPlan.samples,
      regions: scanPlan.regions,
      semantic: await page.evaluate(() => window.PALS.tools.semanticMap()),
      aggregate: aggregatePointerSamples(scanPlan.samples),
    };
    scan.findings = generateFindings(scan);
    return scan;
  } finally {
    await browser.close();
  }
}

async function scanWithCdp(bundle, options) {
  const browser = await createCdpBrowser({
    headless: options.headless,
    width: options.width,
    height: options.height,
  });

  try {
    const page = await browser.newPage({
      width: options.width,
      height: options.height,
    });
    await page.goto(options.url, options.timeout);
    await page.addScript(bundle);

    const coarsePoints = buildViewportGrid({
      width: options.width,
      height: options.height,
      step: options.step,
      margin: options.margin,
    });
    const semanticSeed = await page.evaluate("window.PALS.tools.semanticMap()");
    const scanPlan = await runPointerPlan({
      coarsePoints,
      options,
      semanticSeed,
      samplePoint: (point, phase) => sampleCdpPoint(page, point, phase, options),
    });

    const scan = {
      engine: "PALS",
      version: await page.evaluate("window.PALS.version"),
      mode: options.adaptive ? "adaptive-pointer-grid-cdp" : "active-pointer-grid-cdp",
      url: options.url,
      createdAt: new Date().toISOString(),
      viewport: { width: options.width, height: options.height },
      grid: {
        step: options.step,
        margin: options.margin,
        coarsePoints: coarsePoints.length,
        semanticPoints: scanPlan.semanticPoints.length,
        refinedPoints: scanPlan.refinedPoints.length,
      },
      adaptive: options.adaptive,
      samples: scanPlan.samples,
      regions: scanPlan.regions,
      semantic: await page.evaluate("window.PALS.tools.semanticMap()"),
      aggregate: aggregatePointerSamples(scanPlan.samples),
    };
    scan.findings = generateFindings(scan);
    return scan;
  } finally {
    await browser.close();
  }
}

async function runPointerPlan({ coarsePoints, options, semanticSeed, samplePoint }) {
  const samples = [];
  const visited = new Set();

  for (const point of coarsePoints) {
    visited.add(pointKey(point));
    samples.push(await samplePoint(point, "coarse"));
  }

  let refinedPoints = [];
  let semanticPoints = [];
  if (options.adaptive) {
    semanticPoints = buildSemanticSeedPoints(semanticSeed, {
      width: options.width,
      height: options.height,
      margin: options.margin,
      maxPoints: options.maxSemanticPoints,
      excludeKeys: visited,
    });

    for (const point of semanticPoints) {
      visited.add(pointKey(point));
      samples.push(await samplePoint(point, "semantic"));
    }

    refinedPoints = buildRefinementPoints(samples, {
      width: options.width,
      height: options.height,
      margin: options.margin,
      coarseStep: options.step,
      refineStep: options.refineStep,
      maxPoints: options.maxRefinePoints,
      excludeKeys: visited,
    });

    for (const point of refinedPoints) {
      visited.add(pointKey(point));
      samples.push(await samplePoint(point, "refined"));
    }
  }

  return {
    samples,
    semanticPoints,
    refinedPoints,
    regions: summarizeRegions(samples, {
      cellSize: options.regionSize || options.step,
    }),
  };
}

async function samplePlaywrightPoint(page, point, phase, options) {
  const before = await page.evaluate(() => window.PALS.tools.pageSignature());
  await page.mouse.move(point.x, point.y);
  if (options.hoverDelay > 0) await page.waitForTimeout(options.hoverDelay);

  const raw = await page.evaluate((scanPoint) => {
    const map = window.PALS.scanPoint(scanPoint);
    function cursorForSelector(selector) {
      try {
        const element = selector ? document.querySelector(selector) : null;
        return element ? getComputedStyle(element).cursor : null;
      } catch (_error) {
        return null;
      }
    }

    return {
      point: scanPoint,
      summary: map.summary,
      hitStack: map.hitStack,
      underPointer: window.PALS.tools.bodiesUnderPointer(map).map((item) => ({
        kind: item.kind,
        source: item.source,
        name: item.name,
        selector: item.selector,
        cursor: cursorForSelector(item.selector),
        distance: item.distance,
      })),
      blocked: map.blocked,
    };
  }, point);
  const after = await page.evaluate(() => window.PALS.tools.pageSignature());

  return {
    ...raw,
    phase,
    hoverDelta: comparePageSignatures(before, after),
  };
}

async function sampleCdpPoint(page, point, phase, options) {
  const before = await page.evaluate("window.PALS.tools.pageSignature()");
  await page.mouseMove(point.x, point.y);
  if (options.hoverDelay > 0) await page.wait(options.hoverDelay);

  const raw = await page.evaluate(`(() => {
    const scanPoint = ${JSON.stringify(point)};
    const map = window.PALS.scanPoint(scanPoint);
    return (${browserSampleFromMapSource()})(scanPoint, map);
  })()`);
  const after = await page.evaluate("window.PALS.tools.pageSignature()");

  return {
    ...raw,
    phase,
    hoverDelta: comparePageSignatures(before, after),
  };
}

function browserSampleFromMapSource() {
  return `function sampleFromMap(scanPoint, map) {
    function cursorForSelector(selector) {
      try {
        const element = selector ? document.querySelector(selector) : null;
        return element ? getComputedStyle(element).cursor : null;
      } catch (_error) {
        return null;
      }
    }

    return {
      point: scanPoint,
      summary: map.summary,
      hitStack: map.hitStack,
      underPointer: window.PALS.tools.bodiesUnderPointer(map).map((item) => ({
        kind: item.kind,
        source: item.source,
        name: item.name,
        selector: item.selector,
        cursor: cursorForSelector(item.selector),
        distance: item.distance,
      })),
      blocked: map.blocked,
    };
  }`;
}

function parseScanArgs(args) {
  const options = {
    url: null,
    out: "pals-scan-report.MD",
    json: null,
    width: 1280,
    height: 720,
    step: 160,
    margin: 8,
    hoverDelay: 80,
    adaptive: false,
    refineStep: 56,
    maxRefinePoints: 120,
    maxSemanticPoints: 80,
    regionSize: null,
    timeout: 30000,
    headless: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--") && !options.url) {
      options.url = arg;
      continue;
    }

    if (arg === "--out") options.out = requireValue(args, ++index, arg);
    else if (arg === "--json") options.json = requireValue(args, ++index, arg);
    else if (arg === "--width") options.width = numberValue(args, ++index, arg);
    else if (arg === "--height") options.height = numberValue(args, ++index, arg);
    else if (arg === "--step") options.step = numberValue(args, ++index, arg);
    else if (arg === "--margin") options.margin = numberValue(args, ++index, arg);
    else if (arg === "--hover-delay") options.hoverDelay = numberValue(args, ++index, arg);
    else if (arg === "--adaptive") options.adaptive = true;
    else if (arg === "--refine-step") options.refineStep = numberValue(args, ++index, arg);
    else if (arg === "--max-refine-points") {
      options.maxRefinePoints = numberValue(args, ++index, arg);
    } else if (arg === "--max-semantic-points") {
      options.maxSemanticPoints = numberValue(args, ++index, arg);
    } else if (arg === "--region-size") options.regionSize = numberValue(args, ++index, arg);
    else if (arg === "--timeout") options.timeout = numberValue(args, ++index, arg);
    else if (arg === "--headful") options.headless = false;
    else if (arg === "--headless") options.headless = true;
    else throw new Error(`unknown scan option "${arg}"`);
  }

  if (!options.url) {
    throw new Error("scan needs a URL");
  }

  return options;
}

function parseCompareArgs(args) {
  const options = {
    before: null,
    after: null,
    out: "pals-scan-diff.MD",
    json: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--") && !options.before) {
      options.before = arg;
      continue;
    }

    if (!arg.startsWith("--") && !options.after) {
      options.after = arg;
      continue;
    }

    if (arg === "--out") options.out = requireValue(args, ++index, arg);
    else if (arg === "--json") options.json = requireValue(args, ++index, arg);
    else throw new Error(`unknown compare option "${arg}"`);
  }

  if (!options.before || !options.after) {
    throw new Error("compare needs <before.json> and <after.json>");
  }

  return options;
}

function parseExportPlaywrightArgs(args) {
  const options = {
    scan: null,
    out: "pals.generated.spec.js",
    maxTargets: 20,
    maxFields: 12,
    maxHoverRegions: 8,
    maxFindings: 20,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--") && !options.scan) {
      options.scan = arg;
      continue;
    }

    if (arg === "--out") options.out = requireValue(args, ++index, arg);
    else if (arg === "--max-targets") options.maxTargets = numberValue(args, ++index, arg);
    else if (arg === "--max-fields") options.maxFields = numberValue(args, ++index, arg);
    else if (arg === "--max-hover-regions") {
      options.maxHoverRegions = numberValue(args, ++index, arg);
    } else if (arg === "--max-findings") options.maxFindings = numberValue(args, ++index, arg);
    else throw new Error(`unknown export-playwright option "${arg}"`);
  }

  if (!options.scan) {
    throw new Error("export-playwright needs <scan.json>");
  }

  return options;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (_error) {
    return null;
  }
}

function requireValue(args, index, flag) {
  if (!args[index]) throw new Error(`${flag} needs a value`);
  return args[index];
}

function numberValue(args, index, flag) {
  const value = Number(requireValue(args, index, flag));
  if (!Number.isFinite(value)) throw new Error(`${flag} needs a numeric value`);
  return value;
}

function printHelp() {
  console.log(`PALS Engine CLI

Usage:
  pals scan <url> [options]
  pals compare <before.json> <after.json> [options]
  pals export-playwright <scan.json> [options]

Scan options:
  --out <file>          Markdown report path. Default: pals-scan-report.MD
  --json <file>         Raw JSON scan path.
  --width <px>          Viewport width. Default: 1280
  --height <px>         Viewport height. Default: 720
  --step <px>           Pointer grid step. Default: 160
  --margin <px>         Viewport margin. Default: 8
  --hover-delay <ms>    Delay after each pointer move. Default: 80
  --adaptive            Refine around interesting pointer samples.
  --refine-step <px>    Adaptive refinement step. Default: 56
  --max-refine-points <n> Maximum adaptive points. Default: 120
  --max-semantic-points <n> Maximum semantic seed points. Default: 80
  --region-size <px>    Region grouping size. Default: same as --step
  --headful             Show browser.

Compare options:
  --out <file>          Markdown diff path. Default: pals-scan-diff.MD
  --json <file>         Raw JSON diff path.

Export Playwright options:
  --out <file>          Spec path. Default: pals.generated.spec.js
  --max-targets <n>     Maximum semantic controls. Default: 20
  --max-fields <n>      Maximum form fields. Default: 12
  --max-hover-regions <n> Maximum hover regions. Default: 8
  --max-findings <n>    Maximum TODO findings. Default: 20
`);
}
