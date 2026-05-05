import { DEFAULT_SCAN_OPTIONS } from "./defaults.js";
import { relationToRect, sortRelations } from "./geometry.js";
import {
  collectBodies,
  scanSameOriginFrames,
  visualStackAtPoint,
} from "./dom-collector.js";
import { assertDocument, isNumber, mergeOptions } from "./utils.js";
import { buildViewportGrid } from "../shared/grid.js";

export function createScanner(root = globalThis) {
  let lastPulse = null;
  const listeners = [];

  function observe(options = {}) {
    const config = mergeOptions(DEFAULT_SCAN_OPTIONS, options);
    const doc = config.document || root.document;
    assertDocument(doc, "observe");

    function storePulse(event) {
      lastPulse = pulseFromEvent(event);
    }

    doc.addEventListener("pointermove", storePulse, {
      capture: true,
      passive: true,
    });
    doc.addEventListener("mousemove", storePulse, {
      capture: true,
      passive: true,
    });

    const stop = () => {
      doc.removeEventListener("pointermove", storePulse, true);
      doc.removeEventListener("mousemove", storePulse, true);
    };

    listeners.push(stop);
    return stop;
  }

  function stopObserving() {
    while (listeners.length) {
      listeners.pop()();
    }
  }

  function scanEvent(event, options = {}) {
    return scanPoint(event, options);
  }

  function scanPoint(input, options = {}) {
    const config = mergeOptions(DEFAULT_SCAN_OPTIONS, options);
    const doc = config.document || root.document;
    assertDocument(doc, "scanPoint");

    const point = pointFromInput(input, doc);
    const output = createMap(point, doc);
    const context = {
      root,
      document: doc,
      point,
      options: config,
      framePath: [],
      output,
    };

    scanDocument(context);
    sortRelations(output.explicit);
    sortRelations(output.implicit);

    output.summary = {
      explicit: output.explicit.length,
      implicit: output.implicit.length,
      blocked: output.blocked.length,
      hitStack: output.hitStack.length,
    };

    return output;
  }

  function scanViewport(options = {}) {
    const config = mergeOptions(DEFAULT_SCAN_OPTIONS, options);
    const doc = config.document || root.document;
    assertDocument(doc, "scanViewport");

    const view = doc.defaultView;
    const points = buildViewportGrid({
      width: options.width || view.innerWidth,
      height: options.height || view.innerHeight,
      step: options.step || 160,
      margin: options.margin || 8,
    });

    const samples = points.map((point) => ({
      point,
      map: scanPoint(point, config),
    }));

    return {
      engine: "PALS",
      mode: "virtual-viewport-grid",
      createdAt: new Date().toISOString(),
      viewport: {
        width: view.innerWidth,
        height: view.innerHeight,
      },
      grid: {
        step: options.step || 160,
        points: points.length,
      },
      samples,
      aggregate: aggregateSamples(samples),
    };
  }

  function captureNextClick(callback, options = {}) {
    const config = mergeOptions({ document: null, blockClick: true }, options);
    const doc = config.document || root.document;
    assertDocument(doc, "captureNextClick");

    function onClick(event) {
      doc.removeEventListener("click", onClick, true);

      if (config.blockClick) {
        event.preventDefault();
        event.stopPropagation();
      }

      const map = scanPoint(event, config);
      if (typeof callback === "function") {
        callback(map, event);
      }
    }

    doc.addEventListener("click", onClick, true);
    return () => doc.removeEventListener("click", onClick, true);
  }

  function scanDocument(context) {
    const bodies = collectBodies(context);

    for (const body of bodies) {
      registerBody(body, context);
    }

    if (context.options.sameOriginIframes) {
      context.output.blocked.push(...scanSameOriginFrames(context, scanDocument));
    }
  }

  function registerBody(body, context) {
    if (body.measurement === "blocked") {
      context.output.blocked.push(blockedRelation(body));
      return;
    }

    if (!body.rect) {
      context.output[body.kind].push({
        kind: body.kind,
        source: body.source,
        name: body.name,
        selector: body.selector,
        framePath: body.framePath,
        measurement: body.measurement,
      });
      return;
    }

    context.output[body.kind].push(relationToRect(context.point, body));
  }

  function createMap(point, doc) {
    const view = doc.defaultView;

    return {
      engine: "PALS",
      pointer: {
        viewport: { x: point.x, y: point.y },
        page: {
          x: point.x + view.scrollX,
          y: point.y + view.scrollY,
        },
        unit: "CSS pixel",
      },
      hitStack: visualStackAtPoint(doc, point, root),
      explicit: [],
      implicit: [],
      blocked: [],
      summary: null,
    };
  }

  function pointFromInput(input, doc) {
    const view = doc.defaultView;

    if (input && isNumber(input.clientX) && isNumber(input.clientY)) {
      return { x: input.clientX, y: input.clientY };
    }

    if (input && isNumber(input.x) && isNumber(input.y)) {
      if (input.space === "page") {
        return { x: input.x - view.scrollX, y: input.y - view.scrollY };
      }

      return { x: input.x, y: input.y };
    }

    if (lastPulse) {
      return { x: lastPulse.viewport.x, y: lastPulse.viewport.y };
    }

    throw new Error(
      "Missing pointer coordinate. Pass an event, pass {x, y}, or call observe() and move the pointer first."
    );
  }

  function pulseFromEvent(event) {
    return {
      viewport: { x: event.clientX, y: event.clientY },
      page: { x: event.pageX, y: event.pageY },
      screen: { x: event.screenX, y: event.screenY },
      type: event.pointerType || "mouse",
      timeStamp: event.timeStamp,
    };
  }

  return {
    observe,
    stopObserving,
    scanPoint,
    scanEvent,
    scanViewport,
    captureNextClick,
  };
}

function blockedRelation(body) {
  return {
    kind: body.kind,
    source: body.source,
    name: body.name,
    selector: body.selector,
    framePath: body.framePath,
    measurement: body.measurement,
    reason: body.reason,
  };
}

function aggregateSamples(samples) {
  const selectors = new Map();
  const blocked = new Map();

  for (const sample of samples) {
    const map = sample.map;
    for (const relation of [...map.explicit, ...map.implicit]) {
      if (!relation.selector) continue;
      const current = selectors.get(relation.selector) || {
        selector: relation.selector,
        kind: relation.kind,
        source: relation.source,
        hits: 0,
      };
      current.hits += relation.inside ? 1 : 0;
      selectors.set(relation.selector, current);
    }

    for (const item of map.blocked) {
      const key = `${item.source}:${item.selector}:${item.name || ""}`;
      blocked.set(key, item);
    }
  }

  return {
    selectors: [...selectors.values()].sort((a, b) => b.hits - a.hits),
    blocked: [...blocked.values()],
  };
}
