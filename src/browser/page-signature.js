import { cssPath, elementName, isPalsOverlay } from "./utils.js";

export function pageSignature(root = globalThis) {
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
