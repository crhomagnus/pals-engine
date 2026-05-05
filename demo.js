const targetPage = document.getElementById("target-page");
const overlay = document.getElementById("scan-overlay");
const cursor = document.getElementById("scan-cursor");
const startButton = document.getElementById("start-scan");
const resetButton = document.getElementById("reset-scan");
const statusText = document.getElementById("scan-status");
const pointMetric = document.getElementById("metric-points");
const elementMetric = document.getElementById("metric-elements");
const hoverMetric = document.getElementById("metric-hover");
const findingMetric = document.getElementById("metric-findings");
const elementList = document.getElementById("element-list");
const findingList = document.getElementById("finding-list");
const summaryOutput = document.getElementById("summary-output");

const state = {
  running: false,
  generation: 0,
  points: [],
  samples: [],
  selectors: new Map(),
  hoverRegions: new Map(),
  findings: [],
};

startButton.addEventListener("click", () => runLiveScan());
resetButton.addEventListener("click", () => resetScan());

resetScan();

if (new URLSearchParams(window.location.search).get("autorun") === "1") {
  window.setTimeout(() => runLiveScan(), 250);
}

async function runLiveScan() {
  if (state.running) return;
  resetScan();
  state.running = true;
  state.generation += 1;
  const generation = state.generation;
  startButton.disabled = true;
  statusText.textContent = "Scanning";
  cursor.style.opacity = "1";

  const points = buildScanPlan();
  state.points = points;

  for (let index = 0; index < points.length; index += 1) {
    if (!state.running || generation !== state.generation) break;
    statusText.textContent = `Scanning ${index + 1}/${points.length}`;
    await samplePoint(points[index], index);
    renderLiveState();
    await wait(72);
  }

  if (generation === state.generation) {
    state.findings = buildFindings();
    renderLiveState();
    statusText.textContent = "Completed";
  }

  state.running = false;
  startButton.disabled = false;
  cursor.style.opacity = "0";
}

function resetScan() {
  state.running = false;
  state.generation += 1;
  state.points = [];
  state.samples = [];
  state.selectors = new Map();
  state.hoverRegions = new Map();
  state.findings = [];
  startButton.disabled = false;
  statusText.textContent = "Idle";
  cursor.style.opacity = "0";
  clearHoverState();
  overlay.querySelectorAll(".scan-point, .scan-region").forEach((node) => node.remove());
  renderLiveState();
}

async function samplePoint(point, index) {
  moveCursor(point);
  const before = signature();
  applyDemoHover(point);
  dispatchSyntheticPointer(point);
  await wait(35);

  const map = window.PALS.scanPoint(point);
  const after = signature();
  const hoverDelta = diffSignature(before, after);
  const underPointer = window.PALS.tools.bodiesUnderPointer(map);

  const sample = {
    point,
    summary: map.summary,
    underPointer,
    hoverDelta,
  };
  state.samples.push(sample);

  for (const item of underPointer) {
    if (isUsefulTargetSelector(item.selector)) {
      const current = state.selectors.get(item.selector) || {
        selector: item.selector,
        name: item.name || item.source || "element",
        hits: 0,
      };
      current.hits += 1;
      state.selectors.set(item.selector, current);
    }
  }

  if (hoverDelta.changed) {
    registerHoverRegion(point, hoverDelta);
  }

  drawPoint(point, hoverDelta.changed || underPointer.some((item) => item.cursor === "pointer"), index);
}

function buildScanPlan() {
  const rect = targetPage.getBoundingClientRect();
  const step = rect.width < 620 ? 82 : 96;
  const margin = 28;
  const points = [];

  for (let y = rect.top + margin; y <= rect.bottom - margin; y += step) {
    for (let x = rect.left + margin; x <= rect.right - margin; x += step) {
      points.push({ x: Math.round(x), y: Math.round(y) });
    }
  }

  const semantic = window.PALS.tools.semanticMap();
  for (const item of [...semantic.interactive, ...semantic.fields]) {
    const center = centerFromBounds(item.bounds);
    if (center && pointInsideRect(center, rect)) {
      points.push({
        x: Math.round(center.x),
        y: Math.round(center.y),
        reason: "semantic",
      });
    }
  }

  for (const element of targetPage.querySelectorAll(
    "[data-hover-menu], [data-hover-tooltip], [data-hover-danger], input, button"
  )) {
    const center = centerFromRect(element.getBoundingClientRect());
    if (center && pointInsideRect(center, rect)) {
      points.push({
        x: Math.round(center.x),
        y: Math.round(center.y),
        reason: "targeted",
      });
    }
  }

  return uniquePoints(points);
}

