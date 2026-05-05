(function installPalsExtensionContent() {
  "use strict";

  const state = {
    live: false,
    samples: [],
    liveStartedAt: null,
    lastSampleAt: 0,
    stopLens: null,
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    Promise.resolve()
      .then(() => handleMessage(message))
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  async function handleMessage(message) {
    ensurePals();

    if (message.type === "PALS_STATUS") {
      return status();
    }

    if (message.type === "PALS_QUICK_AUDIT") {
      return {
        ok: true,
        scan: quickAudit(message.options || {}),
      };
    }

    if (message.type === "PALS_START_LIVE") {
      startLiveCapture(message.options || {});
      return status();
    }

    if (message.type === "PALS_STOP_LIVE") {
      return {
        ok: true,
        scan: stopLiveCapture(),
      };
    }

    if (message.type === "PALS_CANCEL_LIVE") {
      cancelLiveCapture();
      return status();
    }

    throw new Error(`Unknown PALS message: ${message.type}`);
  }

  function quickAudit(options) {
    const points = buildGrid({
      width: window.innerWidth,
      height: window.innerHeight,
      step: options.step || 180,
      margin: options.margin || 8,
    });
    const samples = points.map((point) => samplePoint(point, "quick"));
    const semantic = window.PALS.tools.semanticMap();
    const scan = createScan({
      mode: "extension-quick-grid",
      samples,
      semantic,
      grid: {
        step: options.step || 180,
        margin: options.margin || 8,
        coarsePoints: points.length,
        semanticPoints: 0,
        refinedPoints: 0,
      },
    });
    scan.findings = generateFindings(scan);
    return scan;
  }

  function startLiveCapture(options) {
    cancelLiveCapture();
    state.live = true;
    state.samples = [];
    state.liveStartedAt = new Date().toISOString();
    state.lastSampleAt = 0;

    if (options.lens !== false && window.PALS.activateLens) {
      const lens = window.PALS.activateLens({ intervalMs: 120 });
      state.stopLens = () => lens.stop();
    }

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("mousemove", onPointerMove, true);
  }

  function stopLiveCapture() {
    const samples = state.samples.slice();
    cancelLiveCapture();

    const semantic = window.PALS.tools.semanticMap();
    const scan = createScan({
      mode: "extension-live-pointer",
      createdAt: state.liveStartedAt || new Date().toISOString(),
      samples,
      semantic,
      grid: {
        step: null,
        margin: null,
        coarsePoints: 0,
        semanticPoints: semantic.interactive.length,
        refinedPoints: samples.length,
      },
    });
    scan.findings = generateFindings(scan);
    return scan;
  }

  function cancelLiveCapture() {
    state.live = false;
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("mousemove", onPointerMove, true);
    if (state.stopLens) state.stopLens();
    state.stopLens = null;
  }

  function onPointerMove(event) {
    if (!state.live) return;

    const now = Date.now();
    if (now - state.lastSampleAt < 120) return;
    state.lastSampleAt = now;

    state.samples.push(samplePoint({ x: event.clientX, y: event.clientY }, "live"));
  }

  function samplePoint(point, phase) {
    const map = window.PALS.scanPoint(point);
    return {
      point,
      phase,
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
      hoverDelta: {
        changed: false,
        added: [],
        removed: [],
        textLengthDelta: 0,
      },
    };
  }

  function createScan({ mode, createdAt, samples, semantic, grid }) {
    const aggregate = aggregateSamples(samples);
    return {
      engine: "PALS",
      version: window.PALS.version,
      mode,
      url: location.href,
      title: document.title,
      createdAt: createdAt || new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      adaptive: false,
      grid,
      samples,
      regions: summarizeRegions(samples, grid?.step || 180),
      semantic,
      aggregate,
    };
  }

  function status() {
    return {
      ok: true,
      live: state.live,
      samples: state.samples.length,
      url: location.href,
      title: document.title,
      hasPals: !!window.PALS,
    };
  }

  function aggregateSamples(samples) {
    const selectors = new Map();
    const blocked = new Map();
    let explicitObservations = 0;
    let implicitObservations = 0;

    for (const sample of samples) {
      explicitObservations += sample.summary?.explicit || 0;
      implicitObservations += sample.summary?.implicit || 0;

      for (const item of sample.underPointer || []) {
        if (!item.selector) continue;
        const current = selectors.get(item.selector) || {
          selector: item.selector,
          kind: item.kind,
          source: item.source,
          name: item.name,
          hits: 0,
        };
        current.hits += 1;
        selectors.set(item.selector, current);
      }

      for (const item of sample.blocked || []) {
        const key = `${item.source}:${item.selector}:${item.name || ""}`;
        blocked.set(key, item);
      }
    }

    return {
      points: samples.length,
      explicitObservations,
      implicitObservations,
      hoverChanges: 0,
      uniqueUnderPointer: [...selectors.values()].sort((a, b) => b.hits - a.hits),
      blocked: [...blocked.values()],
    };
  }

  function summarizeRegions(samples, cellSize) {
    const regions = new Map();

    for (const sample of samples) {
      const cellX = Math.floor(sample.point.x / cellSize);
      const cellY = Math.floor(sample.point.y / cellSize);
      const key = `${cellX}:${cellY}`;
      const region =
        regions.get(key) ||
        {
          key,
          bounds: { x: cellX * cellSize, y: cellY * cellSize, width: cellSize, height: cellSize },
          samples: 0,
          score: 0,
          interactiveHits: 0,
          hoverChanges: 0,
          blocked: 0,
          selectors: new Map(),
          hoverAdded: [],
          hoverRemoved: [],
        };

      region.samples += 1;
      region.blocked += (sample.blocked || []).length;
      for (const item of sample.underPointer || []) {
        if (!item.selector) continue;
        region.selectors.set(item.selector, {
          selector: item.selector,
          kind: item.kind,
          source: item.source,
          name: item.name,
        });
        if (item.cursor === "pointer") region.interactiveHits += 1;
      }
      region.score = region.selectors.size * 4 + region.interactiveHits * 3;
      regions.set(key, region);
    }

    return [...regions.values()]
      .map((region) => ({
        ...region,
        selectors: [...region.selectors.values()],
        type: region.interactiveHits > 0 ? "interactive" : region.selectors.size ? "content" : "low-signal",
      }))
      .sort((a, b) => b.score - a.score);
  }

  function generateFindings(scan) {
    const findings = [];

    for (const item of scan.semantic.interactive || []) {
      if (!item.accessibleName && item.role !== "label") {
        findings.push({
          id: "PALS-A11Y-001",
          severity: "high",
          category: "accessibility",
          selector: item.selector,
          message: "Interactive element has no accessible name.",
          evidence: `${item.tag} role=${item.role}`,
        });
      }
    }

    for (const field of scan.semantic.fields || []) {
      if (!field.label && !field.accessibleName) {
        findings.push({
          id: "PALS-A11Y-002",
          severity: "high",
          category: "accessibility",
          selector: field.selector,
          message: "Form field has no label or accessible name.",
          evidence: `${field.tag} type=${field.type || "default"}`,
        });
      }
    }

    if ((scan.semantic.summary?.h1 || 0) === 0) {
      findings.push({
        id: "PALS-A11Y-003",
        severity: "medium",
        category: "accessibility",
        selector: "document",
        message: "Page has no visible h1 heading.",
        evidence: "semantic.summary.h1 = 0",
      });
    }

    return {
      summary: {
        total: findings.length,
        critical: findings.filter((item) => item.severity === "critical").length,
        high: findings.filter((item) => item.severity === "high").length,
        medium: findings.filter((item) => item.severity === "medium").length,
        low: findings.filter((item) => item.severity === "low").length,
      },
      items: findings,
    };
  }

  function buildGrid(options) {
    const width = options.width;
    const height = options.height;
    const step = Math.max(24, options.step);
    const margin = options.margin;
    const points = [];
    const maxX = Math.max(margin, width - margin - 1);
    const maxY = Math.max(margin, height - margin - 1);

    for (let y = margin; y <= maxY; y += step) {
      for (let x = margin; x <= maxX; x += step) {
        points.push({ x: Math.round(x), y: Math.round(y) });
      }
    }

    points.push({ x: Math.round(width / 2), y: Math.round(height / 2) });
    return uniquePoints(points);
  }

  function uniquePoints(points) {
    const seen = new Set();
    return points.filter((point) => {
      const key = `${point.x}:${point.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function cursorForSelector(selector) {
    try {
      const element = selector ? document.querySelector(selector) : null;
      return element ? getComputedStyle(element).cursor : null;
    } catch (_error) {
      return null;
    }
  }

  function ensurePals() {
    if (!window.PALS) {
      throw new Error("PALS engine is not available on this page.");
    }
  }
})();
