export function pointKey(point) {
  return `${Math.round(point.x)}:${Math.round(point.y)}`;
}

export function buildRefinementPoints(samples, options = {}) {
  const width = numberOr(options.width, 1280);
  const height = numberOr(options.height, 720);
  const margin = Math.max(0, numberOr(options.margin, 8));
  const coarseStep = Math.max(16, numberOr(options.coarseStep, 160));
  const refineStep = Math.max(8, numberOr(options.refineStep, Math.round(coarseStep / 3)));
  const radius = Math.max(refineStep, Math.round(coarseStep / 2));
  const maxPoints = Math.max(0, numberOr(options.maxPoints, 120));
  const seen = new Set(options.excludeKeys || []);
  const candidates = [];

  for (const sample of samples) {
    if (!isInterestingSample(sample)) continue;

    const around = [
      { x: sample.point.x - radius, y: sample.point.y - radius },
      { x: sample.point.x, y: sample.point.y - radius },
      { x: sample.point.x + radius, y: sample.point.y - radius },
      { x: sample.point.x - radius, y: sample.point.y },
      { x: sample.point.x + radius, y: sample.point.y },
      { x: sample.point.x - radius, y: sample.point.y + radius },
      { x: sample.point.x, y: sample.point.y + radius },
      { x: sample.point.x + radius, y: sample.point.y + radius },
      { x: sample.point.x - refineStep, y: sample.point.y },
      { x: sample.point.x + refineStep, y: sample.point.y },
      { x: sample.point.x, y: sample.point.y - refineStep },
      { x: sample.point.x, y: sample.point.y + refineStep },
    ];

    for (const point of around) {
      const refined = clampPoint(point, width, height, margin);
      const key = pointKey(refined);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        ...refined,
        reason: interestReason(sample),
        parent: sample.point,
      });

      if (candidates.length >= maxPoints) return candidates;
    }
  }

  return candidates;
}

export function summarizeRegions(samples, options = {}) {
  const cellSize = Math.max(24, numberOr(options.cellSize, 160));
  const regions = new Map();

  for (const sample of samples) {
    const cellX = Math.floor(sample.point.x / cellSize);
    const cellY = Math.floor(sample.point.y / cellSize);
    const key = `${cellX}:${cellY}`;
    const region =
      regions.get(key) ||
      createRegion({
        key,
        x: cellX * cellSize,
        y: cellY * cellSize,
        width: cellSize,
        height: cellSize,
      });

    region.samples += 1;
    region.score += sampleScore(sample);

    for (const item of sample.underPointer || []) {
      if (!item.selector || isStructuralSelector(item.selector)) continue;
      region.selectors.set(item.selector, {
        selector: item.selector,
        kind: item.kind,
        source: item.source,
        name: item.name,
      });
      region.interactiveHits += item.cursor === "pointer" ? 1 : 0;
    }

    for (const item of sample.hitStack || []) {
      if (item.cursor === "pointer") region.interactiveHits += 1;
    }

    if (sample.hoverDelta?.changed) {
      region.hoverChanges += 1;
      for (const selector of sample.hoverDelta.added || []) {
        region.hoverAdded.add(selector);
      }
      for (const selector of sample.hoverDelta.removed || []) {
        region.hoverRemoved.add(selector);
      }
    }

    region.blocked += (sample.blocked || []).length;
    regions.set(key, region);
  }

  return [...regions.values()]
    .map((region) => ({
      key: region.key,
      bounds: region.bounds,
      samples: region.samples,
      score: region.score,
      interactiveHits: region.interactiveHits,
      hoverChanges: region.hoverChanges,
      blocked: region.blocked,
      selectors: [...region.selectors.values()],
      hoverAdded: [...region.hoverAdded],
      hoverRemoved: [...region.hoverRemoved],
      type: classifyRegion(region),
    }))
    .sort((a, b) => b.score - a.score);
}

