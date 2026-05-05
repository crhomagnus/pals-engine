export function compareScans(before, after) {
  const beforeSelectors = selectorMap(before);
  const afterSelectors = selectorMap(after);
  const beforeKeys = new Set(beforeSelectors.keys());
  const afterKeys = new Set(afterSelectors.keys());
  const addedSelectors = [...afterKeys]
    .filter((selector) => !beforeKeys.has(selector))
    .map((selector) => afterSelectors.get(selector));
  const removedSelectors = [...beforeKeys]
    .filter((selector) => !afterKeys.has(selector))
    .map((selector) => beforeSelectors.get(selector));

  return {
    before: scanLabel(before),
    after: scanLabel(after),
    summary: {
      beforeSamples: before.samples?.length || 0,
      afterSamples: after.samples?.length || 0,
      beforeHoverChanges: before.aggregate?.hoverChanges || 0,
      afterHoverChanges: after.aggregate?.hoverChanges || 0,
      beforeRegions: before.regions?.length || 0,
      afterRegions: after.regions?.length || 0,
      addedSelectors: addedSelectors.length,
      removedSelectors: removedSelectors.length,
    },
    addedSelectors,
    removedSelectors,
    regionDelta: {
      addedDynamicRegions: countRegions(after, "dynamic-hover") - countRegions(before, "dynamic-hover"),
      addedInteractiveRegions: countRegions(after, "interactive") - countRegions(before, "interactive"),
    },
  };
}

export function generateCompareMarkdown(diff) {
  const lines = [
    "# PALS Scan Diff",
    "",
    `- **Before:** ${diff.before}`,
    `- **After:** ${diff.after}`,
    `- **Before Samples:** ${diff.summary.beforeSamples}`,
    `- **After Samples:** ${diff.summary.afterSamples}`,
    `- **Before Hover Changes:** ${diff.summary.beforeHoverChanges}`,
    `- **After Hover Changes:** ${diff.summary.afterHoverChanges}`,
    `- **Before Regions:** ${diff.summary.beforeRegions}`,
    `- **After Regions:** ${diff.summary.afterRegions}`,
    `- **Added Selectors:** ${diff.summary.addedSelectors}`,
    `- **Removed Selectors:** ${diff.summary.removedSelectors}`,
    "",
    "## Region Delta",
    "",
    `- **Dynamic Hover Region Delta:** ${diff.regionDelta.addedDynamicRegions}`,
    `- **Interactive Region Delta:** ${diff.regionDelta.addedInteractiveRegions}`,
    "",
    "## Added Selectors",
    "",
  ];

  appendSelectorTable(lines, diff.addedSelectors);

  lines.push("");
  lines.push("## Removed Selectors");
  lines.push("");
  appendSelectorTable(lines, diff.removedSelectors);
  lines.push("");

  return lines.join("\n");
}

function selectorMap(scan) {
  const map = new Map();

  for (const item of scan.aggregate?.uniqueUnderPointer || []) {
    map.set(item.selector, item);
  }

  for (const region of scan.regions || []) {
    for (const item of region.selectors || []) {
      if (!map.has(item.selector)) {
        map.set(item.selector, item);
      }
    }
  }

  return map;
}

function countRegions(scan, type) {
  return (scan.regions || []).filter((region) => region.type === type).length;
}

function scanLabel(scan) {
  return `${scan.url || "unknown"} (${scan.createdAt || "unknown"})`;
}

function appendSelectorTable(lines, selectors) {
  if (!selectors.length) {
    lines.push("None.");
    return;
  }

  lines.push("| Kind | Source | Name | Selector |");
  lines.push("| --- | --- | --- | --- |");
  for (const item of selectors.slice(0, 80)) {
    lines.push(
      `| ${safeCell(item.kind)} | ${safeCell(item.source)} | ${safeCell(
        item.name
      )} | \`${safeCell(item.selector)}\` |`
    );
  }
}

function safeCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
}
