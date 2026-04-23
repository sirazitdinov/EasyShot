import { wrapTextInRect } from '../utils/canvas.js';

export function drawBlurredLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords, originalImage) {
  const { validX, validY, validWidth, validHeight } = cropCoords;

  const layerX = layerOrigX - validX;
  const layerY = layerOrigY - validY;

  const visibleLeft = Math.max(0, -layerX);
  const visibleTop = Math.max(0, -layerY);
  const visibleRight = Math.min(layerOrigWidth, validWidth - layerX);
  const visibleBottom = Math.min(layerOrigHeight, validHeight - layerY);

  const visibleWidth = visibleRight - visibleLeft;
  const visibleHeight = visibleBottom - visibleTop;

  if (visibleWidth <= 0 || visibleHeight <= 0) return;

  const srcX = layerOrigX + visibleLeft;
  const srcY = layerOrigY + visibleTop;
  const dstX = layerX + visibleLeft;
  const dstY = layerY + visibleTop;

  tempCtx.save();
  tempCtx.filter = `blur(${params.radius}px)`;
  tempCtx.drawImage(
    originalImage,
    srcX, srcY, visibleWidth, visibleHeight,
    dstX, dstY, visibleWidth, visibleHeight
  );
  tempCtx.restore();
}

export function drawHighlightLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords) {
  const { validX, validY, validWidth, validHeight } = cropCoords;

  const layerX = layerOrigX - validX;
  const layerY = layerOrigY - validY;

  const left = layerX;
  const top = layerY;
  const right = layerX + layerOrigWidth;
  const bottom = layerY + layerOrigHeight;

  tempCtx.save();
  tempCtx.strokeStyle = params.color;
  tempCtx.lineWidth = params.thickness || 2;
  tempCtx.beginPath();

  if (top >= 0 && top <= validHeight) {
    const xStart = Math.max(0, left);
    const xEnd = Math.min(right, validWidth);
    if (xStart < xEnd) {
      tempCtx.moveTo(xStart, top);
      tempCtx.lineTo(xEnd, top);
    }
  }

  if (bottom >= 0 && bottom <= validHeight) {
    const xStart = Math.max(0, left);
    const xEnd = Math.min(right, validWidth);
    if (xStart < xEnd) {
      tempCtx.moveTo(xStart, bottom);
      tempCtx.lineTo(xEnd, bottom);
    }
  }

  if (left >= 0 && left <= validWidth) {
    const yStart = Math.max(0, top);
    const yEnd = Math.min(bottom, validHeight);
    if (yStart < yEnd) {
      tempCtx.moveTo(left, yStart);
      tempCtx.lineTo(left, yEnd);
    }
  }

  if (right >= 0 && right <= validWidth) {
    const yStart = Math.max(0, top);
    const yEnd = Math.min(bottom, validHeight);
    if (yStart < yEnd) {
      tempCtx.moveTo(right, yStart);
      tempCtx.lineTo(right, yEnd);
    }
  }

  tempCtx.stroke();
  tempCtx.restore();
}

export function drawRectangleLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords) {
  const { validX, validY, validWidth, validHeight } = cropCoords;

  const layerX = layerOrigX - validX;
  const layerY = layerOrigY - validY;

  const left = layerX;
  const top = layerY;
  const right = layerX + layerOrigWidth;
  const bottom = layerY + layerOrigHeight;

  tempCtx.save();
  tempCtx.strokeStyle = params.color ?? '#ff0000';
  tempCtx.lineWidth = params.thickness ?? 2;
  tempCtx.beginPath();

  if (top >= 0 && top <= validHeight) {
    const xStart = Math.max(0, left);
    const xEnd = Math.min(right, validWidth);
    if (xStart < xEnd) {
      tempCtx.moveTo(xStart, top);
      tempCtx.lineTo(xEnd, top);
    }
  }

  if (bottom >= 0 && bottom <= validHeight) {
    const xStart = Math.max(0, left);
    const xEnd = Math.min(right, validWidth);
    if (xStart < xEnd) {
      tempCtx.moveTo(xStart, bottom);
      tempCtx.lineTo(xEnd, bottom);
    }
  }

  if (left >= 0 && left <= validWidth) {
    const yStart = Math.max(0, top);
    const yEnd = Math.min(bottom, validHeight);
    if (yStart < yEnd) {
      tempCtx.moveTo(left, yStart);
      tempCtx.lineTo(left, yEnd);
    }
  }

  if (right >= 0 && right <= validWidth) {
    const yStart = Math.max(0, top);
    const yEnd = Math.min(bottom, validHeight);
    if (yStart < yEnd) {
      tempCtx.moveTo(right, yStart);
      tempCtx.lineTo(right, yEnd);
    }
  }

  tempCtx.stroke();
  tempCtx.restore();
}

export function drawHighlighterLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords) {
  const { validX, validY, validWidth, validHeight } = cropCoords;

  const layerX = layerOrigX - validX;
  const layerY = layerOrigY - validY;

  const left = layerX;
  const top = layerY;
  const right = layerX + layerOrigWidth;
  const bottom = layerY + layerOrigHeight;

  const clipLeft = Math.max(0, left);
  const clipTop = Math.max(0, top);
  const clipRight = Math.min(validWidth, right);
  const clipBottom = Math.min(validHeight, bottom);

  const clipWidth = clipRight - clipLeft;
  const clipHeight = clipBottom - clipTop;

  if (clipWidth <= 0 || clipHeight <= 0) return;

  tempCtx.save();
  tempCtx.globalAlpha = params.opacity ?? 0.3;
  tempCtx.fillStyle = params.color ?? '#FFA500';
  tempCtx.fillRect(clipLeft, clipTop, clipWidth, clipHeight);
  tempCtx.restore();
}

export function drawTextLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords) {
  const { validX, validY, validWidth, validHeight } = cropCoords;

  if (
    layerOrigX > validX + validWidth ||
    layerOrigY > validY + validHeight ||
    layerOrigX + layerOrigWidth < validX ||
    layerOrigY + layerOrigHeight < validY
  ) {
    return;
  }

  const textX = layerOrigX - validX;
  const textY = layerOrigY - validY;

  tempCtx.save();
  tempCtx.fillStyle = params.color;
  tempCtx.font = `${params.fontSize || 16}px Arial`;
  tempCtx.textAlign = 'left';
  tempCtx.textBaseline = 'top';
  wrapTextInRect(
    tempCtx,
    params.text || 'Текст',
    textX, textY,
    layerOrigWidth, layerOrigHeight,
    params.fontSize || 16
  );
  tempCtx.restore();
}
