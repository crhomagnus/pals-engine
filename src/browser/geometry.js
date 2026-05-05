export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function isZeroArea(rect) {
  return rect.width === 0 || rect.height === 0;
}

export function pointInsideRect(point, rect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

export function rectToObject(rect) {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export function relationToRect(point, body) {
  const rect = body.rect;
  const nearestX = clamp(point.x, rect.left, rect.right);
  const nearestY = clamp(point.y, rect.top, rect.bottom);
  const dx = point.x - nearestX;
  const dy = point.y - nearestY;

  return {
    kind: body.kind,
    source: body.source,
    name: body.name,
    selector: body.selector,
    framePath: body.framePath,
    rectIndex: body.rectIndex,
    textSample: body.textSample || undefined,
    measurement: body.measurement,
    inside: pointInsideRect(point, rect),
    distance: Math.sqrt(dx * dx + dy * dy),
    localPoint: {
      x: point.x - rect.left,
      y: point.y - rect.top,
    },
    normalizedPoint: {
      x: rect.width ? (point.x - rect.left) / rect.width : null,
      y: rect.height ? (point.y - rect.top) / rect.height : null,
    },
    sides: {
      left: point.x - rect.left,
      right: rect.right - point.x,
      top: point.y - rect.top,
      bottom: rect.bottom - point.y,
      centerX: point.x - (rect.left + rect.width / 2),
      centerY: point.y - (rect.top + rect.height / 2),
    },
    nearestPoint: {
      x: nearestX,
      y: nearestY,
    },
    viewportRect: rectToObject(rect),
  };
}

export function sortRelations(relations) {
  relations.sort((a, b) => {
    if (a.inside !== b.inside) return a.inside ? -1 : 1;
    return (a.distance || 0) - (b.distance || 0);
  });
}
