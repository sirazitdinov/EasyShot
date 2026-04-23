import {
  drawBlurredLayer,
  drawHighlightLayer,
  drawRectangleLayer,
  drawHighlighterLayer,
  drawTextLayer,
} from './drawers.js';

export function applyLayersToCroppedCanvas(tempCtx, layers, cropCoords, originalImage, wrapTextFn, lineWidth) {
  if (!layers || !Array.isArray(layers)) return;

  layers
    .filter(l => l.type !== 'crop')
    .forEach(layer => {
      if (layer.rect) {
        applyRectLayerToCroppedCanvas(tempCtx, layer, cropCoords, originalImage, wrapTextFn, lineWidth);
      } else if (layer.type === 'line' && layer.points) {
        applyLineLayerToCroppedCanvas(tempCtx, layer, cropCoords);
      }
    });
}

export function applyRectLayerToCroppedCanvas(tempCtx, layer, cropCoords, originalImage, wrapTextFn, lineWidth) {
  const { validX, validY, validWidth, validHeight, currentCanvasScaleX, currentCanvasScaleY } = cropCoords;
  const { rect, params, type } = layer;

  const layerOrigX = Math.round(rect.x / currentCanvasScaleX);
  const layerOrigY = Math.round(rect.y / currentCanvasScaleY);
  const layerOrigWidth = Math.round(rect.width / currentCanvasScaleX);
  const layerOrigHeight = Math.round(rect.height / currentCanvasScaleY);

  const layerX = layerOrigX - validX;
  const layerY = layerOrigY - validY;

  if (
    layerX + layerOrigWidth < 0 ||
    layerY + layerOrigHeight < 0 ||
    layerX > validWidth ||
    layerY > validHeight
  ) {
    return;
  }

  switch (type) {
    case 'blur':
      drawBlurredLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords, originalImage);
      break;
    case 'rectangle':
      drawRectangleLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords);
      break;
    case 'highlight':
      drawHighlightLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords);
      break;
    case 'highlighter':
      drawHighlighterLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords);
      break;
    case 'text':
      drawTextLayer(tempCtx, layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, params, cropCoords);
      break;
  }
}

export function applyLineLayerToCroppedCanvas(tempCtx, layer, cropCoords) {
  const { validX, validY, validWidth, validHeight, currentCanvasScaleX, currentCanvasScaleY } = cropCoords;
  const { points, params } = layer;

  const x1_orig = Math.round(points.x1 / currentCanvasScaleX);
  const y1_orig = Math.round(points.y1 / currentCanvasScaleY);
  const x2_orig = Math.round(points.x2 / currentCanvasScaleX);
  const y2_orig = Math.round(points.y2 / currentCanvasScaleY);

  const x1 = x1_orig - validX;
  const y1 = y1_orig - validY;
  const x2 = x2_orig - validX;
  const y2 = y2_orig - validY;

  if (
    (x1 < 0 && x2 < 0) ||
    (x1 > validWidth && x2 > validWidth) ||
    (y1 < 0 && y2 < 0) ||
    (y1 > validHeight && y2 > validHeight)
  ) {
    return;
  }

  const thickness = params.thickness || 2;
  const color = params.color;

  tempCtx.strokeStyle = color;
  tempCtx.fillStyle = color;
  tempCtx.lineWidth = thickness;
  tempCtx.lineCap = 'round';

  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);

  const arrowLength = 15 + thickness * 0.8;
  const arrowBaseWidth = thickness * 2;

  const lineEndX = x2 - arrowLength * Math.cos(angle);
  const lineEndY = y2 - arrowLength * Math.sin(angle);

  tempCtx.beginPath();
  tempCtx.moveTo(x1, y1);
  tempCtx.lineTo(lineEndX, lineEndY);
  tempCtx.stroke();

  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);

  const tipX = x2;
  const tipY = y2;
  const baseLeftX = lineEndX + perpX * (arrowBaseWidth / 2);
  const baseLeftY = lineEndY + perpY * (arrowBaseWidth / 2);
  const baseRightX = lineEndX - perpX * (arrowBaseWidth / 2);
  const baseRightY = lineEndY - perpY * (arrowBaseWidth / 2);

  tempCtx.beginPath();
  tempCtx.moveTo(tipX, tipY);
  tempCtx.lineTo(baseLeftX, baseLeftY);
  tempCtx.lineTo(baseRightX, baseRightY);
  tempCtx.closePath();
  tempCtx.fill();
}
