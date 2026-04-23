export function render(ctx, layer, options = {}) {
  if (!layer.rect || !options.image) return;
  ctx.save();
  ctx.filter = `blur(${layer.params?.radius ?? 5}px)`;
  ctx.drawImage(
    options.image,
    layer.rect.x,
    layer.rect.y,
    layer.rect.width,
    layer.rect.height,
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
