import { pointToSegmentDistance } from '../utils/geometry.js';

export function render(ctx, layer, options = {}) {
  if (!layer.points) return;
  const { x1, y1, x2, y2 } = layer.points;
  const thickness = layer.params?.thickness ?? options.lineWidth ?? 2;
  const color = layer.params?.color ?? '#ff0000';

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';

  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);

  const minThickness = Math.max(thickness, 3);
  const arrowLength = 12 + minThickness * 1.5;
  const arrowBaseWidth = minThickness * 2.5;

  const lineEndX = x2 - arrowLength * Math.cos(angle);
  const lineEndY = y2 - arrowLength * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(lineEndX, lineEndY);
  ctx.stroke();

  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);

  const tipX = x2;
  const tipY = y2;
  const baseLeftX = lineEndX + perpX * (arrowBaseWidth / 2);
  const baseLeftY = lineEndY + perpY * (arrowBaseWidth / 2);
  const baseRightX = lineEndX - perpX * (arrowBaseWidth / 2);
  const baseRightY = lineEndY - perpY * (arrowBaseWidth / 2);

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseLeftX, baseLeftY);
  ctx.lineTo(baseRightX, baseRightY);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function hitTest(point, layer) {
  if (!layer.points) return false;
  const d1 = Math.hypot(point.x - layer.points.x1, point.y - layer.points.y1);
  const d2 = Math.hypot(point.x - layer.points.x2, point.y - layer.points.y2);
  if (d1 < 12 || d2 < 12) return true;

  const distToSegment = pointToSegmentDistance(
    point.x, point.y,
    layer.points.x1, layer.points.y1,
    layer.points.x2, layer.points.y2
  );
  const hitTolerance = Math.max(10, (layer.params?.thickness || 2) + 5);
  return distToSegment < hitTolerance;
}
