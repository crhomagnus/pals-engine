function generateMarkdownReport(scan) {
  const lines = [
    "# PALS Extension Audit",
    "",
    `- **URL:** ${scan.url}`,
    `- **Title:** ${scan.title || ""}`,
    `- **Created At:** ${scan.createdAt}`,
    `- **Mode:** ${scan.mode}`,
    `- **Viewport:** ${scan.viewport.width} x ${scan.viewport.height}`,
    `- **Pointer Samples:** ${scan.aggregate.points}`,
    `- **Findings:** ${scan.findings.summary.total}`,
    `- **High Findings:** ${scan.findings.summary.high}`,
    "",
    "## Foundation",
    "",
    "This report is generated from PALS pointer scanning. Quick Audit samples a viewport grid; Live Capture records real pointer movement while the operator moves through the page.",
    "",
    "## Semantic UI Map",
    "",
    `- **Interactive Elements:** ${scan.semantic.summary.interactive}`,
    `- **Fields:** ${scan.semantic.summary.fields}`,
    `- **Buttons:** ${scan.semantic.summary.buttons}`,
    `- **Links:** ${scan.semantic.summary.links}`,
    `- **Headings:** ${scan.semantic.summary.headings}`,
    `- **Unnamed Interactive:** ${scan.semantic.summary.unnamedInteractive}`,
    `- **Unlabeled Fields:** ${scan.semantic.summary.unlabeledFields}`,
    "",
    "## Findings",
    "",
  ];

  if (!scan.findings.items.length) {
    lines.push("No findings generated.");
  } else {
    lines.push("| Severity | ID | Category | Selector | Message |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const item of scan.findings.items) {
      lines.push(
        `| ${cell(item.severity)} | ${cell(item.id)} | ${cell(item.category)} | \`${cell(
          item.selector
        )}\` | ${cell(item.message)} |`
      );
    }
  }

  lines.push("");
  lines.push("## Top Bodies Under Pointer");
  lines.push("");

  if (!scan.aggregate.uniqueUnderPointer.length) {
    lines.push("No body sampled under pointer.");
  } else {
    lines.push("| Hits | Kind | Source | Name | Selector |");
    lines.push("| ---: | --- | --- | --- | --- |");
    for (const item of scan.aggregate.uniqueUnderPointer.slice(0, 30)) {
      lines.push(
        `| ${item.hits} | ${cell(item.kind)} | ${cell(item.source)} | ${cell(
          item.name
        )} | \`${cell(item.selector)}\` |`
      );
    }
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- Chrome extensions cannot move the trusted OS pointer without invasive debugger/native permissions.");
  lines.push("- Use Live Capture when you want true pointer movement from a human operator.");
  lines.push("- Use the CLI when you need automated pointer dispatch for CI or repeatable local scans.");
  lines.push("");

  return lines.join("\n");
}

function cell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
}
