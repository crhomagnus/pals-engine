export function createHoverDelta(beforeMap, afterMap) {
  const before = selectorSet(beforeMap);
  const after = selectorSet(afterMap);

  return {
    added: [...after].filter((selector) => !before.has(selector)),
    removed: [...before].filter((selector) => !after.has(selector)),
    changed:
      JSON.stringify(beforeMap.summary || {}) !== JSON.stringify(afterMap.summary || {}),
  };
}

function selectorSet(map) {
  return new Set(
    [
      ...(map.hitStack || []).map((item) => item.selector),
      ...(map.explicit || []).map((item) => item.selector),
      ...(map.implicit || []).map((item) => item.selector),
    ].filter(Boolean)
  );
}
