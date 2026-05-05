import assert from "node:assert/strict";
import {
  pointInsideRect,
  relationToRect,
  sortRelations,
} from "../src/browser/geometry.js";
import { buildViewportGrid } from "../src/shared/grid.js";
import {
  buildRefinementPoints,
  buildSemanticSeedPoints,
  comparePageSignatures,
  summarizeRegions,
} from "../src/shared/adaptive.js";
import { parseAgentInstruction } from "../src/shared/agent-command.js";
import { startMouseBridge } from "../src/node/mouse-bridge.js";
import {
  aggregatePointerSamples,
  generateMarkdownReport,
} from "../src/report/markdown.js";
import { compareScans, generateCompareMarkdown } from "../src/report/compare.js";
import { generateFindings } from "../src/report/findings.js";
import {
  generatePlaywrightSpec,
  selectExportTargets,
} from "../src/report/playwright-export.js";

const tests = [];

test("pointInsideRect includes edges", () => {
  const rect = { left: 10, top: 20, right: 30, bottom: 40 };

  assert.equal(pointInsideRect({ x: 10, y: 20 }, rect), true);
  assert.equal(pointInsideRect({ x: 30, y: 40 }, rect), true);
  assert.equal(pointInsideRect({ x: 31, y: 40 }, rect), false);
});

test("relationToRect returns local, normalized and distance data", () => {
  const relation = relationToRect(
    { x: 15, y: 30 },
    {
      kind: "explicit",
      source: "element",
      name: "button",
      selector: "button",
      framePath: [],
      rectIndex: 0,
      measurement: "exact",
      rect: {
        left: 10,
        top: 20,
        right: 30,
        bottom: 40,
        width: 20,
        height: 20,
      },
    }
  );

  assert.equal(relation.inside, true);
  assert.equal(relation.distance, 0);
  assert.deepEqual(relation.localPoint, { x: 5, y: 10 });
  assert.deepEqual(relation.normalizedPoint, { x: 0.25, y: 0.5 });
});

test("sortRelations prioritizes inside bodies, then distance", () => {
  const relations = [
    { inside: false, distance: 0 },
    { inside: true, distance: 20 },
    { inside: true, distance: 5 },
  ];

  sortRelations(relations);

  assert.deepEqual(
    relations.map((relation) => relation.distance),
    [5, 20, 0]
  );
});

test("buildViewportGrid creates deterministic points and includes center", () => {
  const points = buildViewportGrid({ width: 100, height: 80, step: 40, margin: 10 });

  assert.ok(points.some((point) => point.x === 50 && point.y === 40));
  assert.ok(points.every((point) => point.x >= 10 && point.y >= 10));
});

test("buildViewportGrid enforces a minimum step", () => {
  const points = buildViewportGrid({ width: 30, height: 30, step: 1, margin: 0 });

  assert.ok(points.length < 30);
});

test("aggregatePointerSamples counts repeated selectors", () => {
  const aggregate = aggregatePointerSamples([
    {
      point: { x: 1, y: 1 },
      summary: { explicit: 2, implicit: 1, blocked: 0 },
      underPointer: [{ selector: "button", kind: "explicit", source: "element" }],
      blocked: [],
    },
    {
      point: { x: 2, y: 1 },
      summary: { explicit: 3, implicit: 0, blocked: 1 },
      underPointer: [{ selector: "button", kind: "explicit", source: "element" }],
      blocked: [{ source: "pseudo-element", name: "::before", selector: ".card" }],
    },
  ]);

  assert.equal(aggregate.points, 2);
  assert.equal(aggregate.explicitObservations, 5);
  assert.equal(aggregate.uniqueUnderPointer[0].selector, "button");
  assert.equal(aggregate.uniqueUnderPointer[0].hits, 2);
  assert.equal(aggregate.blocked.length, 1);
});

