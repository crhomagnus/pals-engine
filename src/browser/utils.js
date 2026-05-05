import { PALS_LENS_ATTRIBUTE } from "./defaults.js";

export function mergeOptions(base, extra = {}) {
  return { ...base, ...extra };
}

export function asArray(value) {
  return Array.prototype.slice.call(value || []);
}

export function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function assertDocument(doc, method) {
  if (!doc || !doc.documentElement || !doc.defaultView) {
    throw new Error(`PALS.${method}() needs a browser document.`);
  }
}

export function compactText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function elementName(element) {
  if (!element || !element.tagName) return null;
  return element.tagName.toLowerCase();
}

export function escapeCss(value, root = globalThis) {
  if (root.CSS && typeof root.CSS.escape === "function") {
    return root.CSS.escape(value);
  }

  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

export function cssPath(element, root = globalThis) {
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

export function isPalsOverlay(element) {
  if (!element || !element.getAttribute) return false;
  if (element.getAttribute(PALS_LENS_ATTRIBUTE) === "lens") return true;

  if (element.closest) {
    return !!element.closest(`[${PALS_LENS_ATTRIBUTE}="lens"]`);
  }

  return false;
}

export function elementVisible(element) {
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

export function textCanCreateBox(node) {
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
