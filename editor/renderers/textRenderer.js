import { wrapTextInRect } from '../utils/canvas.js';

export function render(ctx, layer) {
  if (!layer.rect) return;
  ctx.save();
  const fontSize = layer.params?.fontSize ?? 16;
  ctx.fillStyle = layer.params?.color ?? '#000000';
  ctx.font = `${fontSize}px Arial`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  wrapTextInRect(
    ctx,
    layer.params?.text ?? '',
    layer.rect.x,
    layer.rect.y,
    layer.rect.width,
    layer.rect.height,
    fontSize
  );
  ctx.restore();
}

export function hitTest(point, layer) {
  if (!layer.rect) return false;
  return (
    point.x >= layer.rect.x &&
    point.x <= layer.rect.x + layer.rect.width &&
    point.y >= layer.rect.y &&
    point.y <= layer.rect.y + layer.rect.height
  );
}