test("generateMarkdownReport documents pointer scanning foundation", () => {
  const markdown = generateMarkdownReport({
    url: "http://example.test",
    createdAt: "2026-05-04T00:00:00.000Z",
    mode: "active-pointer-grid",
    viewport: { width: 100, height: 100 },
    samples: [],
  });

  assert.match(markdown, /PALS Scan Report/);
  assert.match(markdown, /active pointer scanning/);
});

test("buildRefinementPoints refines interesting samples only", () => {
  const points = buildRefinementPoints(
    [
      {
        point: { x: 100, y: 100 },
        underPointer: [{ selector: "button", cursor: "pointer" }],
        hitStack: [],
        blocked: [],
      },
      {
        point: { x: 300, y: 300 },
        underPointer: [{ selector: "html" }],
        hitStack: [],
        blocked: [],
      },
    ],
    {
      width: 500,
      height: 500,
      margin: 8,
      coarseStep: 160,
      refineStep: 40,
      maxPoints: 6,
      excludeKeys: new Set(["100:100"]),
    }
  );

  assert.equal(points.length, 6);
  assert.ok(points.every((point) => point.reason === "non-structural-body"));
});

test("comparePageSignatures detects added selectors", () => {
  const delta = comparePageSignatures(
    { selectors: ["html", "button"], textLength: 10 },
    { selectors: ["html", "button", ".tooltip"], textLength: 15 }
  );

  assert.equal(delta.changed, true);
  assert.deepEqual(delta.added, [".tooltip"]);
  assert.equal(delta.textLengthDelta, 5);
});

test("buildSemanticSeedPoints targets visible semantic controls", () => {
  const points = buildSemanticSeedPoints(
    {
      interactive: [
        {
          selector: "button",
          role: "button",
          bounds: { x: 10, y: 20, width: 40, height: 20 },
        },
      ],
      fields: [],
    },
    { width: 200, height: 200, margin: 0 }
  );

  assert.deepEqual(points[0], {
    x: 30,
    y: 30,
    reason: "semantic-interactive",
    selector: "button",
    role: "button",
  });
});

test("summarizeRegions classifies hover dynamic regions", () => {
  const regions = summarizeRegions(
    [
      {
        point: { x: 10, y: 10 },
        underPointer: [{ selector: "button", kind: "explicit", source: "element" }],
        hitStack: [{ selector: "button", cursor: "pointer" }],
        blocked: [],
        hoverDelta: { changed: true, added: [".menu"], removed: [] },
      },
    ],
    { cellSize: 100 }
  );

  assert.equal(regions[0].type, "dynamic-hover");
  assert.equal(regions[0].hoverChanges, 1);
});

test("compareScans reports added selectors", () => {
  const diff = compareScans(
    {
      url: "before",
      aggregate: {
        uniqueUnderPointer: [{ selector: "button.old", kind: "explicit" }],
      },
      samples: [{}, {}],
      regions: [{ type: "interactive", selectors: [] }],
    },
    {
      url: "after",
      aggregate: {
        uniqueUnderPointer: [
          { selector: "button.old", kind: "explicit" },
          { selector: "button.new", kind: "explicit" },
        ],
      },
      samples: [{}, {}, {}],
      regions: [{ type: "dynamic-hover", selectors: [] }],
    }
  );

  assert.equal(diff.summary.addedSelectors, 1);
  assert.equal(diff.addedSelectors[0].selector, "button.new");
  assert.match(generateCompareMarkdown(diff), /PALS Scan Diff/);
});

test("generateFindings flags unnamed interactive elements and hover UI", () => {
  const findings = generateFindings({
    semantic: {
      summary: { h1: 0 },
      interactive: [
        {
          selector: "button.icon",
          tag: "button",
          role: "button",
          accessibleName: "",
        },
      ],
      fields: [
        {
          selector: "input.email",
          tag: "input",
          type: "email",
          label: "",
          accessibleName: "",
        },
      ],
    },
    samples: [
      {
        hoverDelta: {
          added: [".menu"],
          removed: [],
        },
      },
    ],
    regions: [
      {
        key: "1:1",
        type: "dynamic-hover",
        interactiveHits: 1,
        hoverChanges: 2,
        selectors: [{ selector: ".menu" }],
      },
    ],
    aggregate: { blocked: [] },
  });

  assert.ok(findings.summary.high >= 2);
  assert.ok(findings.items.some((item) => item.id === "PALS-A11Y-001"));
  assert.ok(findings.items.some((item) => item.id === "PALS-UX-001"));
});

