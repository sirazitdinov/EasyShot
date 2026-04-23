/**
 * Пересчитывает координаты слоёв после кропа и удаляет crop-слой.
 * @param {Object} layerManager
 * @param {Object} cropCoords
 * @param {Object} cropLayer
 * @param {CanvasRenderingContext2D} context
 */
export function updateLayersAfterCrop(layerManager, cropCoords, cropLayer, context) {
  if (!layerManager.layers || !Array.isArray(layerManager.layers)) return;

  layerManager.layers = layerManager.layers.filter(l => l.type === 'base' || l.id === cropLayer.id);

  if (layerManager.layers.length > 0 && layerManager.layers[0].type === 'base') {
    const baseLayer = layerManager.layers[0];
    baseLayer.imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
  }

  const cropIndex = layerManager.layers.findIndex(l => l.id === cropLayer.id);
  if (cropIndex !== -1) {
    layerManager.layers.splice(cropIndex, 1);
  }

  layerManager.activeLayerIndex = -1;
}

/**
 * Обновляет координаты прямоугольного слоя после кропа.
 */
export function updateRectLayerCoordinates(layer, cropRect, currentCanvasScaleX, currentCanvasScaleY, canvas, originalImage) {
  const newCanvasScaleX = canvas.width / originalImage.width;
  const newCanvasScaleY = canvas.height / originalImage.height;

  if (newCanvasScaleX <= 0 || newCanvasScaleY <= 0) {
    console.error('Invalid new canvas scale factors');
    return;
  }

  layer.rect.x = Math.round((Math.round(layer.rect.x / currentCanvasScaleX) - cropRect.x) * newCanvasScaleX);
  layer.rect.y = Math.round((Math.round(layer.rect.y / currentCanvasScaleY) - cropRect.y) * newCanvasScaleY);
  layer.rect.width = Math.round(layer.rect.width / currentCanvasScaleX * newCanvasScaleX);
  layer.rect.height = Math.round(layer.rect.height / currentCanvasScaleY * newCanvasScaleY);

  if (layer.rect.x < 0) {
    layer.rect.width += layer.rect.x;
    layer.rect.x = 0;
  }
  if (layer.rect.y < 0) {
    layer.rect.height += layer.rect.y;
    layer.rect.y = 0;
  }
  if (layer.rect.x + layer.rect.width > canvas.width) {
    layer.rect.width = canvas.width - layer.rect.x;
  }
  if (layer.rect.y + layer.rect.height > canvas.height) {
    layer.rect.height = canvas.height - layer.rect.y;
  }
}

/**
 * Обновляет координаты линии после кропа.
 */
export function updateLineLayerCoordinates(layer, cropRect, currentCanvasScaleX, currentCanvasScaleY, canvas, originalImage) {
  const newCanvasScaleX = canvas.width / originalImage.width;
  const newCanvasScaleY = canvas.height / originalImage.height;

  if (newCanvasScaleX <= 0 || newCanvasScaleY <= 0) {
    console.error('Invalid new canvas scale factors for points');
    return;
  }

  layer.points.x1 = Math.round((Math.round(layer.points.x1 / currentCanvasScaleX) - cropRect.x) * newCanvasScaleX);
  layer.points.y1 = Math.round((Math.round(layer.points.y1 / currentCanvasScaleY) - cropRect.y) * newCanvasScaleY);
  layer.points.x2 = Math.round((Math.round(layer.points.x2 / currentCanvasScaleX) - cropRect.x) * newCanvasScaleX);
  layer.points.y2 = Math.round((Math.round(layer.points.y2 / currentCanvasScaleY) - cropRect.y) * newCanvasScaleY);

  layer.points.x1 = Math.max(0, Math.min(canvas.width, layer.points.x1));
  layer.points.y1 = Math.max(0, Math.min(canvas.height, layer.points.y1));
  layer.points.x2 = Math.max(0, Math.min(canvas.width, layer.points.x2));
  layer.points.y2 = Math.max(0, Math.min(canvas.height, layer.points.y2));
}
