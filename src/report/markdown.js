export function aggregatePointerSamples(samples = []) {
  const selectors = new Map();
  const blocked = new Map();
  let explicit = 0;
  let implicit = 0;
  let hoverChanges = 0;

  for (const sample of samples) {
    explicit += sample.summary?.explicit || 0;
    implicit += sample.summary?.implicit || 0;
    if (sample.hoverDelta?.changed) hoverChanges += 1;

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
    explicitObservations: explicit,
    implicitObservations: implicit,
    hoverChanges,
    uniqueUnderPointer: [...selectors.values()].sort((a, b) => b.hits - a.hits),
    blocked: [...blocked.values()],
  };
}

export function generateMarkdownReport(scan) {
  const aggregate = scan.aggregate || aggregatePointerSamples(scan.samples || []);
  const lines = [
    `# PALS Scan Report`,
    "",
    `- **URL:** ${scan.url || "unknown"}`,
    `- **Created At:** ${scan.createdAt || "unknown"}`,
    `- **Mode:** ${scan.mode || "unknown"}`,
    `- **Viewport:** ${scan.viewport?.width || "?"} x ${scan.viewport?.height || "?"}`,
    `- **Adaptive:** ${scan.adaptive ? "yes" : "no"}`,
    `- **Pointer Samples:** ${aggregate.points}`,
    `- **Coarse Points:** ${scan.grid?.coarsePoints ?? scan.grid?.points ?? "?"}`,
    `- **Semantic Seed Points:** ${scan.grid?.semanticPoints ?? 0}`,
    `- **Refined Points:** ${scan.grid?.refinedPoints ?? 0}`,
    `- **Explicit Observations:** ${aggregate.explicitObservations}`,
    `- **Implicit Observations:** ${aggregate.implicitObservations}`,
    `- **Hover Changes:** ${aggregate.hoverChanges}`,
    `- **Blocked/Publicly Unmeasurable Items:** ${aggregate.blocked.length}`,
    `- **Findings:** ${scan.findings?.summary?.total ?? 0}`,
    `- **High Findings:** ${scan.findings?.summary?.high ?? 0}`,
    "",
    "## Foundation",
    "",
    "This report is generated from active pointer scanning. The pointer moves through the viewport, asks the browser what exists at each coordinate, and builds a spatial interface map from those observations.",
    "",
    "## Most Frequent Bodies Under Pointer",
    "",
  ];

  if (!aggregate.uniqueUnderPointer.length) {
    lines.push("No measured body was found under the sampled pointer positions.");
  } else {
    lines.push("| Hits | Kind | Source | Name | Selector |");
    lines.push("| ---: | --- | --- | --- | --- |");
    for (const item of aggregate.uniqueUnderPointer.slice(0, 30)) {
      lines.push(
        `| ${item.hits} | ${safeCell(item.kind)} | ${safeCell(item.source)} | ${safeCell(
          item.name
        )} | \`${safeCell(item.selector)}\` |`
      );
    }
  }

  lines.push("");
  lines.push("## Adaptive Regions");
  lines.push("");

  if (!scan.regions?.length) {
    lines.push("No regions were generated.");
  } else {
    lines.push("| Score | Type | Bounds | Samples | Interactive Hits | Hover Changes | Top Selectors |");
    lines.push("| ---: | --- | --- | ---: | ---: | ---: | --- |");
    for (const region of scan.regions.slice(0, 20)) {
      const bounds = `${region.bounds.x},${region.bounds.y} ${region.bounds.width}x${region.bounds.height}`;
      const selectors = (region.selectors || [])
        .slice(0, 4)
        .map((item) => `\`${safeCell(item.selector)}\``)
        .join("<br>");
      lines.push(
        `| ${region.score} | ${safeCell(region.type)} | ${safeCell(bounds)} | ${
          region.samples
        } | ${region.interactiveHits} | ${region.hoverChanges} | ${selectors} |`
      );
    }
  }

  lines.push("");
  lines.push("## Semantic UI Map");
  lines.push("");

  if (!scan.semantic) {
    lines.push("No semantic map was collected.");
  } else {
    lines.push(`- **Interactive Elements:** ${scan.semantic.summary?.interactive ?? 0}`);
    lines.push(`- **Fields:** ${scan.semantic.summary?.fields ?? 0}`);
    lines.push(`- **Buttons:** ${scan.semantic.summary?.buttons ?? 0}`);
    lines.push(`- **Links:** ${scan.semantic.summary?.links ?? 0}`);
    lines.push(`- **Headings:** ${scan.semantic.summary?.headings ?? 0}`);
    lines.push(`- **H1:** ${scan.semantic.summary?.h1 ?? 0}`);
    lines.push(
      `- **Unnamed Interactive:** ${scan.semantic.summary?.unnamedInteractive ?? 0}`
    );
    lines.push(`- **Unlabeled Fields:** ${scan.semantic.summary?.unlabeledFields ?? 0}`);
    lines.push("");

    if ((scan.semantic.interactive || []).length) {
      lines.push("| Role | Name | Selector | Bounds |");
      lines.push("| --- | --- | --- | --- |");
      for (const item of scan.semantic.interactive.slice(0, 30)) {
        const bounds = item.bounds
          ? `${round(item.bounds.x)},${round(item.bounds.y)} ${round(
              item.bounds.width
            )}x${round(item.bounds.height)}`
          : "";
        lines.push(
          `| ${safeCell(item.role)} | ${safeCell(item.accessibleName || item.text)} | \`${safeCell(
            item.selector
          )}\` | ${safeCell(bounds)} |`
        );
      }
    }
  }

  lines.push("");
  lines.push("## Findings");
  lines.push("");

  if (!scan.findings?.items?.length) {
    lines.push("No QA/A11y finding was generated.");
  } else {
    lines.push("| Severity | ID | Category | Selector | Message |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const finding of scan.findings.items.slice(0, 80)) {
      lines.push(
        `| ${safeCell(finding.severity)} | ${safeCell(finding.id)} | ${safeCell(
          finding.category
        )} | \`${safeCell(finding.selector)}\` | ${safeCell(finding.message)} |`
      );
    }
  }

  lines.push("");
  lines.push("## Hover Changes");
  lines.push("");

  const hoverSamples = (scan.samples || []).filter((sample) => sample.hoverDelta?.changed);
  if (!hoverSamples.length) {
    lines.push("No hover-driven structural change was detected in sampled points.");
  } else {
    lines.push("| Phase | X | Y | Added | Removed | Text Delta |");
    lines.push("| --- | ---: | ---: | --- | --- | ---: |");
    for (const sample of hoverSamples.slice(0, 30)) {
      lines.push(
        `| ${safeCell(sample.phase)} | ${sample.point.x} | ${sample.point.y} | ${safeCell(
          (sample.hoverDelta.added || []).slice(0, 4).join("<br>")
        )} | ${safeCell(
          (sample.hoverDelta.removed || []).slice(0, 4).join("<br>")
        )} | ${sample.hoverDelta.textLengthDelta || 0} |`
      );
    }
  }

  lines.push("");
  lines.push("## Blocked Or Publicly Unmeasurable Items");
  lines.push("");

  if (!aggregate.blocked.length) {
    lines.push("No blocked item was detected.");
  } else {
    lines.push("| Source | Name | Selector | Reason |");
    lines.push("| --- | --- | --- | --- |");
    for (const item of aggregate.blocked) {
      lines.push(
        `| ${safeCell(item.source)} | ${safeCell(item.name)} | \`${safeCell(
          item.selector
        )}\` | ${safeCell(item.reason)} |`
      );
    }
  }

  lines.push("");
  lines.push("## Sample Points");
  lines.push("");
  lines.push("| Phase | X | Y | Under Pointer | Explicit | Implicit | Blocked |");
  lines.push("| --- | ---: | ---: | --- | ---: | ---: | ---: |");

  for (const sample of (scan.samples || []).slice(0, 80)) {
    const label = (sample.underPointer || [])
      .slice(0, 3)
      .map((item) => item.selector)
      .join("<br>");
    lines.push(
      `| ${safeCell(sample.phase || "sample")} | ${sample.point.x} | ${
        sample.point.y
      } | ${safeCell(label)} | ${
        sample.summary?.explicit || 0
      } | ${sample.summary?.implicit || 0} | ${sample.summary?.blocked || 0} |`
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- Pseudo-element boxes, closed shadow roots, and cross-origin iframe internals may exist visually but are not fully exposed through standard page JavaScript.");
  lines.push("- PALS records those cases as blocked instead of inventing precision.");
  lines.push("- Adaptive mode starts with a coarse pointer grid, visits semantic seed controls, and refines around samples with interaction, hover changes, blocked items, or non-structural bodies.");
  lines.push("- The current scan is an initial QA/A11y Auditor implementation and should be treated as a technical audit artifact.");
  lines.push("");

  return lines.join("\n");
}

function safeCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
