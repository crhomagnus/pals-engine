import { cssPath, elementName, isPalsOverlay } from "./utils.js";

export function semanticMap(root = globalThis) {
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
