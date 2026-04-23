export function render(ctx, layer, options = {}) {
  if (!layer.rect) return;
  const { validX, validY, validWidth, validHeight } = options.cropCoords ?? {
    validX: 0, validY: 0, validWidth: Infinity, validHeight: Infinity
  };

  // Координаты прямоугольника слоя
  const left = layer.rect.x;
  const top = layer.rect.y;
  const right = layer.rect.x + layer.rect.width;
  const bottom = layer.rect.y + layer.rect.height;

  ctx.save();
  ctx.strokeStyle = layer.params?.color ?? '#ff0000';
  ctx.lineWidth = layer.params?.thickness ?? options.lineWidth ?? 2;
  ctx.beginPath();

  // Верхняя линия
  if (top >= validY && top <= validY + validHeight) {
    const xStart = Math.max(validX, left);
    const xEnd = Math.min(right, validX + validWidth);
    if (xStart < xEnd) {
      ctx.moveTo(xStart, top);
      ctx.lineTo(xEnd, top);
    }
  }

  // Нижняя линия
  if (bottom >= validY && bottom <= validY + validHeight) {
    const xStart = Math.max(validX, left);
    const xEnd = Math.min(right, validX + validWidth);
    if (xStart < xEnd) {
      ctx.moveTo(xStart, bottom);
      ctx.lineTo(xEnd, bottom);
    }
  }

  // Левая линия
  if (left >= validX && left <= validX + validWidth) {
    const yStart = Math.max(validY, top);
    const yEnd = Math.min(bottom, validY + validHeight);
    if (yStart < yEnd) {
      ctx.moveTo(left, yStart);
      ctx.lineTo(left, yEnd);
    }
  }

  // Правая линия
  if (right >= validX && right <= validX + validWidth) {
    const yStart = Math.max(validY, top);
    const yEnd = Math.min(bottom, validY + validHeight);
    if (yStart < yEnd) {
      ctx.moveTo(right, yStart);
      ctx.lineTo(right, yEnd);
    }
  }

  ctx.stroke();
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