function applyDemoHover(point) {
  clearHoverState();
  const element = document.elementFromPoint(point.x, point.y);
  if (!element || !targetPage.contains(element)) return;

  const navTrigger = element.closest("[data-hover-menu]");
  if (navTrigger) {
    navTrigger.classList.add("is-hovered");
    navTrigger.closest(".target-nav").classList.add("has-menu");
  }

  const tooltip = element.closest("[data-hover-tooltip]");
  if (tooltip) {
    tooltip.classList.add("is-hovered");
  }

  const danger = element.closest("[data-hover-danger]");
  if (danger) {
    danger.classList.add("is-hovered");
    danger.closest(".action-row").classList.add("has-danger");
  }
}

function clearHoverState() {
  targetPage
    .querySelectorAll(".is-hovered")
    .forEach((element) => element.classList.remove("is-hovered"));
  targetPage
    .querySelectorAll(".has-menu, .has-danger")
    .forEach((element) => element.classList.remove("has-menu", "has-danger"));
}

function dispatchSyntheticPointer(point) {
  const element = document.elementFromPoint(point.x, point.y);
  if (!element) return;

  const options = {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    view: window,
  };
  element.dispatchEvent(new MouseEvent("mousemove", options));
  element.dispatchEvent(new MouseEvent("mouseover", options));
}

function signature() {
  return window.PALS.tools.pageSignature();
}

function diffSignature(before, after) {
  const beforeSet = new Set(before.selectors || []);
  const afterSet = new Set(after.selectors || []);
  const added = [...afterSet].filter((selector) => !beforeSet.has(selector) && isTargetSelector(selector));
  const removed = [...beforeSet].filter((selector) => !afterSet.has(selector) && isTargetSelector(selector));

  return {
    changed: added.length > 0 || removed.length > 0,
    added,
    removed,
    textLengthDelta: (after.textLength || 0) - (before.textLength || 0),
  };
}

function registerHoverRegion(point, hoverDelta) {
  const rect = targetPage.getBoundingClientRect();
  const cell = 124;
  const key = `${Math.floor((point.x - rect.left) / cell)}:${Math.floor((point.y - rect.top) / cell)}`;
  const current = state.hoverRegions.get(key) || {
    key,
    x: rect.left + Math.floor((point.x - rect.left) / cell) * cell,
    y: rect.top + Math.floor((point.y - rect.top) / cell) * cell,
    width: cell,
    height: cell,
    hits: 0,
    selectors: new Set(),
  };
  current.hits += 1;
  for (const selector of hoverDelta.added) current.selectors.add(selector);
  for (const selector of hoverDelta.removed) current.selectors.add(selector);
  state.hoverRegions.set(key, current);
  drawRegion(current);
}

function buildFindings() {
  const semantic = window.PALS.tools.semanticMap();
  const findings = [];
  const targetHeadings = semantic.headings.filter((item) => boundsInsideTarget(item.bounds));
  const targetInteractive = semantic.interactive.filter((item) => boundsInsideTarget(item.bounds));
  const targetFields = semantic.fields.filter((item) => boundsInsideTarget(item.bounds));

  for (const item of targetInteractive) {
    if (!item.accessibleName) {
      findings.push({
        severity: "high",
        id: "PALS-A11Y-001",
        message: "Interactive element has no accessible name.",
        selector: item.selector,
      });
    }
  }

  for (const field of targetFields) {
    if (!field.label && !field.accessibleName) {
      findings.push({
        severity: "high",
        id: "PALS-A11Y-002",
        message: "Form field has no label or accessible name.",
        selector: field.selector,
      });
    }
  }

  if (!targetHeadings.some((item) => item.level === 1)) {
    findings.push({
      severity: "medium",
      id: "PALS-A11Y-003",
      message: "Target page has no h1 heading.",
      selector: "#target-page",
    });
  }

  for (const region of state.hoverRegions.values()) {
    findings.push({
      severity: "medium",
      id: "PALS-UX-001",
      message: `Pointer hover changed visible UI in region ${region.key}.`,
      selector: [...region.selectors][0] || "#target-page",
    });
  }

  return dedupeFindings(findings);
}