test("generatePlaywrightSpec exports semantic locators and review TODOs", () => {
  const scan = {
    url: "https://app.example.test/login",
    semantic: {
      interactive: [
        {
          selector: "button[type='submit']",
          tag: "button",
          role: "button",
          accessibleName: "Sign in",
          focusable: true,
          cursor: "pointer",
          bounds: { x: 40, y: 90, width: 120, height: 32 },
        },
      ],
      fields: [
        {
          selector: "#email",
          tag: "input",
          role: "textbox",
          label: "Email",
          focusable: true,
          bounds: { x: 40, y: 40, width: 220, height: 32 },
        },
      ],
    },
    regions: [
      {
        type: "dynamic-hover",
        bounds: { x: 20, y: 20, width: 80, height: 60 },
        hoverAdded: [".menu"],
        hoverRemoved: [],
      },
    ],
    findings: {
      items: [
        {
          id: "PALS-A11Y-001",
          severity: "high",
          category: "accessibility",
          selector: "button[type='submit']",
          message: "Interactive element has no accessible name.",
        },
      ],
    },
  };

  const spec = generatePlaywrightSpec(scan);

  assert.match(spec, /@playwright\/test/);
  assert.ok(spec.includes(`await page.goto("https://app.example.test/login");`));
  assert.ok(
    spec.includes(
      `page.getByRole("button", { name: new RegExp("Sign in", "i") }).first()`
    )
  );
  assert.ok(spec.includes(`page.getByLabel(new RegExp("Email", "i")).first()`));
  assert.ok(spec.includes("// PALS hover-added: .menu"));
  assert.ok(spec.includes("// TODO [high] PALS-A11Y-001 accessibility:"));

  const targets = selectExportTargets(scan, { maxTargets: 1 });
  assert.equal(targets.interactive.length, 1);
  assert.equal(targets.fields.length, 1);
});

test("parseAgentInstruction recognizes mouse commands", () => {
  assert.deepEqual(parseAgentInstruction("mova o mouse para x=120 y=240").point, {
    x: 120,
    y: 240,
  });
  assert.equal(parseAgentInstruction("clique no botao login").type, "click-target");
  assert.equal(parseAgentInstruction("varra a tela com o ponteiro").type, "sweep");
  assert.equal(parseAgentInstruction("digite \"hello\"").text, "hello");
  assert.equal(parseAgentInstruction("escaneie 10 mil pontos ultrarapido").type, "dense-scan");
  assert.equal(parseAgentInstruction("escaneie 10 mil pontos ultrarapido").targetPoints, 10000);
});

test("mouse bridge dry-run executes authorized local commands", async () => {
  const bridge = await startMouseBridge({
    port: 0,
    token: "test-token",
    dryRun: true,
  });
  const { port } = bridge.server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/move`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pals-token": "test-token",
      },
      body: JSON.stringify({ x: 10, y: 20 }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.result.dryRun, true);
    assert.deepEqual(body.result.point, { x: 10, y: 20 });

    const positionResponse = await fetch(`http://127.0.0.1:${port}/position`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pals-token": "test-token",
      },
      body: "{}",
    });
    const position = await positionResponse.json();
    assert.equal(positionResponse.status, 200);
    assert.equal(position.ok, true);
    assert.deepEqual(position.result, { x: 0, y: 0, dryRun: true });
  } finally {
    await bridge.close();
  }
});

let failures = 0;

for (const item of tests) {
  try {
    await item.fn();
    console.log(`ok - ${item.name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${item.name}`);
    console.error(error.stack || error.message);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} tests passed`);
}

function test(name, fn) {
  tests.push({ name, fn });
}
