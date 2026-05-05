export function buildViewportGrid(options = {}) {
  const width = numberOr(options.width, 1280);
  const height = numberOr(options.height, 720);
  const step = Math.max(8, numberOr(options.step, 160));
  const margin = Math.max(0, numberOr(options.margin, 8));
  const points = [];
  const maxX = Math.max(margin, width - margin - 1);
  const maxY = Math.max(margin, height - margin - 1);

  for (let y = margin; y <= maxY; y += step) {
    for (let x = margin; x <= maxX; x += step) {
      points.push({ x: Math.round(x), y: Math.round(y) });
    }
  }

  const corners = [
    { x: margin, y: margin },
    { x: maxX, y: margin },
    { x: margin, y: maxY },
    { x: maxX, y: maxY },
    { x: Math.round(width / 2), y: Math.round(height / 2) },
  ];

  for (const point of corners) {
    if (!points.some((item) => item.x === point.x && item.y === point.y)) {
      points.push(point);
    }
  }

  return points;
}

function numberOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
