(function installPalsExtensionContent() {
  "use strict";

  if (globalThis.__PALS_EXTENSION_CONTENT_INSTALLED__) {
    return;
  }
  globalThis.__PALS_EXTENSION_CONTENT_INSTALLED__ = true;

  const state = {
    live: false,
    samples: [],
    liveStartedAt: null,
    lastSampleAt: 0,
    stopLens: null,
    agent: {
      root: null,
      shadow: null,
      scan: null,
      pending: null,
      plan: null,
      calibration: loadAgentCalibration(),
      calibrationFlow: null,
      calibrationMarker: null,
    },
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

    if (message.type === "PALS_OPEN_AGENT") {
      openAgentOverlay();
      return {
        ...status(),
        title: "PALS Agent Overlay",
      };
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

  function openAgentOverlay() {
    if (state.agent.root) {
      state.agent.root.style.display = "block";
      const input = state.agent.shadow.querySelector("[data-agent-input]");
      if (input) input.focus();
      return;
    }

    const host = document.createElement("div");
    host.id = "pals-agent-overlay-host";
    host.style.position = "fixed";
    host.style.inset = "auto 18px 18px auto";
    host.style.zIndex = "2147483647";
    host.style.width = "min(420px, calc(100vw - 28px))";
    host.style.maxHeight = "min(680px, calc(100vh - 28px))";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = agentOverlayMarkup();
    state.agent.root = host;
    state.agent.shadow = shadow;

    const input = shadow.querySelector("[data-agent-input]");
    const send = shadow.querySelector("[data-agent-send]");
    const execute = shadow.querySelector("[data-agent-execute]");
    const scan = shadow.querySelector("[data-agent-scan]");
    const dense = shadow.querySelector("[data-agent-dense]");
    const runNext = shadow.querySelector("[data-agent-run-next]");
    const clearPlan = shadow.querySelector("[data-agent-clear-plan]");
    const test = shadow.querySelector("[data-agent-test]");
    const calibrate = shadow.querySelector("[data-agent-calibrate]");
    const captureCalibration = shadow.querySelector("[data-agent-capture-calibration]");
    const resetCalibration = shadow.querySelector("[data-agent-reset-calibration]");
    const close = shadow.querySelector("[data-agent-close]");

    send.addEventListener("click", () => planAgentInstruction(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        planAgentInstruction(input.value);
      }
    });
    execute.addEventListener("click", executePendingAgentAction);
    scan.addEventListener("click", () => {
      state.agent.scan = quickAudit({ step: 150, margin: 10 });
      renderAgentScan(state.agent.scan);
      addAgentLine("agent", scanSummary(state.agent.scan));
    });
    dense.addEventListener("click", () => runAgentDenseScan(10000));
    runNext.addEventListener("click", runNextAgentPlanStep);
    clearPlan.addEventListener("click", clearAgentPlan);
    test.addEventListener("click", testAgentBridge);
    calibrate.addEventListener("click", startAgentCalibration);
    captureCalibration.addEventListener("click", scheduleAgentCalibrationCapture);
    resetCalibration.addEventListener("click", resetAgentCalibration);
    close.addEventListener("click", () => {
      hideAgentCalibrationMarker();
      host.style.display = "none";
    });

    renderAgentCalibrationStatus();
    renderAgentPlanStatus();
    addAgentLine(
      "agent",
      "Local agent ready. Start `pals mouse-bridge`, paste its token, then ask me to move, click, scan, or sweep the current page."
    );
    input.focus();
  }

  function agentOverlayMarkup() {
    return `
      <style>
        :host {
          color-scheme: dark;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        * { box-sizing: border-box; }
        .shell {
          overflow: hidden;
          color: #f7f3e8;
          background: rgba(5, 6, 7, 0.96);
          border: 1px solid rgba(247, 243, 232, 0.18);
          border-radius: 8px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.46);
          backdrop-filter: blur(18px);
        }
        header {
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(247, 243, 232, 0.14);
        }
        h2 {
          margin: 0;
          font-size: 14px;
          letter-spacing: 0;
        }
        p {
          margin: 0;
          color: #b9b6ad;
          font-size: 12px;
          line-height: 1.35;
        }
        button, input, textarea {
          font: inherit;
        }
        button {
          min-height: 34px;
          border: 1px solid rgba(247, 243, 232, 0.18);
          border-radius: 7px;
          background: rgba(247, 243, 232, 0.07);
          color: #f7f3e8;
          cursor: pointer;
        }
        button:hover:not(:disabled) {
          border-color: rgba(247, 243, 232, 0.46);
        }
        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .close {
          width: 34px;
        }
        .bridge {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 8px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(247, 243, 232, 0.12);
        }
        .calibration {
          display: grid;
          grid-template-columns: 1fr auto auto auto;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(247, 243, 232, 0.12);
        }
        .calibration p {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        input, textarea {
          width: 100%;
          border: 1px solid rgba(247, 243, 232, 0.18);
          border-radius: 7px;
          color: #f7f3e8;
          background: rgba(247, 243, 232, 0.08);
          outline: none;
        }
        input {
          min-height: 34px;
          padding: 8px 10px;
          font-size: 12px;
        }
        textarea {
          min-height: 78px;
          resize: vertical;
          padding: 10px;
          line-height: 1.4;
        }
        input:focus, textarea:focus {
          border-color: #45d49a;
        }
        .log {
          display: grid;
          gap: 8px;
          max-height: 220px;
          overflow: auto;
          padding: 12px 14px;
        }
        .line {
          display: grid;
          gap: 4px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(247, 243, 232, 0.08);
        }
        .line strong {
          color: #45d49a;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .line.user strong { color: #e2c044; }
        .composer {
          display: grid;
          gap: 8px;
          padding: 12px 14px 14px;
          border-top: 1px solid rgba(247, 243, 232, 0.12);
        }
        .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .primary {
          border-color: transparent;
          background: #e4572e;
        }
        .safe {
          border-color: transparent;
          background: #1f6f54;
        }
        .summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(247, 243, 232, 0.12);
        }
        .summary div {
          padding: 8px;
          background: rgba(247, 243, 232, 0.06);
        }
        .summary span {
          display: block;
          color: #f7f3e8;
          font-weight: 760;
        }
        .planbar {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 8px;
          align-items: center;
        }
        .planbar p {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (max-width: 520px) {
          .bridge, .calibration, .planbar, .row {
            grid-template-columns: 1fr;
          }
          .calibration p {
            white-space: normal;
          }
          .planbar p {
            white-space: normal;
          }
        }
      </style>
      <section class="shell" aria-label="PALS Agent Overlay">
        <header>
          <div>
            <h2>PALS Agent Overlay</h2>
            <p>Local pointer control for authorized pages.</p>
          </div>
          <button class="close" type="button" data-agent-close aria-label="Close">x</button>
        </header>
        <div class="bridge">
          <input data-agent-endpoint value="http://127.0.0.1:17381" aria-label="Bridge endpoint">
          <input data-agent-token placeholder="Bridge token" aria-label="Bridge token">
          <button type="button" data-agent-test>Test</button>
        </div>
        <div class="calibration">
          <p data-agent-calibration-status>Calibration not checked.</p>
          <button type="button" data-agent-calibrate>Calibrate</button>
          <button type="button" data-agent-capture-calibration>Capture</button>
          <button type="button" data-agent-reset-calibration>Reset</button>
        </div>
        <div class="log" data-agent-log></div>
        <div class="composer">
          <div class="summary" data-agent-summary>
            <div><p>samples</p><span>0</span></div>
            <div><p>targets</p><span>0</span></div>
            <div><p>findings</p><span>0</span></div>
          </div>
          <div class="planbar">
            <p data-agent-plan-status>No active plan.</p>
            <button type="button" data-agent-run-next>Run next</button>
            <button type="button" data-agent-clear-plan>Clear</button>
          </div>
          <textarea data-agent-input placeholder="Example: move the mouse to the login button"></textarea>
          <div class="row">
            <button class="safe" type="button" data-agent-send>Plan instruction</button>
            <button class="primary" type="button" data-agent-execute disabled>Execute action</button>
          </div>
          <button type="button" data-agent-scan>Run PALS scan</button>
          <button type="button" data-agent-dense>Dense scan 10k</button>
        </div>
      </section>
    `;
  }

  async function planAgentInstruction(raw) {
    addAgentLine("user", raw || "(empty)");
    const plan = parseAgentPlan(raw);

    if (plan.length > 1) {
      createAgentPlan(plan);
      return;
    }

    const instruction = plan[0] || parseAgentInstruction(raw);
    await handleAgentInstruction(instruction);
  }

  async function handleAgentInstruction(instruction, options = {}) {
    if (instruction.type === "unknown") {
      state.agent.pending = null;
      setExecuteEnabled(false);
      markAgentPlanStep(options.stepIndex, "failed", instruction.reason);
      addAgentLine("agent", instruction.reason);
      return;
    }

    if (instruction.type === "scan") {
      state.agent.scan = quickAudit({ step: 150, margin: 10 });
      renderAgentScan(state.agent.scan);
      state.agent.pending = null;
      setExecuteEnabled(false);
      markAgentPlanStep(options.stepIndex, "completed", "Quick scan completed.");
      addAgentLine("agent", scanSummary(state.agent.scan));
      return;
    }

    if (instruction.type === "dense-scan") {
      await runAgentDenseScan(instruction.targetPoints || 10000);
      markAgentPlanStep(options.stepIndex, "completed", "Dense scan completed.");
      return;
    }

    const action = buildAgentAction(instruction);
    if (!action.ok) {
      state.agent.pending = null;
      setExecuteEnabled(false);
      markAgentPlanStep(options.stepIndex, "failed", action.error);
      addAgentLine("agent", action.error);
      return;
    }

    state.agent.pending = action.command;
    if (Number.isInteger(options.stepIndex)) {
      state.agent.pending.planStepIndex = options.stepIndex;
      markAgentPlanStep(options.stepIndex, "waiting-confirmation", describeAgentCommand(action.command));
    }
    setExecuteEnabled(true);
    addAgentLine("agent", `${instruction.label}. ${describeAgentCommand(action.command)} Review and press Execute action.`);
  }

  function createAgentPlan(instructions) {
    state.agent.pending = null;
    setExecuteEnabled(false);
    state.agent.plan = {
      createdAt: new Date().toISOString(),
      steps: instructions.map((instruction, index) => ({
        index,
        instruction,
        status: "pending",
        note: instruction.label || instruction.reason || instruction.type,
      })),
    };
    renderAgentPlanStatus();
    addAgentLine("agent", `Plan created with ${instructions.length} steps. Press Run next to start.`);
  }

  async function runNextAgentPlanStep() {
    if (!state.agent.plan) {
      addAgentLine("agent", "No active plan.");
      return;
    }

    const waiting = state.agent.plan.steps.find((step) => step.status === "waiting-confirmation");
    if (waiting) {
      addAgentLine("agent", `Step ${waiting.index + 1} is waiting for Execute action.`);
      return;
    }

    const next = state.agent.plan.steps.find((step) => step.status === "pending");
    if (!next) {
      addAgentLine("agent", "Plan finished.");
      renderAgentPlanStatus();
      return;
    }

    markAgentPlanStep(next.index, "running", next.note);
    addAgentLine("agent", `Running step ${next.index + 1}/${state.agent.plan.steps.length}: ${next.note}`);
    await handleAgentInstruction(next.instruction, { stepIndex: next.index });
  }

  function clearAgentPlan() {
    state.agent.plan = null;
    state.agent.pending = null;
    setExecuteEnabled(false);
    renderAgentPlanStatus();
    addAgentLine("agent", "Plan cleared.");
  }

  function markAgentPlanStep(index, status, note) {
    if (!state.agent.plan || !Number.isInteger(index)) return;
    const step = state.agent.plan.steps[index];
    if (!step) return;
    step.status = status;
    if (note) step.note = note;
    renderAgentPlanStatus();
  }

  async function runAgentDenseScan(targetPoints) {
    try {
      state.agent.pending = null;
      setExecuteEnabled(false);
      addAgentLine("agent", `Starting high-density scan with ${targetPoints} target points.`);
      state.agent.scan = await highDensityAudit({
        targetPoints,
        chunkSize: 500,
      });
      renderAgentScan(state.agent.scan);
      addAgentLine("agent", denseScanSummary(state.agent.scan));
    } catch (error) {
      addAgentLine("agent", `Dense scan error: ${error.message}`);
    }
  }

  async function highDensityAudit(options = {}) {
    const targetPoints = clamp(Math.round(options.targetPoints || 10000), 1000, 50000);
    const chunkSize = clamp(Math.round(options.chunkSize || 500), 100, 2000);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = Math.max(0.2, width / Math.max(1, height));
    const columns = Math.max(1, Math.ceil(Math.sqrt(targetPoints * aspect)));
    const rows = Math.max(1, Math.ceil(targetPoints / columns));
    const regionSize = Math.max(24, Math.round(Math.sqrt((width * height) / 256)));
    const samples = [];
    const startedAt = performance.now();
    const elementCache = new WeakMap();
    const previousPointerEvents = state.agent.root?.style.pointerEvents || "";

    if (state.agent.root) {
      state.agent.root.style.pointerEvents = "none";
    }

    try {
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const point = {
            x: clamp(Math.round(((column + 0.5) * width) / columns), 0, Math.max(0, width - 1)),
            y: clamp(Math.round(((row + 0.5) * height) / rows), 0, Math.max(0, height - 1)),
          };
          samples.push(denseSamplePoint(point, elementCache));
          if (samples.length % chunkSize === 0) {
            await wait(0);
          }
        }
      }
    } finally {
      if (state.agent.root) {
        state.agent.root.style.pointerEvents = previousPointerEvents;
      }
    }

    const semantic = window.PALS.tools.semanticMap();
    const durationMs = Math.round(performance.now() - startedAt);
    const scan = createScan({
      mode: "extension-high-density-viewport",
      samples,
      semantic,
      grid: {
        step: regionSize,
        margin: 0,
        coarsePoints: samples.length,
        semanticPoints: semantic.interactive.length,
        refinedPoints: 0,
        rows,
        columns,
        targetPoints,
      },
    });
    scan.density = {
      targetPoints,
      actualPoints: samples.length,
      rows,
      columns,
      durationMs,
      pointsPerSecond: Math.round((samples.length / Math.max(1, durationMs)) * 1000),
      regionSize,
    };
    scan.findings = generateFindings(scan);
    return scan;
  }

  function denseSamplePoint(point, cache) {
    const element = denseElementFromPoint(point);
    const descriptor = element ? denseElementDescriptor(element, cache) : null;
    const explicit = descriptor?.kind === "explicit" ? 1 : 0;
    const implicit = descriptor && descriptor.kind !== "explicit" ? 1 : 0;

    return {
      point,
      phase: "dense",
      summary: {
        explicit,
        implicit,
        blocked: 0,
      },
      hitStack: descriptor ? [descriptor] : [],
      underPointer: descriptor ? [descriptor] : [],
      blocked: [],
      hoverDelta: {
        changed: false,
        added: [],
        removed: [],
        textLengthDelta: 0,
      },
    };
  }

  function denseElementFromPoint(point) {
    const element = document.elementFromPoint(point.x, point.y);
    if (!element) return null;
    return (
      element.closest?.("a, button, input, select, textarea, summary, [role], [tabindex]") ||
      element
    );
  }

  function denseElementDescriptor(element, cache) {
    if (cache.has(element)) return cache.get(element);

    const selector = denseCssPath(element);
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role") || denseRole(element);
    const style = getComputedStyle(element);
    const explicit = ["a", "button", "input", "select", "textarea", "summary"].includes(tag);
    const focusable = explicit || element.hasAttribute("tabindex");
    const descriptor = {
      kind: explicit || focusable || element.getAttribute("role") ? "explicit" : "implicit",
      source: "dense-element",
      name: denseElementName(element),
      selector,
      role,
      cursor: style.cursor,
      distance: 0,
    };

    if (descriptor.kind !== "explicit" && style.cursor === "pointer") {
      descriptor.kind = "implicit";
    }

    cache.set(element, descriptor);
    return descriptor;
  }

  function denseElementName(element) {
    return (
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.getAttribute("placeholder") ||
      String(element.innerText || element.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) ||
      element.tagName.toLowerCase()
    );
  }

  function denseRole(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") return "textbox";
    if (tag === "summary") return "button";
    return tag;
  }

  function denseCssPath(element) {
    if (element.id) return `#${cssEscape(element.id)}`;

    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && current !== document.documentElement) {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }

      const siblings = Array.prototype.filter.call(parent.children, (child) => {
        return child.tagName === current.tagName;
      });
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
      if (parts.length >= 5) break;
    }

    return parts.join(" > ") || element.tagName.toLowerCase();
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\#.:,[\]>+~*]/g, "\\$&");
  }

  function buildAgentAction(instruction) {
    if (instruction.type === "sweep") {
      const points = buildGrid({
        width: window.innerWidth,
        height: window.innerHeight,
        step: instruction.step || 160,
        margin: 24,
      }).map(toScreenPoint);
      return {
        ok: true,
        command: {
          type: "sweep",
          points,
          durationMs: Math.min(18000, points.length * 38),
          capture: true,
        },
      };
    }

    if (instruction.type === "move-coordinates" || instruction.type === "click-coordinates") {
      if (!pointInViewport(instruction.point)) {
        return {
          ok: false,
          error: `Viewport coordinate ${instruction.point.x}, ${instruction.point.y} is outside the visible viewport.`,
        };
      }

      const screenPoint = toScreenPoint(instruction.point);
      return {
        ok: true,
        command: {
          type: instruction.type.startsWith("click") ? "click" : "move",
          x: screenPoint.x,
          y: screenPoint.y,
          durationMs: 240,
          viewport: instruction.point,
          source: instruction.point,
        },
      };
    }

    if (instruction.type === "move-target" || instruction.type === "click-target") {
      const target = resolveAgentTarget(instruction.query);
      if (!target) {
        return {
          ok: false,
          error: `I could not find a visible target matching "${instruction.query}". Run a scan or use coordinates.`,
        };
      }

      return {
        ok: true,
        command: {
          type: instruction.type.startsWith("click") ? "click" : "move",
          x: target.screen.x,
          y: target.screen.y,
          durationMs: 260,
          viewport: target.viewport,
          selector: target.selector,
          name: target.name,
        },
      };
    }

    if (instruction.type === "type") {
      return {
        ok: true,
        command: {
          type: "type",
          text: instruction.text,
        },
      };
    }

    return { ok: false, error: "Unsupported agent action." };
  }

  async function executePendingAgentAction() {
    const command = state.agent.pending;
    if (!command) return;

    try {
      setExecuteEnabled(false);
      if (command.capture) startLiveCapture({ lens: true });

      if (command.type === "click") {
        await callBridge("/move", { x: command.x, y: command.y, durationMs: command.durationMs });
        await callBridge("/click", { button: 1 });
      } else if (command.type === "move") {
        await callBridge("/move", { x: command.x, y: command.y, durationMs: command.durationMs });
      } else if (command.type === "sweep") {
        await callBridge("/sweep", command);
      } else if (command.type === "type") {
        await callBridge("/type", { text: command.text });
      }

      if (command.capture) {
        await wait(180);
        state.agent.scan = stopLiveCapture();
        renderAgentScan(state.agent.scan);
        addAgentLine("agent", `Sweep completed. ${scanSummary(state.agent.scan)}`);
      } else {
        addAgentLine("agent", "Action executed through the local mouse bridge.");
      }
      markAgentPlanStep(command.planStepIndex, "completed", "Action executed.");
      state.agent.pending = null;
    } catch (error) {
      if (command.capture) cancelLiveCapture();
      setExecuteEnabled(true);
      markAgentPlanStep(command.planStepIndex, "failed", error.message);
      addAgentLine("agent", `Bridge error: ${error.message}`);
    }
  }

  async function testAgentBridge() {
    try {
      const response = await fetch(`${bridgeEndpoint()}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      addAgentLine("agent", `Bridge online (${body.dryRun ? "dry-run" : "real pointer"}).`);
    } catch (error) {
      addAgentLine("agent", `Bridge offline: ${error.message}. Start: pals mouse-bridge`);
    }
  }

  function startAgentCalibration() {
    const points = agentCalibrationViewportPoints();
    state.agent.calibrationFlow = {
      step: 0,
      points,
      samples: [],
      captureTimer: null,
    };
    showAgentCalibrationMarker(points[0], "1");
    renderAgentCalibrationStatus();
    addAgentLine(
      "agent",
      "Calibration started. Press Capture, then move the real pointer over marker 1 during the countdown."
    );
  }

  function scheduleAgentCalibrationCapture() {
    if (!state.agent.calibrationFlow) {
      startAgentCalibration();
      return;
    }

    const flow = state.agent.calibrationFlow;
    if (flow.captureTimer) {
      clearTimeout(flow.captureTimer);
      flow.captureTimer = null;
    }

    addAgentLine(
      "agent",
      `Capturing point ${flow.step + 1} in 2 seconds. Move the real pointer over the visible marker now.`
    );
    flow.captureTimer = setTimeout(() => {
      flow.captureTimer = null;
      captureAgentCalibrationPoint();
    }, 2000);
  }

  async function captureAgentCalibrationPoint() {
    if (!state.agent.calibrationFlow) {
      startAgentCalibration();
      return;
    }

    try {
      const flow = state.agent.calibrationFlow;
      const viewport = flow.points[flow.step];
      const response = await callBridge("/position", {});
      const screen = response.result;
      flow.samples.push({
        viewport,
        screen: { x: screen.x, y: screen.y },
      });

      if (flow.step === 0) {
        flow.step = 1;
        showAgentCalibrationMarker(flow.points[1], "2");
        renderAgentCalibrationStatus();
        addAgentLine(
          "agent",
          "First point captured. Press Capture, then move the pointer over marker 2 during the countdown."
        );
        return;
      }

      state.agent.calibration = computeAgentCalibration(flow.samples);
      saveAgentCalibration(state.agent.calibration);
      state.agent.calibrationFlow = null;
      hideAgentCalibrationMarker();
      renderAgentCalibrationStatus();
      addAgentLine("agent", "Calibration saved. Future target moves will use calibrated screen coordinates.");
    } catch (error) {
      addAgentLine("agent", `Calibration error: ${error.message}`);
    }
  }

  function resetAgentCalibration() {
    if (state.agent.calibrationFlow?.captureTimer) {
      clearTimeout(state.agent.calibrationFlow.captureTimer);
    }
    state.agent.calibration = null;
    state.agent.calibrationFlow = null;
    saveAgentCalibration(null);
    hideAgentCalibrationMarker();
    renderAgentCalibrationStatus();
    addAgentLine("agent", "Calibration reset. PALS will use browser geometry fallback.");
  }

  function agentCalibrationViewportPoints() {
    const first = {
      x: clamp(Math.round(window.innerWidth * 0.22), 48, Math.max(48, window.innerWidth - 120)),
      y: clamp(Math.round(window.innerHeight * 0.22), 48, Math.max(48, window.innerHeight - 120)),
    };
    const second = {
      x: clamp(Math.round(window.innerWidth * 0.78), first.x + 80, Math.max(first.x + 80, window.innerWidth - 48)),
      y: clamp(Math.round(window.innerHeight * 0.78), first.y + 80, Math.max(first.y + 80, window.innerHeight - 48)),
    };
    return [first, second];
  }

  function computeAgentCalibration(samples) {
    if (!Array.isArray(samples) || samples.length < 2) {
      throw new Error("Calibration needs two captured points.");
    }

    const [first, second] = samples;
    const viewportDx = second.viewport.x - first.viewport.x;
    const viewportDy = second.viewport.y - first.viewport.y;
    if (Math.abs(viewportDx) < 40 || Math.abs(viewportDy) < 40) {
      throw new Error("Calibration points are too close.");
    }

    const scaleX = (second.screen.x - first.screen.x) / viewportDx;
    const scaleY = (second.screen.y - first.screen.y) / viewportDy;
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
      throw new Error("Calibration produced invalid scale.");
    }
    if (scaleX < 0.3 || scaleX > 4 || scaleY < 0.3 || scaleY > 4) {
      throw new Error("Calibration scale is outside the accepted range.");
    }

    return {
      offsetX: first.screen.x - first.viewport.x * scaleX,
      offsetY: first.screen.y - first.viewport.y * scaleY,
      scaleX,
      scaleY,
      samples,
      createdAt: new Date().toISOString(),
      origin: location.origin,
    };
  }

  function showAgentCalibrationMarker(point, label) {
    if (!state.agent.calibrationMarker) {
      const marker = document.createElement("div");
      marker.style.position = "fixed";
      marker.style.zIndex = "2147483646";
      marker.style.width = "34px";
      marker.style.height = "34px";
      marker.style.margin = "-17px 0 0 -17px";
      marker.style.display = "grid";
      marker.style.placeItems = "center";
      marker.style.border = "2px solid #45d49a";
      marker.style.borderRadius = "50%";
      marker.style.background = "rgba(5, 6, 7, 0.72)";
      marker.style.color = "#f7f3e8";
      marker.style.font = "700 13px system-ui, sans-serif";
      marker.style.pointerEvents = "none";
      marker.style.boxShadow = "0 0 0 9999px rgba(5, 6, 7, 0.10), 0 0 32px rgba(69, 212, 154, 0.42)";
      document.documentElement.appendChild(marker);
      state.agent.calibrationMarker = marker;
    }

    state.agent.calibrationMarker.textContent = label;
    state.agent.calibrationMarker.style.left = `${point.x}px`;
    state.agent.calibrationMarker.style.top = `${point.y}px`;
    state.agent.calibrationMarker.style.display = "grid";
  }

  function hideAgentCalibrationMarker() {
    if (state.agent.calibrationMarker) {
      state.agent.calibrationMarker.style.display = "none";
    }
  }

  function renderAgentCalibrationStatus() {
    const status = state.agent.shadow?.querySelector("[data-agent-calibration-status]");
    if (!status) return;

    if (state.agent.calibrationFlow) {
      status.textContent = `Calibration point ${state.agent.calibrationFlow.step + 1}/2 active.`;
      return;
    }

    if (!state.agent.calibration) {
      status.textContent = "Not calibrated. Using browser geometry fallback.";
      return;
    }

    status.textContent = `Calibrated sx=${state.agent.calibration.scaleX.toFixed(2)} sy=${state.agent.calibration.scaleY.toFixed(2)}.`;
  }

  function renderAgentPlanStatus() {
    const status = state.agent.shadow?.querySelector("[data-agent-plan-status]");
    if (!status) return;

    if (!state.agent.plan) {
      status.textContent = "No active plan.";
      return;
    }

    const steps = state.agent.plan.steps;
    const completed = steps.filter((step) => step.status === "completed").length;
    const failed = steps.filter((step) => step.status === "failed").length;
    const waiting = steps.find((step) => step.status === "waiting-confirmation");
    const running = steps.find((step) => step.status === "running");

    if (waiting) {
      status.textContent = `Plan ${completed}/${steps.length}. Step ${waiting.index + 1} awaiting confirmation.`;
      return;
    }

    if (running) {
      status.textContent = `Plan ${completed}/${steps.length}. Step ${running.index + 1} running.`;
      return;
    }

    status.textContent = `Plan ${completed}/${steps.length}${failed ? `, ${failed} failed` : ""}.`;
  }

  async function callBridge(path, body) {
    const token = bridgeToken();
    if (!token) throw new Error("Paste the mouse bridge token first.");

    const response = await fetch(`${bridgeEndpoint()}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pals-token": token,
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  function resolveAgentTarget(query) {
    if (!state.agent.scan) {
      state.agent.scan = quickAudit({ step: 150, margin: 10 });
      renderAgentScan(state.agent.scan);
    }

    const normalizedQuery = normalizeInstruction(query);
    const candidates = [
      ...(state.agent.scan.semantic?.interactive || []),
      ...(state.agent.scan.semantic?.fields || []),
    ];

    let best = null;
    for (const item of candidates) {
      const haystack = normalizeInstruction(
        [item.accessibleName, item.label, item.name, item.role, item.tag, item.selector].join(" ")
      );
      const score = normalizedQuery
        .split(/\s+/)
        .filter((token) => token && haystack.includes(token)).length;
      if (score <= 0 || !item.bounds) continue;
      if (!best || score > best.score) best = { item, score };
    }

    if (!best) return null;
    const element = queryAgentElement(best.item.selector);
    if (element?.scrollIntoView) {
      element.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
    }

    const bounds = element ? element.getBoundingClientRect() : best.item.bounds;
    const viewport = {
      x: Math.round(bounds.x + bounds.width / 2),
      y: Math.round(bounds.y + bounds.height / 2),
    };
    if (!pointInViewport(viewport)) {
      return null;
    }

    return {
      selector: best.item.selector,
      name: best.item.accessibleName || best.item.label || best.item.selector,
      viewport,
      screen: toScreenPoint(viewport),
    };
  }

  function queryAgentElement(selector) {
    try {
      return selector ? document.querySelector(selector) : null;
    } catch (_error) {
      return null;
    }
  }

  function pointInViewport(point) {
    return (
      point &&
      point.x >= 0 &&
      point.y >= 0 &&
      point.x <= window.innerWidth &&
      point.y <= window.innerHeight
    );
  }

  function toScreenPoint(point) {
    if (state.agent.calibration) {
      return {
        x: Math.round(state.agent.calibration.offsetX + point.x * state.agent.calibration.scaleX),
        y: Math.round(state.agent.calibration.offsetY + point.y * state.agent.calibration.scaleY),
      };
    }

    const chromeX = Math.max(0, Math.round((window.outerWidth - window.innerWidth) / 2));
    const chromeY = Math.max(0, Math.round(window.outerHeight - window.innerHeight - chromeX));
    return {
      x: Math.round(window.screenX + chromeX + point.x),
      y: Math.round(window.screenY + chromeY + point.y),
    };
  }

  function describeAgentCommand(command) {
    if (!command) return "";
    if (command.type === "type") return `Planned typing: ${command.text.length} characters.`;
    if (command.type === "sweep") return `Planned sweep: ${command.points.length} screen points.`;
    const viewport = command.viewport ? ` viewport ${command.viewport.x},${command.viewport.y};` : "";
    const target = command.name ? ` target "${command.name}";` : "";
    return `Planned ${command.type}:${target}${viewport} screen ${command.x},${command.y}.`;
  }

  function renderAgentScan(scan) {
    const summary = state.agent.shadow.querySelector("[data-agent-summary]");
    if (!summary) return;
    const cells = summary.querySelectorAll("span");
    cells[0].textContent = String(scan.aggregate?.points || 0);
    cells[1].textContent = String(scan.semantic?.summary?.interactive || 0);
    cells[2].textContent = String(scan.findings?.summary?.total || 0);
  }

  function scanSummary(scan) {
    return `Scan found ${scan.aggregate.points} samples, ${scan.semantic.summary.interactive} interactive targets, ${scan.semantic.summary.fields} fields, and ${scan.findings.summary.total} findings.`;
  }

  function denseScanSummary(scan) {
    const density = scan.density || {};
    return `Dense scan captured ${density.actualPoints || scan.aggregate.points} points in ${density.durationMs || 0}ms (${density.pointsPerSecond || 0} points/s), with ${scan.aggregate.uniqueUnderPointer.length} unique targets and ${scan.findings.summary.total} findings.`;
  }

  function addAgentLine(kind, text) {
    const log = state.agent.shadow.querySelector("[data-agent-log]");
    if (!log) return;
    const line = document.createElement("div");
    line.className = `line ${kind}`;
    const label = document.createElement("strong");
    label.textContent = kind === "user" ? "You" : "PALS";
    const body = document.createElement("p");
    body.textContent = String(text || "");
    line.append(label, body);
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function setExecuteEnabled(enabled) {
    const button = state.agent.shadow?.querySelector("[data-agent-execute]");
    if (button) button.disabled = !enabled;
  }

  function bridgeEndpoint() {
    return state.agent.shadow
      .querySelector("[data-agent-endpoint]")
      .value.replace(/\/+$/, "");
  }

  function bridgeToken() {
    return state.agent.shadow.querySelector("[data-agent-token]").value.trim();
  }

  function loadAgentCalibration() {
    try {
      const raw = localStorage.getItem("pals.agent.calibration");
      if (!raw) return null;
      const calibration = JSON.parse(raw);
      if (!calibration || calibration.origin !== location.origin) return null;
      if (!Number.isFinite(calibration.offsetX) || !Number.isFinite(calibration.offsetY)) return null;
      if (!Number.isFinite(calibration.scaleX) || !Number.isFinite(calibration.scaleY)) return null;
      return calibration;
    } catch (_error) {
      return null;
    }
  }

  function saveAgentCalibration(calibration) {
    try {
      if (!calibration) {
        localStorage.removeItem("pals.agent.calibration");
        return;
      }
      localStorage.setItem("pals.agent.calibration", JSON.stringify(calibration));
    } catch (_error) {
      // Calibration persistence is optional.
    }
  }

  function parseAgentInstruction(input) {
    const raw = String(input || "").trim();
    const normalized = normalizeInstruction(raw);
    if (!normalized) return { type: "unknown", reason: "Empty instruction." };

    const coordinate = parseCoordinates(normalized);
    const typed = parseTypeText(raw);
    const targetPoints = parsePointCount(normalized);

    if (/\b(denso|dense|alta precisao|high density|10k|ultrarapido|ultra rapido|malha densa)\b/.test(normalized) || targetPoints >= 10000) {
      return {
        type: "dense-scan",
        targetPoints: targetPoints || 10000,
        label: `Run high-density scan with ${targetPoints || 10000} points`,
      };
    }

    if (/\b(varra|varrer|sweep|scan mouse|escaneie com mouse)\b/.test(normalized)) {
      return { type: "sweep", step: 150, label: "Sweep current viewport with the real pointer" };
    }
    if (/\b(scan|escaneie|auditoria|audite|analisar|analise)\b/.test(normalized)) {
      return { type: "scan", label: "Run local PALS scan" };
    }
    if (typed) return { type: "type", text: typed, label: `Type ${typed.length} characters` };
    if (/\b(clique|click|pressione|apertar|aperte)\b/.test(normalized)) {
      if (coordinate) return { type: "click-coordinates", point: coordinate, label: `Click ${coordinate.x}, ${coordinate.y}` };
      const query = extractTargetQuery(normalized);
      return query ? { type: "click-target", query, label: `Click target "${query}"` } : { type: "unknown", reason: "Click needs coordinates or a target name." };
    }
    if (/\b(mova|mover|move|va|ir|ponteiro|cursor|mouse)\b/.test(normalized)) {
      if (coordinate) return { type: "move-coordinates", point: coordinate, label: `Move pointer to ${coordinate.x}, ${coordinate.y}` };
      const query = extractTargetQuery(normalized);
      return query ? { type: "move-target", query, label: `Move pointer to target "${query}"` } : { type: "unknown", reason: "Move needs coordinates or a target name." };
    }
    return { type: "unknown", reason: "Instruction not recognized by the local PALS agent." };
  }

  function parseAgentPlan(input) {
    const raw = String(input || "").trim();
    if (!raw) return [];
    const parts = raw
      .split(/\n+|;|\s+(?:e\s+)?depois\s+|\s+then\s+|\s+em\s+seguida\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length <= 1) return [parseAgentInstruction(raw)];
    return parts.map((part) => parseAgentInstruction(part));
  }

  function normalizeInstruction(input) {
    return String(input || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s=,.'"#:-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractTargetQuery(normalizedInput) {
    const stop = new Set(["a", "ao", "botao", "button", "campo", "clique", "click", "cursor", "de", "do", "em", "ir", "mova", "mover", "mouse", "no", "o", "para", "ponteiro", "the", "to", "va"]);
    const quoted = normalizedInput.match(/["']([^"']{2,80})["']/);
    const source = quoted ? quoted[1] : normalizedInput;
    return [...new Set(source.split(/\s+/).filter((token) => token.length > 1 && !stop.has(token)))]
      .slice(0, 6)
      .join(" ");
  }

  function parseCoordinates(normalizedInput) {
    const xy = normalizedInput.match(/\bx\s*=?\s*(\d{1,5})\D{0,12}\by\s*=?\s*(\d{1,5})\b/);
    if (xy) return { x: Number(xy[1]), y: Number(xy[2]) };
    const pair = normalizedInput.match(/\b(\d{1,5})\s*[,;]\s*(\d{1,5})\b/);
    if (pair) return { x: Number(pair[1]), y: Number(pair[2]) };
    const loose = normalizedInput.match(/\b(\d{1,5})\s+(\d{1,5})\b/);
    if (loose) return { x: Number(loose[1]), y: Number(loose[2]) };
    return null;
  }

  function parseTypeText(raw) {
    const normalized = normalizeInstruction(raw);
    if (!/\b(digite|type|escreva|preencha)\b/.test(normalized)) return null;
    const quoted = String(raw || "").match(/["']([^"']{1,240})["']/);
    return quoted ? quoted[1] : null;
  }

  function parsePointCount(normalizedInput) {
    if (/\b10\s*mil\b/.test(normalizedInput)) return 10000;
    if (/\bdez\s+mil\b/.test(normalizedInput)) return 10000;
    const match = normalizedInput.match(/\b(\d{4,6})\s*(pontos|points|pts)?\b/);
    return match ? Number(match[1]) : 0;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
