/**
 * Вычисляет расстояние от точки до отрезка.
 * @param {number} px - X координата точки
 * @param {number} py - Y координата точки
 * @param {number} x1 - X координата начала отрезка
 * @param {number} y1 - Y координата начала отрезка
 * @param {number} x2 - X координата конца отрезка
 * @param {number} y2 - Y координата конца отрезка
 * @returns {number} - Расстояние от точки до отрезка
 */
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Вычисляет видимую область слоя внутри кроп-области.
 * @param {number} layerOrigX - X координата слоя
 * @param {number} layerOrigY - Y координата слоя
 * @param {number} layerOrigWidth - Ширина слоя
 * @param {number} layerOrigHeight - Высота слоя
 * @param {Object} cropCoords - Координаты кропа { validX, validY, validWidth, validHeight }
 * @returns {Object} { validX, validY, validWidth, validHeight }
 */
export function calculateVisibleArea(layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, cropCoords) {
  const cropLeft = 0;
  const cropTop = 0;
  const cropRight = cropCoords.validWidth;
  const cropBottom = cropCoords.validHeight;

  const shiftedX = layerOrigX - cropCoords.validX;
  const shiftedY = layerOrigY - cropCoords.validY;
  const shiftedR = shiftedX + layerOrigWidth;
  const shiftedB = shiftedY + layerOrigHeight;

  const visibleLeft = Math.max(cropLeft, shiftedX);
  const visibleTop = Math.max(cropTop, shiftedY);
  const visibleRight = Math.min(cropRight, shiftedR);
  const visibleBottom = Math.min(cropBottom, shiftedB);

  return {
    validX: visibleLeft,
    validY: visibleTop,
    validWidth: visibleRight,
    validHeight: visibleBottom
  };
}
