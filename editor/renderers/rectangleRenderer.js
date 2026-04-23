export function render(ctx, layer, options = {}) {
  if (!layer.rect) return;
  ctx.save();
  ctx.strokeStyle = layer.params?.color ?? '#ff0000';
  const thickness = layer.params?.thickness ?? options.lineWidth ?? 2;
  ctx.lineWidth = thickness;
  ctx.strokeRect(
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
