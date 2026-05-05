export function generateFindings(scan) {
  const findings = [];
  const semantic = scan.semantic || {};

  for (const item of semantic.interactive || []) {
    if (!item.accessibleName && item.role !== "label") {
      findings.push({
        id: "PALS-A11Y-001",
        severity: "high",
        category: "accessibility",
        selector: item.selector,
        message: "Interactive element has no accessible name.",
        evidence: `${item.tag} role=${item.role}`,
      });
    }

    if (item.role === "link" && !item.href) {
      findings.push({
        id: "PALS-QA-001",
        severity: "medium",
        category: "qa",
        selector: item.selector,
        message: "Link-like element has no href attribute.",
        evidence: item.text || item.accessibleName || item.selector,
      });
    }
  }

  for (const field of semantic.fields || []) {
    if (!field.label && !field.accessibleName) {
      findings.push({
        id: "PALS-A11Y-002",
        severity: "high",
        category: "accessibility",
        selector: field.selector,
        message: "Form field has no label or accessible name.",
        evidence: `${field.tag} type=${field.type || "default"}`,
      });
    }
  }

  if ((semantic.summary?.h1 || 0) === 0) {
    findings.push({
      id: "PALS-A11Y-003",
      severity: "medium",
      category: "accessibility",
      selector: "document",
      message: "Page has no visible h1 heading.",
      evidence: "semantic.summary.h1 = 0",
    });
  }

  if ((semantic.summary?.h1 || 0) > 1) {
    findings.push({
      id: "PALS-A11Y-004",
      severity: "low",
      category: "accessibility",
      selector: "document",
      message: "Page has multiple visible h1 headings.",
      evidence: `semantic.summary.h1 = ${semantic.summary.h1}`,
    });
  }

  const hoverSelectors = hoverRevealedSelectors(scan);
  for (const selector of hoverSelectors) {
    findings.push({
      id: "PALS-UX-001",
      severity: "medium",
      category: "dynamic-ui",
      selector,
      message: "Element is revealed or removed during pointer hover.",
      evidence: "Detected by active pointer scanning hover delta.",
    });
  }

  for (const region of scan.regions || []) {
    if (region.type === "dynamic-hover" && region.interactiveHits > 0) {
      findings.push({
        id: "PALS-QA-002",
        severity: "medium",
        category: "qa",
        selector: region.selectors?.[0]?.selector || region.key,
        message: "Interactive region changes during hover.",
        evidence: `region=${region.key} hoverChanges=${region.hoverChanges}`,
      });
    }
  }

  if ((scan.aggregate?.blocked || []).length > 0) {
    findings.push({
      id: "PALS-LIMIT-001",
      severity: "low",
      category: "measurement-limit",
      selector: "document",
      message: "Some visual items cannot be measured exactly through public browser APIs.",
      evidence: `${scan.aggregate.blocked.length} blocked item(s)`,
    });
  }

  return {
    summary: summarizeFindings(findings),
    items: dedupeFindings(findings),
  };
}

function hoverRevealedSelectors(scan) {
  const selectors = new Set();

  for (const sample of scan.samples || []) {
    for (const selector of sample.hoverDelta?.added || []) {
      selectors.add(selector);
    }
    for (const selector of sample.hoverDelta?.removed || []) {
      selectors.add(selector);
    }
  }

  return [...selectors].filter(Boolean);
}

function summarizeFindings(findings) {
  return {
    total: findings.length,
    critical: findings.filter((item) => item.severity === "critical").length,
    high: findings.filter((item) => item.severity === "high").length,
    medium: findings.filter((item) => item.severity === "medium").length,
    low: findings.filter((item) => item.severity === "low").length,
  };
}

function dedupeFindings(findings) {
  const seen = new Set();
  const result = [];

  for (const finding of findings) {
    const key = `${finding.id}:${finding.selector}:${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(finding);
  }

  return result;
}
