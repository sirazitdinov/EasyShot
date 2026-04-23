import { describe, it, expect, vi } from 'vitest';

import {
  drawBlurredLayer,
  drawHighlightLayer,
  drawRectangleLayer,
  drawHighlighterLayer,
  drawTextLayer,
} from '../../editor/crop/drawers.js';

import {
  applyRectLayerToCroppedCanvas,
  applyLineLayerToCroppedCanvas,
} from '../../editor/crop/layerApplier.js';

import { calculateVisibleArea } from '../../editor/utils/geometry.js';

describe('crop / drawers', () => {
  let ctx;
  let originalImage;

  beforeEach(() => {
    originalImage = { /* mock image */ };
    ctx = {
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      strokeStyle: '',
      lineWidth: 1,
      filter: '',
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      globalAlpha: 1,
    };
  });

  describe('calculateVisibleArea', () => {
    it('должен правильно вычислять видимую область для слоя полностью внутри кропа', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      const result = calculateVisibleArea(120, 120, 50, 50, cropCoords);

      expect(result.validX).toBe(20);
      expect(result.validY).toBe(20);
      expect(result.validWidth).toBe(70);
      expect(result.validHeight).toBe(70);
    });

    it('должен правильно вычислять видимую область для слоя частично за пределами кропа слева', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      const result = calculateVisibleArea(80, 120, 50, 50, cropCoords);

      expect(result.validX).toBeGreaterThanOrEqual(0);
      expect(result.validY).toBeGreaterThanOrEqual(0);
    });

    it('должен возвращать отрицательную ширину для слоя полностью за пределами кропа', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      const result = calculateVisibleArea(350, 120, 50, 50, cropCoords);

      expect(result.validWidth - result.validX).toBeLessThanOrEqual(0);
    });
  });

  describe('drawHighlightLayer', () => {
    it('должен рисовать highlight рамку из 4 линий с правильными координатами', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      drawHighlightLayer(
        ctx,
        150, // layerOrigX
        150, // layerOrigY
        100, // layerOrigWidth
        100, // layerOrigHeight
        { color: '#ff0000', thickness: 2 },
        cropCoords
      );

      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('не должен рисовать линии для слоя полностью за пределами кропа', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      drawHighlightLayer(
        ctx,
        500, // layerOrigX - далеко за пределами
        500, // layerOrigY
        100, // layerOrigWidth
        100, // layerOrigHeight
        { color: '#ff0000', thickness: 2 },
        cropCoords
      );

      expect(ctx.moveTo).not.toHaveBeenCalled();
      expect(ctx.lineTo).not.toHaveBeenCalled();
    });
  });

  describe('drawTextLayer', () => {
    it('должен рисовать текст с правильными координатами', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      drawTextLayer(
        ctx,
        150, // layerOrigX
        150, // layerOrigY
        100, // layerOrigWidth
        50,  // layerOrigHeight
        { color: '#000000', fontSize: 16, text: 'Test' },
        cropCoords
      );

      expect(ctx.fillText).toHaveBeenCalled();
    });
  });

  describe('drawBlurredLayer', () => {
    it('должен рисовать размытую область', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      drawBlurredLayer(
        ctx,
        150, // layerOrigX
        150, // layerOrigY
        100, // layerOrigWidth
        100, // layerOrigHeight
        { radius: 5 },
        cropCoords,
        originalImage
      );

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('не должен рисовать если слой полностью за пределами кропа', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      drawBlurredLayer(
        ctx,
        500, // layerOrigX - далеко за пределами
        500, // layerOrigY
        100, // layerOrigWidth
        100, // layerOrigHeight
        { radius: 5 },
        cropCoords,
        originalImage
      );

      expect(ctx.drawImage).not.toHaveBeenCalled();
    });
  });

  describe('applyLineLayerToCroppedCanvas', () => {
    it('не должен рисовать линии полностью за пределами кропа', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200,
        currentCanvasScaleX: 1,
        currentCanvasScaleY: 1
      };

      const layer = {
        points: { x1: 500, y1: 500, x2: 600, y2: 600 },
        params: { color: '#ff0000', thickness: 2 }
      };

      applyLineLayerToCroppedCanvas(ctx, layer, cropCoords);

      expect(ctx.moveTo).not.toHaveBeenCalled();
      expect(ctx.lineTo).not.toHaveBeenCalled();
      expect(ctx.stroke).not.toHaveBeenCalled();
    });

    it('должен рисовать линию внутри кроп-области', () => {
      const cropCoords = {
        validX: 0,
        validY: 0,
        validWidth: 200,
        validHeight: 200,
        currentCanvasScaleX: 1,
        currentCanvasScaleY: 1
      };

      const layer = {
        points: { x1: 50, y1: 50, x2: 150, y2: 150 },
        params: { color: '#ff0000', thickness: 2 }
      };

      applyLineLayerToCroppedCanvas(ctx, layer, cropCoords);

      expect(ctx.moveTo).toHaveBeenCalledWith(50, 50);
    });
  });

  describe('applyRectLayerToCroppedCanvas', () => {
    it('должен пропускать слои полностью за пределами кроп-области', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200,
        currentCanvasScaleX: 1,
        currentCanvasScaleY: 1
      };

      const layer = {
        rect: { x: 500, y: 500, width: 50, height: 50 },
        params: { color: '#ff0000', thickness: 2 },
        type: 'highlight'
      };

      applyRectLayerToCroppedCanvas(ctx, layer, cropCoords, originalImage, vi.fn(), 2);

      expect(ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('должен обрабатывать highlight слой внутри кроп-области', () => {
      const cropCoords = {
        validX: 0,
        validY: 0,
        validWidth: 200,
        validHeight: 200,
        currentCanvasScaleX: 1,
        currentCanvasScaleY: 1
      };

      const layer = {
        rect: { x: 50, y: 50, width: 100, height: 100 },
        params: { color: '#ff0000', thickness: 2 },
        type: 'highlight'
      };

      applyRectLayerToCroppedCanvas(ctx, layer, cropCoords, originalImage, vi.fn(), 2);

      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });
});