function renderLiveState() {
  pointMetric.textContent = String(state.samples.length);
  elementMetric.textContent = String(state.selectors.size);
  hoverMetric.textContent = String(state.hoverRegions.size);
  findingMetric.textContent = String(state.findings.length);

  renderElements();
  renderFindings();
  renderSummary();
}

function renderElements() {
  const items = [...state.selectors.values()]
    .sort((left, right) => right.hits - left.hits)
    .slice(0, 9);
  elementList.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.name} · ${item.selector} · ${item.hits} hit(s)`;
      return li;
    })
  );

  if (!items.length) {
    elementList.append(emptyListItem("No elements sampled yet."));
  }
}

function renderFindings() {
  findingList.replaceChildren(
    ...state.findings.slice(0, 8).map((finding) => {
      const li = document.createElement("li");
      li.textContent = `[${finding.severity}] ${finding.id}: ${finding.message} ${finding.selector}`;
      return li;
    })
  );

  if (!state.findings.length) {
    findingList.append(emptyListItem("Findings appear after the scan completes."));
  }
}

function renderSummary() {
  const summary = {
    engine: "PALS",
    mode: "browser-live-demo",
    pointsScanned: state.samples.length,
    uniqueElements: state.selectors.size,
    hoverRegions: state.hoverRegions.size,
    findings: {
      total: state.findings.length,
      high: state.findings.filter((item) => item.severity === "high").length,
      medium: state.findings.filter((item) => item.severity === "medium").length,
    },
  };
  summaryOutput.textContent = JSON.stringify(summary, null, 2);
}

function drawPoint(point, hot, index) {
  const marker = document.createElement("span");
  const rect = overlay.getBoundingClientRect();
  marker.className = `scan-point${hot ? " hot" : ""}`;
  marker.style.left = `${point.x - rect.left}px`;
  marker.style.top = `${point.y - rect.top}px`;
  marker.style.opacity = String(Math.max(0.3, 1 - index / Math.max(state.points.length, 1)));
  overlay.append(marker);
}

function drawRegion(region) {
  const rect = overlay.getBoundingClientRect();
  let node = overlay.querySelector(`[data-region="${region.key}"]`);
  if (!node) {
    node = document.createElement("span");
    node.className = "scan-region";
    node.dataset.region = region.key;
    overlay.append(node);
  }

  node.style.left = `${region.x - rect.left}px`;
  node.style.top = `${region.y - rect.top}px`;
  node.style.width = `${region.width}px`;
  node.style.height = `${region.height}px`;
}

function moveCursor(point) {
  const rect = overlay.getBoundingClientRect();
  cursor.style.transform = `translate3d(${point.x - rect.left}px, ${point.y - rect.top}px, 0)`;
}

function emptyListItem(text) {
  const li = document.createElement("li");
  li.textContent = text;
  return li;
}

function isUsefulTargetSelector(selector) {
  if (!isTargetSelector(selector)) return false;
  const element = safeQuery(selector);
  if (!element) return false;
  return !["HTML", "BODY", "MAIN", "SECTION", "ARTICLE"].includes(element.tagName);
}

function isTargetSelector(selector) {
  const element = safeQuery(selector);
  return !!element && targetPage.contains(element);
}

function safeQuery(selector) {
  try {
    return selector ? document.querySelector(selector) : null;
  } catch (_error) {
    return null;
  }
}

function boundsInsideTarget(bounds) {
  if (!bounds) return false;
  const center = centerFromBounds(bounds);
  return center ? pointInsideRect(center, targetPage.getBoundingClientRect()) : false;
}

function centerFromBounds(bounds) {
  if (!bounds) return null;
  return {
    x: Number(bounds.x) + Number(bounds.width) / 2,
    y: Number(bounds.y) + Number(bounds.height) / 2,
  };
}

function centerFromRect(rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function pointInsideRect(point, rect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function uniquePoints(points) {
  const seen = new Set();
  const unique = [];

  for (const point of points) {
    const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(point);
  }

  return unique;
}

function dedupeFindings(findings) {
  const seen = new Set();
  const result = [];

  for (const finding of findings) {
    const key = `${finding.id}:${finding.selector}:${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(finding);
  }

  return result;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
