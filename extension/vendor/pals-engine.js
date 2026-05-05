/*
 * PALS Engine browser bundle.
 * Generated from src/browser modules by scripts/build-browser-bundle.js.
 */
(function installPalsEngine(root) {
  "use strict";

/* src/shared/grid.js */
function buildViewportGrid(options = {}) {
  const width = numberOr(options.width, 1280);
  const height = numberOr(options.height, 720);
  const step = Math.max(8, numberOr(options.step, 160));
  const margin = Math.max(0, numberOr(options.margin, 8));
  const points = [];
  const maxX = Math.max(margin, width - margin - 1);
  const maxY = Math.max(margin, height - margin - 1);

  for (let y = margin; y <= maxY; y += step) {
    for (let x = margin; x <= maxX; x += step) {
      points.push({ x: Math.round(x), y: Math.round(y) });
    }
  }

  const corners = [
    { x: margin, y: margin },
    { x: maxX, y: margin },
    { x: margin, y: maxY },
    { x: maxX, y: maxY },
    { x: Math.round(width / 2), y: Math.round(height / 2) },
  ];

  for (const point of corners) {
    if (!points.some((item) => item.x === point.x && item.y === point.y)) {
      points.push(point);
    }
  }

  return points;
}

function numberOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}


/* src/browser/defaults.js */
const PALS_VERSION = "0.1.0";

const PALS_LENS_ATTRIBUTE = "data-pals-engine";

const DEFAULT_SCAN_OPTIONS = {
  document: null,
  text: true,
  openShadowRoots: true,
  sameOriginIframes: true,
  pseudoElements: true,
  zeroAreaBoxes: false,
  elementsWithoutBoxes: false,
  pseudoTargets: ["::before", "::after", "::marker", "::placeholder"],
};


/* src/browser/geometry.js */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isZeroArea(rect) {
  return rect.width === 0 || rect.height === 0;
}

function pointInsideRect(point, rect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function rectToObject(rect) {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function relationToRect(point, body) {
  const rect = body.rect;
  const nearestX = clamp(point.x, rect.left, rect.right);
  const nearestY = clamp(point.y, rect.top, rect.bottom);
  const dx = point.x - nearestX;
  const dy = point.y - nearestY;

  return {
    kind: body.kind,
    source: body.source,
    name: body.name,
    selector: body.selector,
    framePath: body.framePath,
    rectIndex: body.rectIndex,
    textSample: body.textSample || undefined,
    measurement: body.measurement,
    inside: pointInsideRect(point, rect),
    distance: Math.sqrt(dx * dx + dy * dy),
    localPoint: {
      x: point.x - rect.left,
      y: point.y - rect.top,
    },
    normalizedPoint: {
      x: rect.width ? (point.x - rect.left) / rect.width : null,
      y: rect.height ? (point.y - rect.top) / rect.height : null,
    },
    sides: {
      left: point.x - rect.left,
      right: rect.right - point.x,
      top: point.y - rect.top,
      bottom: rect.bottom - point.y,
      centerX: point.x - (rect.left + rect.width / 2),
      centerY: point.y - (rect.top + rect.height / 2),
    },
    nearestPoint: {
      x: nearestX,
      y: nearestY,
    },
    viewportRect: rectToObject(rect),
  };
}

function sortRelations(relations) {
  relations.sort((a, b) => {
    if (a.inside !== b.inside) return a.inside ? -1 : 1;
    return (a.distance || 0) - (b.distance || 0);
  });
}


/* src/browser/utils.js */

function mergeOptions(base, extra = {}) {
  return { ...base, ...extra };
}

function asArray(value) {
  return Array.prototype.slice.call(value || []);
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function assertDocument(doc, method) {
  if (!doc || !doc.documentElement || !doc.defaultView) {
    throw new Error(`PALS.${method}() needs a browser document.`);
  }
}

function compactText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function elementName(element) {
  if (!element || !element.tagName) return null;
  return element.tagName.toLowerCase();
}

function escapeCss(value, root = globalThis) {
  if (root.CSS && typeof root.CSS.escape === "function") {
    return root.CSS.escape(value);
  }

  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function cssPath(element, root = globalThis) {
  if (!element) return null;
  if (element.id) return `#${escapeCss(element.id, root)}`;

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let part = current.tagName.toLowerCase();
    const parent = current.parentElement;

    if (current.id) {
      part += `#${escapeCss(current.id, root)}`;
      parts.unshift(part);
      break;
    }

    if (parent) {
      const siblings = asArray(parent.children).filter(
        (sibling) => sibling.tagName === current.tagName
      );

      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }

    parts.unshift(part);
    current = parent;
  }

  return parts.join(" > ");
}

function isPalsOverlay(element) {
  if (!element || !element.getAttribute) return false;
  if (element.getAttribute(PALS_LENS_ATTRIBUTE) === "lens") return true;

  if (element.closest) {
    return !!element.closest(`[${PALS_LENS_ATTRIBUTE}="lens"]`);
  }

  return false;
}

function elementVisible(element) {
  if (isPalsOverlay(element)) return false;

  const view = element.ownerDocument.defaultView;
  if (!view || !view.getComputedStyle) return true;

  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const style = view.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.contentVisibility === "hidden"
    ) {
      return false;
    }

    current = current.parentElement;
  }

  return true;
}

function textCanCreateBox(node) {
  const element = node.parentElement;
  if (!element) return false;
  if (elementForbiddenForText(element)) return false;
  if (!elementVisible(element)) return false;

  const range = node.ownerDocument.createRange();
  range.selectNodeContents(node);
  const hasBox = range.getClientRects().length > 0;
  range.detach();

  return hasBox;
}

function elementForbiddenForText(element) {
  const blocked = {
    script: true,
    style: true,
    template: true,
    noscript: true,
    head: true,
    title: true,
    meta: true,
    link: true,
  };

  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (blocked[elementName(current)]) return true;
    current = current.parentElement;
  }

  return false;
}


/* src/browser/dom-collector.js */

function collectBodies(context) {
  const bodies = [];
  bodies.push(...collectElementBodies(context));

  if (context.options.text) {
    bodies.push(...collectTextBodies(context));
  }

  if (context.options.pseudoElements) {
    bodies.push(...collectPseudoBodies(context));
  }

  return bodies;
}

function collectElementBodies(context) {
  const elements = visitElements(context.document, context.options);
  const bodies = [];

  for (const element of elements) {
    const rects = rectsForNode(element);

    if (!rects.length && context.options.elementsWithoutBoxes) {
      bodies.push({
        kind: "explicit",
        source: "element-without-box",
        node: element,
        selector: cssPath(element, context.root),
        name: elementName(element),
        framePath: context.framePath.slice(),
        rect: null,
        rectIndex: null,
        measurement: "no-box",
      });
      continue;
    }

    rects.forEach((rect, rectIndex) => {
      if (!context.options.zeroAreaBoxes && isZeroArea(rect)) return;

      bodies.push({
        kind: "explicit",
        source: "element",
        node: element,
        selector: cssPath(element, context.root),
        name: elementName(element),
        framePath: context.framePath.slice(),
        rect,
        rectIndex,
        measurement: "exact",
      });
    });
  }

  return bodies;
}

function collectTextBodies(context) {
  const doc = context.document;
  const root = doc.documentElement;
  const bodies = [];

  if (!root) return bodies;

  const filter = {
    acceptNode(node) {
      return compactText(node.nodeValue) && textCanCreateBox(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  };
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, filter);
  let textNode = walker.nextNode();

  while (textNode) {
    const range = doc.createRange();
    range.selectNodeContents(textNode);

    const rects = asArray(range.getClientRects());
    rects.forEach((rect, rectIndex) => {
      if (!context.options.zeroAreaBoxes && isZeroArea(rect)) return;

      bodies.push({
        kind: "implicit",
        source: "text-fragment",
        node: textNode,
        selector: cssPath(textNode.parentElement, context.root),
        name: "#text",
        textSample: compactText(textNode.nodeValue).slice(0, 96),
        framePath: context.framePath.slice(),
        rect,
        rectIndex,
        measurement: "exact",
      });
    });

    range.detach();
    textNode = walker.nextNode();
  }

  return bodies;
}

function collectPseudoBodies(context) {
  const elements = visitElements(context.document, context.options);
  const bodies = [];

  for (const element of elements) {
    const view = element.ownerDocument.defaultView;
    if (!view || !view.getComputedStyle) continue;

    for (const pseudo of context.options.pseudoTargets) {
      const style = getPseudoStyle(view, element, pseudo);
      if (!pseudoExists(element, pseudo, style)) continue;

      bodies.push({
        kind: "implicit",
        source: "pseudo-element",
        node: element,
        selector: cssPath(element, context.root),
        name: pseudo,
        framePath: context.framePath.slice(),
        rect: null,
        rectIndex: null,
        measurement: "blocked",
        reason:
          "The browser exposes computed style for this pseudo-element, but not its exact rendered box.",
      });
    }
  }

  return bodies;
}

function scanSameOriginFrames(context, scanDocument) {
  const blocked = [];
  const frames = asArray(context.document.querySelectorAll("iframe, frame"));

  for (const frame of frames) {
    const rect = frame.getBoundingClientRect();
    if (!pointInsideRect(context.point, rect)) continue;

    let childDocument = null;
    try {
      childDocument = frame.contentDocument;
    } catch (_error) {
      childDocument = null;
    }

    if (!childDocument || !childDocument.documentElement) {
      blocked.push({
        kind: "implicit",
        source: "iframe-cross-origin",
        selector: cssPath(frame, context.root),
        framePath: context.framePath.slice(),
        measurement: "blocked",
        reason:
          "JavaScript in the parent page cannot inspect layout inside a cross-origin iframe.",
      });
      continue;
    }

    const childPoint = {
      x: context.point.x - rect.left - frame.clientLeft,
      y: context.point.y - rect.top - frame.clientTop,
      space: "viewport",
    };

    const childContext = {
      ...context,
      document: childDocument,
      point: childPoint,
      framePath: context.framePath.concat(cssPath(frame, context.root)),
    };

    scanDocument(childContext);
  }

  return blocked;
}

function visualStackAtPoint(doc, point, root = globalThis) {
  if (!doc.elementsFromPoint) return [];

  return asArray(doc.elementsFromPoint(point.x, point.y))
    .filter((element) => !isPalsOverlay(element))
    .map((element) => ({
      name: elementName(element),
      selector: cssPath(element, root),
      cursor: computedCursor(element),
    }));
}

function visitElements(doc, options) {
  const visited = [];
  const seen = [];
  const root = doc.documentElement;

  function visit(node) {
    if (!node || seen.includes(node)) return;
    seen.push(node);

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (isPalsOverlay(node)) return;
      if (!elementVisible(node)) return;

      visited.push(node);

      if (options.openShadowRoots && node.shadowRoot) {
        visit(node.shadowRoot);
      }
    }

    let child = node.firstElementChild;
    while (child) {
      visit(child);
      child = child.nextElementSibling;
    }
  }

  visit(root);
  return visited;
}

function rectsForNode(node) {
  try {
    return asArray(node.getClientRects());
  } catch (_error) {
    return [];
  }
}

function getPseudoStyle(view, element, pseudo) {
  try {
    return view.getComputedStyle(element, pseudo);
  } catch (_error) {
    return null;
  }
}

function pseudoExists(element, pseudo, style) {
  if (!style || style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  if (pseudo === "::placeholder") {
    return elementHasPlaceholder(element);
  }

  if (pseudo === "::marker") {
    return elementGeneratesMarker(element);
  }

  return !!(
    style.content &&
    style.content !== "none" &&
    style.content !== "normal"
  );
}

function elementHasPlaceholder(element) {
  if (!element || !element.hasAttribute || !element.hasAttribute("placeholder")) {
    return false;
  }

  const name = elementName(element);
  return (
    (name === "input" || name === "textarea") &&
    element.getAttribute("placeholder") !== ""
  );
}

function elementGeneratesMarker(element) {
  if (!element || !element.ownerDocument) return false;

  const name = elementName(element);
  if (name === "li" || name === "summary") return true;

  const view = element.ownerDocument.defaultView;
  if (!view || !view.getComputedStyle) return false;

  return view.getComputedStyle(element).display === "list-item";
}

function computedCursor(element) {
  const view = element.ownerDocument.defaultView;
  if (!view || !view.getComputedStyle) return null;

  return view.getComputedStyle(element).cursor;
}


/* src/browser/reporter.js */
function measuredRelations(map) {
  return [...(map.explicit || []), ...(map.implicit || [])].filter(
    (relation) => relation.measurement === "exact"
  );
}

function bodiesUnderPointer(map) {
  return measuredRelations(map).filter((relation) => relation.inside === true);
}

function nearestBodies(map, limit = 10) {
  return measuredRelations(map)
    .slice()
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

function relationsBySelector(map, selector) {
  return measuredRelations(map).filter((relation) => relation.selector === selector);
}

function compactSummary(map) {
  const underPointer = bodiesUnderPointer(map);
  const nearest = nearestBodies(map, 1)[0] || null;

  return {
    pointer: map.pointer,
    counts: map.summary,
    underPointer: underPointer.map((relation) => ({
      kind: relation.kind,
      source: relation.source,
      name: relation.name,
      selector: relation.selector,
    })),
    nearest: nearest
      ? {
          kind: nearest.kind,
          source: nearest.source,
          name: nearest.name,
          selector: nearest.selector,
          distance: nearest.distance,
        }
      : null,
    blocked: map.blocked,
  };
}


/* src/browser/hover-sensor.js */
function createHoverDelta(beforeMap, afterMap) {
  const before = selectorSet(beforeMap);
  const after = selectorSet(afterMap);

  return {
    added: [...after].filter((selector) => !before.has(selector)),
    removed: [...before].filter((selector) => !after.has(selector)),
    changed:
      JSON.stringify(beforeMap.summary || {}) !== JSON.stringify(afterMap.summary || {}),
  };
}

function selectorSet(map) {
  return new Set(
    [
      ...(map.hitStack || []).map((item) => item.selector),
      ...(map.explicit || []).map((item) => item.selector),
      ...(map.implicit || []).map((item) => item.selector),
    ].filter(Boolean)
  );
}


/* src/browser/page-signature.js */

function pageSignature(root = globalThis) {
  const doc = root.document;
  if (!doc || !doc.documentElement) {
    return { selectors: [], interactive: [], textLength: 0 };
  }

  const selectors = [];
  const interactive = [];
  const elements = Array.prototype.slice.call(doc.querySelectorAll("*"));

  for (const element of elements) {
    if (isPalsOverlay(element)) continue;
    if (!isVisibleElement(element)) continue;

    const selector = cssPath(element, root);
    selectors.push(selector);

    if (isInteractiveElement(element)) {
      interactive.push(selector);
    }
  }

  return {
    selectors,
    interactive,
    textLength: (doc.body?.innerText || "").length,
  };
}

function isVisibleElement(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const view = element.ownerDocument.defaultView;
  if (!view || !view.getComputedStyle) return true;

  const style = view.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function isInteractiveElement(element) {
  const name = elementName(element);
  if (
    ["a", "button", "input", "select", "textarea", "summary", "label"].includes(name)
  ) {
    return true;
  }

  const role = element.getAttribute("role");
  if (role && ["button", "link", "tab", "menuitem", "checkbox"].includes(role)) {
    return true;
  }

  const view = element.ownerDocument.defaultView;
  if (!view || !view.getComputedStyle) return false;

  return view.getComputedStyle(element).cursor === "pointer";
}


/* src/browser/semantic-map.js */

function semanticMap(root = globalThis) {
  const doc = root.document;
  if (!doc || !doc.documentElement) {
    return emptyMap();
  }

  const elements = Array.prototype.slice.call(
    doc.querySelectorAll(
      "a, button, input, select, textarea, summary, [role], [tabindex], label, h1, h2, h3, h4, h5, h6"
    )
  );
  const interactive = [];
  const fields = [];
  const headings = [];

  for (const element of elements) {
    if (isPalsOverlay(element)) continue;
    if (!isVisible(element)) continue;

    const name = elementName(element);
    const item = describeElement(element, root);

    if (/^h[1-6]$/.test(name)) {
      headings.push({
        selector: item.selector,
        level: Number(name.slice(1)),
        text: visibleText(element),
        bounds: item.bounds,
      });
      continue;
    }

    if (isField(element)) {
      fields.push(item);
    }

    if (isInteractive(element)) {
      interactive.push(item);
    }
  }

  return {
    summary: {
      interactive: interactive.length,
      fields: fields.length,
      buttons: interactive.filter((item) => item.role === "button").length,
      links: interactive.filter((item) => item.role === "link").length,
      headings: headings.length,
      h1: headings.filter((item) => item.level === 1).length,
      unnamedInteractive: interactive.filter((item) => !item.accessibleName).length,
      unlabeledFields: fields.filter((item) => !item.label && !item.accessibleName).length,
    },
    interactive,
    fields,
    headings,
  };
}

function describeElement(element, root) {
  const tag = elementName(element);
  const role = inferredRole(element);
  const accessibleName = computeAccessibleName(element);
  const rect = element.getBoundingClientRect();

  return {
    selector: cssPath(element, root),
    tag,
    role,
    accessibleName,
    text: visibleText(element).slice(0, 120),
    label: associatedLabel(element),
    placeholder: element.getAttribute("placeholder") || "",
    title: element.getAttribute("title") || "",
    href: element.getAttribute("href") || "",
    type: element.getAttribute("type") || "",
    required: element.hasAttribute("required"),
    disabled: element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true",
    focusable: isFocusable(element),
    cursor: computedStyle(element).cursor,
    bounds: {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    },
  };
}

function computeAccessibleName(element) {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  const ariaLabelledBy = element.getAttribute("aria-labelledby");
  if (ariaLabelledBy) {
    const text = ariaLabelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.innerText || "")
      .join(" ")
      .trim();
    if (text) return text;
  }

  const label = associatedLabel(element);
  if (label) return label;

  const text = visibleText(element);
  if (text) return text;

  const alt = element.getAttribute("alt");
  if (alt && alt.trim()) return alt.trim();

  const placeholder = element.getAttribute("placeholder");
  if (placeholder && placeholder.trim()) return placeholder.trim();

  const title = element.getAttribute("title");
  if (title && title.trim()) return title.trim();

  return "";
}

function associatedLabel(element) {
  const doc = element.ownerDocument;
  if (element.id) {
    const explicit = doc.querySelector(`label[for="${cssString(element.id, doc)}"]`);
    if (explicit && visibleText(explicit)) return visibleText(explicit);
  }

  const parent = element.closest?.("label");
  if (parent && visibleText(parent)) return visibleText(parent);

  return "";
}

function inferredRole(element) {
  const explicit = element.getAttribute("role");
  if (explicit) return explicit;

  const tag = elementName(element);
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (tag === "input") {
    const type = (element.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "range") return "slider";
    if (type === "submit" || type === "button" || type === "reset") return "button";
    return "textbox";
  }
  if (tag === "summary") return "button";
  if (tag === "label") return "label";
  return tag;
}

function isField(element) {
  return ["input", "select", "textarea"].includes(elementName(element));
}

function isInteractive(element) {
  const tag = elementName(element);
  if (["a", "button", "input", "select", "textarea", "summary"].includes(tag)) {
    return true;
  }

  if (element.hasAttribute("tabindex")) return true;
  if (element.getAttribute("role")) return true;

  return computedStyle(element).cursor === "pointer";
}

function isFocusable(element) {
  if (element.hasAttribute("disabled")) return false;
  if (element.hasAttribute("tabindex")) return element.getAttribute("tabindex") !== "-1";

  return ["a", "button", "input", "select", "textarea", "summary"].includes(
    elementName(element)
  );
}

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const style = computedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function visibleText(element) {
  return String(element.innerText || element.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function computedStyle(element) {
  return element.ownerDocument.defaultView.getComputedStyle(element);
}

function cssString(value, doc) {
  const css = doc.defaultView.CSS;
  if (css && typeof css.escape === "function") {
    return css.escape(value);
  }

  return String(value).replace(/["\\]/g, "\\$&");
}

function emptyMap() {
  return {
    summary: {
      interactive: 0,
      fields: 0,
      buttons: 0,
      links: 0,
      headings: 0,
      h1: 0,
      unnamedInteractive: 0,
      unlabeledFields: 0,
    },
    interactive: [],
    fields: [],
    headings: [],
  };
}


/* src/browser/scanner.js */

function createScanner(root = globalThis) {
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


/* src/browser/lens.js */

function createLens(root, scanner) {
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


/* src/browser/index.js */

function createPalsEngine(root = globalThis) {
  const scanner = createScanner(root);
  const lens = createLens(root, scanner);

  return {
    name: "Pointer-Adaptive Layout Scanner Engine",
    shortName: "PALS Engine",
    version: PALS_VERSION,
    observe: scanner.observe,
    stopObserving: scanner.stopObserving,
    scanPoint: scanner.scanPoint,
    scanEvent: scanner.scanEvent,
    scanViewport: scanner.scanViewport,
    captureNextClick: scanner.captureNextClick,
    activateLens: lens.activateLens,
    deactivateLens: lens.deactivateLens,
    tools: {
      measuredRelations,
      bodiesUnderPointer,
      nearestBodies,
      relationsBySelector,
      compactSummary,
      createHoverDelta,
      pageSignature: () => pageSignature(root),
      semanticMap: () => semanticMap(root),
    },
  };
}

function createLegacyAdapter(engine) {
  return {
    observar: engine.observe,
    desligarTudo: engine.stopObserving,
    mapear: engine.scanPoint,
    mapearEvento: engine.scanEvent,
    ativarLente: engine.activateLens,
    desativarLente: engine.deactivateLens,
    capturarProximoClique: engine.captureNextClick,
    ferramentas: {
      corposSobPonteiro: engine.tools.bodiesUnderPointer,
      corposMaisProximos: engine.tools.nearestBodies,
      relacoesPorSeletor: engine.tools.relationsBySelector,
      resumoCurto: engine.tools.compactSummary,
    },
  };
}


  const engine = createPalsEngine(root);
  root.PALS = engine;
  root.PALSEngine = engine;
  root.PonteiroRelacional = createLegacyAdapter(engine);
})(typeof window !== "undefined" ? window : globalThis);
