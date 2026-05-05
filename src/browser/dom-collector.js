import { isZeroArea, pointInsideRect } from "./geometry.js";
import {
  asArray,
  compactText,
  cssPath,
  elementName,
  elementVisible,
  isPalsOverlay,
  textCanCreateBox,
} from "./utils.js";

export function collectBodies(context) {
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

export function collectElementBodies(context) {
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

export function collectTextBodies(context) {
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

export function collectPseudoBodies(context) {
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

export function scanSameOriginFrames(context, scanDocument) {
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

export function visualStackAtPoint(doc, point, root = globalThis) {
  if (!doc.elementsFromPoint) return [];

  return asArray(doc.elementsFromPoint(point.x, point.y))
    .filter((element) => !isPalsOverlay(element))
    .map((element) => ({
      name: elementName(element),
      selector: cssPath(element, root),
      cursor: computedCursor(element),
    }));
}

export function visitElements(doc, options) {
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
