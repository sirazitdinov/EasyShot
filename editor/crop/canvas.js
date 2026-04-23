/**
 * Создаёт временный canvas и рисует на нём кропнутую область.
 * @param {Object} cropCoords — { validWidth, validHeight }
 * @param {HTMLImageElement} originalImage
 * @returns {{tempCanvas: HTMLCanvasElement, tempCtx: CanvasRenderingContext2D}|null}
 */
export function createCroppedCanvas(cropCoords, originalImage) {
  const { validWidth, validHeight } = cropCoords;

  const tempCanvas = document.createElement('canvas');
  if (!tempCanvas) {
    console.error('Could not create temporary canvas');
    return null;
  }

  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    console.error('Could not get 2D context for temporary canvas');
    return null;
  }

  tempCanvas.width = validWidth;
  tempCanvas.height = validHeight;

  tempCtx.drawImage(
    originalImage,
    cropCoords.validX, cropCoords.validY, validWidth, validHeight,
    0, 0, validWidth, validHeight
  );

  return { tempCanvas, tempCtx };
}
