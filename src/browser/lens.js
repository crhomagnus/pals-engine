import { PALS_LENS_ATTRIBUTE } from "./defaults.js";
import { bodiesUnderPointer, nearestBodies } from "./reporter.js";

export function createLens(root, scanner) {
  let activeLens = null;

  function activateLens(options = {}) {
    const config = {
      document: null,
      intervalMs: 120,
      draw: true,
      maxBoxes: 8,
      panelWidth: 340,
      ...options,
    };
    const doc = config.document || root.document;
    const view = doc.defaultView;

    if (activeLens) {
      activeLens.stop();
    }

    const panel = doc.createElement("pre");
    stylePanel(panel, config);
    panel.textContent = "PALS active. Move the pointer.";

    const canvas = doc.createElement("canvas");
    styleCanvas(canvas);

    doc.documentElement.appendChild(canvas);
    doc.documentElement.appendChild(panel);

    const state = {
      lastMap: null,
      lastTime: 0,
      scheduled: false,
      lastEvent: null,
    };

    function onMove(event) {
      state.lastEvent = event;

      const now = Date.now();
      if (now - state.lastTime < config.intervalMs || state.scheduled) {
        return;
      }

      state.lastTime = now;
      state.scheduled = true;

      view.requestAnimationFrame(() => {
        state.scheduled = false;
        if (!state.lastEvent) return;

        try {
          state.lastMap = scanner.scanEvent(state.lastEvent, config);
          panel.textContent = lensText(state.lastMap);

          if (config.draw) {
            drawMap(canvas, state.lastMap, config);
          }
        } catch (error) {
          panel.textContent = `Error: ${error.message}`;
        }
      });
    }

    function onLeave() {
      clearCanvas(canvas);
    }

    function onKeyDown(event) {
      if (event.key === "Escape") stop();
    }

    function stop() {
      doc.removeEventListener("pointermove", onMove, true);
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseleave", onLeave, true);
      doc.removeEventListener("keydown", onKeyDown, true);

      if (panel.parentNode) panel.parentNode.removeChild(panel);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (activeLens && activeLens.stop === stop) activeLens = null;
    }

    doc.addEventListener("pointermove", onMove, { capture: true, passive: true });
    doc.addEventListener("mousemove", onMove, { capture: true, passive: true });
    doc.addEventListener("mouseleave", onLeave, { capture: true, passive: true });
    doc.addEventListener("keydown", onKeyDown, true);

    activeLens = {
      stop,
      lastMap: () => state.lastMap,
    };

    return activeLens;
  }

  function deactivateLens() {
    if (activeLens) activeLens.stop();
  }

  return {
    activateLens,
    deactivateLens,
  };
}

function stylePanel(panel, config) {
  panel.setAttribute(PALS_LENS_ATTRIBUTE, "lens");
  panel.style.position = "fixed";
  panel.style.right = "12px";
  panel.style.bottom = "12px";
  panel.style.boxSizing = "border-box";
  panel.style.width = `${config.panelWidth}px`;
  panel.style.maxWidth = "calc(100vw - 24px)";
  panel.style.maxHeight = "48vh";
  panel.style.margin = "0";
  panel.style.padding = "10px";
  panel.style.overflow = "auto";
  panel.style.background = "rgba(18, 20, 26, 0.92)";
  panel.style.color = "#f5f7fb";
  panel.style.border = "1px solid rgba(255,255,255,0.22)";
  panel.style.borderRadius = "6px";
  panel.style.font =
    "12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  panel.style.whiteSpace = "pre-wrap";
  panel.style.zIndex = "2147483647";
  panel.style.pointerEvents = "none";
}

function styleCanvas(canvas) {
  canvas.setAttribute(PALS_LENS_ATTRIBUTE, "lens");
  canvas.style.position = "fixed";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.margin = "0";
  canvas.style.padding = "0";
  canvas.style.zIndex = "2147483646";
  canvas.style.pointerEvents = "none";
}

function lensText(map) {
  const under = bodiesUnderPointer(map);
  const nearest = nearestBodies(map, 4);
  const lines = [
    "PALS Engine",
    `x: ${round(map.pointer.viewport.x)} y: ${round(map.pointer.viewport.y)}`,
    `explicit: ${map.summary.explicit}`,
    `implicit: ${map.summary.implicit}`,
    `blocked: ${map.summary.blocked}`,
    "",
    "under pointer:",
  ];

  if (!under.length) lines.push("  no measured body");

  for (let index = 0; index < under.length && index < 8; index += 1) {
    lines.push(`  ${relationLabel(under[index])}`);
  }

  lines.push("");
  lines.push("nearest:");

  for (const relation of nearest) {
    lines.push(`  ${round(relation.distance)}px ${relationLabel(relation)}`);
  }

  if (map.blocked.length) {
    lines.push("");
    lines.push("without public box:");
    for (let index = 0; index < map.blocked.length && index < 5; index += 1) {
      lines.push(`  ${map.blocked[index].name} on ${map.blocked[index].selector}`);
    }
  }

  return lines.join("\n");
}

function relationLabel(relation) {
  return `${relation.source} ${relation.name} ${relation.selector}`;
}

function drawMap(canvas, map, config) {
  const view = canvas.ownerDocument.defaultView;
  const scale = view.devicePixelRatio || 1;
  const width = view.innerWidth;
  const height = view.innerHeight;

  if (canvas.width !== Math.round(width * scale)) {
    canvas.width = Math.round(width * scale);
  }

  if (canvas.height !== Math.round(height * scale)) {
    canvas.height = Math.round(height * scale);
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);

  let relations = bodiesUnderPointer(map);
  if (!relations.length) {
    relations = nearestBodies(map, Math.min(3, config.maxBoxes));
  }

  relations = relations.slice(0, config.maxBoxes);

  for (let index = relations.length - 1; index >= 0; index -= 1) {
    drawRelation(ctx, relations[index], index);
  }
}

function drawRelation(ctx, relation, index) {
  if (!relation.viewportRect) return;

  const rect = relation.viewportRect;
  const color = relation.kind === "explicit" ? "#23c483" : "#f2a541";

  ctx.save();
  ctx.lineWidth = Math.max(1, 3 - index * 0.2);
  ctx.strokeStyle = color;
  ctx.setLineDash(index % 2 ? [5, 4] : []);
  ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
  ctx.restore();
}

function clearCanvas(canvas) {
  const view = canvas.ownerDocument.defaultView;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, view.innerWidth, view.innerHeight);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