export function buildSemanticSeedPoints(semantic, options = {}) {
  const width = numberOr(options.width, 1280);
  const height = numberOr(options.height, 720);
  const margin = Math.max(0, numberOr(options.margin, 8));
  const maxPoints = Math.max(0, numberOr(options.maxPoints, 80));
  const seen = new Set(options.excludeKeys || []);
  const points = [];
  const candidates = [
    ...(semantic?.interactive || []),
    ...(semantic?.fields || []),
  ];

  for (const item of candidates) {
    if (!item.bounds || item.bounds.width === 0 || item.bounds.height === 0) {
      continue;
    }

    const point = clampPoint(
      {
        x: item.bounds.x + item.bounds.width / 2,
        y: item.bounds.y + item.bounds.height / 2,
      },
      width,
      height,
      margin
    );
    const key = pointKey(point);
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({
      ...point,
      reason: "semantic-interactive",
      selector: item.selector,
      role: item.role,
    });

    if (points.length >= maxPoints) return points;
  }

  return points;
}

export function comparePageSignatures(before, after) {
  const beforeSelectors = new Set(before?.selectors || []);
  const afterSelectors = new Set(after?.selectors || []);
  const added = [...afterSelectors].filter((selector) => !beforeSelectors.has(selector));
  const removed = [...beforeSelectors].filter((selector) => !afterSelectors.has(selector));
  const textLengthDelta = (after?.textLength || 0) - (before?.textLength || 0);

  return {
    changed: added.length > 0 || removed.length > 0 || textLengthDelta !== 0,
    added,
    removed,
    textLengthDelta,
    beforeCount: beforeSelectors.size,
    afterCount: afterSelectors.size,
  };
}

export function isInterestingSample(sample) {
  if ((sample.blocked || []).length > 0) return true;
  if (sample.hoverDelta?.changed) return true;
  if ((sample.underPointer || []).some((item) => !isStructuralSelector(item.selector))) {
    return true;
  }
  if ((sample.hitStack || []).some((item) => item.cursor === "pointer")) return true;
  return false;
}

function sampleScore(sample) {
  let score = 0;

  for (const item of sample.underPointer || []) {
    if (!isStructuralSelector(item.selector)) score += 4;
    if (item.cursor === "pointer") score += 5;
  }

  for (const item of sample.hitStack || []) {
    if (item.cursor === "pointer") score += 3;
  }

  if (sample.hoverDelta?.changed) score += 8;
  score += (sample.blocked || []).length * 2;

  return score;
}

function interestReason(sample) {
  if (sample.hoverDelta?.changed) return "hover-change";
  if ((sample.hitStack || []).some((item) => item.cursor === "pointer")) {
    return "pointer-cursor";
  }
  if ((sample.blocked || []).length) return "blocked-item";
  return "non-structural-body";
}

function createRegion({ key, x, y, width, height }) {
  return {
    key,
    bounds: { x, y, width, height },
    samples: 0,
    score: 0,
    interactiveHits: 0,
    hoverChanges: 0,
    blocked: 0,
    selectors: new Map(),
    hoverAdded: new Set(),
    hoverRemoved: new Set(),
  };
}

function classifyRegion(region) {
  if (region.hoverChanges > 0) return "dynamic-hover";
  if (region.interactiveHits > 0) return "interactive";
  if (region.selectors.size > 0) return "content";
  if (region.blocked > 0) return "blocked";
  return "low-signal";
}

function isStructuralSelector(selector) {
  return (
    !selector ||
    selector === "html" ||
    selector === "body" ||
    selector === "html > body" ||
    selector === "main" ||
    selector === "html > body > main"
  );
}

function clampPoint(point, width, height, margin) {
  return {
    x: clamp(Math.round(point.x), margin, Math.max(margin, width - margin - 1)),
    y: clamp(Math.round(point.y), margin, Math.max(margin, height - margin - 1)),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function numberOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
