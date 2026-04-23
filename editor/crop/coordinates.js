/**
 * Валидирует данные для кропа.
 * @param {Object} layerManager — LayerManager
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} selectionOverlay
 * @param {HTMLImageElement} originalImage
 * @returns {{cropLayer: Object}|null}
 */
export function validateCropData(layerManager, canvas, selectionOverlay, originalImage) {
  if (!layerManager || !layerManager.layers) {
    console.error('Layer manager or layers not initialized');
    return null;
  }

  const cropLayer = layerManager.layers.find(l => l.type === 'crop');
  if (!cropLayer || !cropLayer.rect) {
    console.warn('No crop layer found or crop rectangle is invalid');
    return null;
  }

  if (!canvas || !selectionOverlay) {
    console.error('Canvas or selection overlay not found');
    return null;
  }

  if (!originalImage || !originalImage.complete) {
    console.error('Original image not loaded');
    return null;
  }

  const { width, height } = cropLayer.rect;
  if (width <= 0 || height <= 0) {
    console.warn('Invalid crop dimensions');
    return null;
  }

  selectionOverlay.style.width = `${canvas.clientWidth}px`;
  selectionOverlay.style.height = `${canvas.clientHeight}px`;

  return { cropLayer };
}

/**
 * Рассчитывает координаты кропа в пространстве оригинального изображения.
 * @param {Object} cropRect — { x, y, width, height }
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement} originalImage
 * @returns {Object|null}
 */
export function calculateCropCoordinates(cropRect, canvas, originalImage) {
  const { x, y, width, height } = cropRect;

  const currentCanvasScaleX = canvas.width / originalImage.naturalWidth;
  const currentCanvasScaleY = canvas.height / originalImage.naturalHeight;

  if (currentCanvasScaleX <= 0 || currentCanvasScaleY <= 0) {
    console.error('Invalid canvas scale factors');
    return null;
  }

  const origCropX = Math.round(x / currentCanvasScaleX);
  const origCropY = Math.round(y / currentCanvasScaleY);
  const origCropWidth = Math.round(width / currentCanvasScaleX);
  const origCropHeight = Math.round(height / currentCanvasScaleY);

  let validX = Math.max(0, Math.min(origCropX, originalImage.naturalWidth - origCropWidth));
  let validY = Math.max(0, Math.min(origCropY, originalImage.naturalHeight - origCropHeight));
  const validWidth = Math.min(origCropWidth, originalImage.width - validX);
  const validHeight = Math.min(origCropHeight, originalImage.height - validY);

  if (validWidth <= 0 || validHeight <= 0) {
    console.warn('Calculated crop area is invalid');
    return null;
  }

  return {
    validX,
    validY,
    validWidth,
    validHeight,
    currentCanvasScaleX,
    currentCanvasScaleY
  };
}
