export function render(ctx, layer) {
  if (!layer.rect) return;
  ctx.save();
  ctx.fillStyle = layer.params?.color ?? '#FFA500';
  ctx.globalAlpha = layer.params?.opacity ?? 0.3;
  ctx.fillRect(
    layer.rect.x,
    layer.rect.y,
    layer.rect.width,
    layer.rect.height
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
