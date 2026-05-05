export function measuredRelations(map) {
  return [...(map.explicit || []), ...(map.implicit || [])].filter(
    (relation) => relation.measurement === "exact"
  );
}

export function bodiesUnderPointer(map) {
  return measuredRelations(map).filter((relation) => relation.inside === true);
}

export function nearestBodies(map, limit = 10) {
  return measuredRelations(map)
    .slice()
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

export function relationsBySelector(map, selector) {
  return measuredRelations(map).filter((relation) => relation.selector === selector);
}

export function compactSummary(map) {
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
