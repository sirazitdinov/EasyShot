import { describe, it, expect, vi } from 'vitest';

// Мокаем зависимости перед импортом
vi.mock('../editor/Tools/CropTool.js', () => ({ default: class {} }));
vi.mock('../editor/Tools/BlurTool.js', () => ({ default: class {} }));
vi.mock('../editor/Tools/HighlightTool.js', () => ({ default: class {} }));
vi.mock('../editor/Tools/LineTool.js', () => ({ default: class {} }));
vi.mock('../editor/Tools/TextTool.js', () => ({ default: class {} }));
vi.mock('../editor/Tools/ToolSettingsUI.js', () => ({ default: class {} }));
vi.mock('../editor/LayerManager.js', () => ({ 
  default: class { 
    init() {}
    setupDragAndDrop() {}
    destroy() {}
  } 
}));
vi.mock('../editor/HistoryManager.js', () => ({ 
  default: class { 
    constructor() {
      this.history = [];
      this.position = -1;
    }
    clear() {}
    commit() {}
    undo() {}
    redo() {}
    canUndo() { return false; }
    canRedo() { return false; }
    beginAtomicOperation() {}
    endAtomicOperation() {}
    destroy() {}
  } 
}));
vi.mock('../editor/Helper.js', () => ({
  default: {
    formatSize: (size) => `${size}px`,
    toCssPixels: (val, canvas) => val / (canvas.width / canvas.clientWidth)
  }
}));

import ImageEditor from '../editor/EditorCore.js';

describe('ImageEditor - Crop Methods', () => {
  let editor;

  beforeEach(() => {
    // Создаем минимальный моковый редактор для тестирования методов
    editor = {
      originalImage: {
        naturalWidth: 800,
        naturalHeight: 600,
        width: 800,
        height: 600
      },
      canvas: {
        width: 800,
        height: 600,
        clientWidth: 800,
        clientHeight: 600
      },
      context: {
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(100) })),
        putImageData: vi.fn(),
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
        arc: vi.fn()
      },
      CONSTANTS: {
        LINE_WIDTH: 2
      },
      wrapTextInRect: vi.fn()
    };

    // Привязываем методы из прототипа
    Object.setPrototypeOf(editor, ImageEditor.prototype);
  });

  describe('_calculateVisibleArea', () => {
    it('должен правильно вычислять видимую область для слоя полностью внутри кропа', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      const result = editor._calculateVisibleArea(120, 120, 50, 50, cropCoords);

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

      const result = editor._calculateVisibleArea(80, 120, 50, 50, cropCoords);

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

      const result = editor._calculateVisibleArea(350, 120, 50, 50, cropCoords);

      expect(result.validWidth - result.validX).toBeLessThanOrEqual(0);
    });
  });

  describe('_drawHighlightLayer', () => {
    it('должен рисовать highlight прямоугольник с правильными координатами', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      editor._drawHighlightLayer(
        editor.context,
        150, // layerOrigX
        150, // layerOrigY
        100, // layerOrigWidth
        100, // layerOrigHeight
        { color: '#ff0000', thickness: 2 },
        cropCoords
      );

      expect(editor.context.strokeRect).toHaveBeenCalledWith(50, 50, 100, 100);
    });

    it('должен рисовать с координатами относительно кропа даже для слоев за пределами', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      editor._drawHighlightLayer(
        editor.context,
        500, // layerOrigX - далеко за пределами
        500, // layerOrigY
        100, // layerOrigWidth
        100, // layerOrigHeight
        { color: '#ff0000', thickness: 2 },
        cropCoords
      );

      // Координаты будут отрицательными относительно кропа: 500 - 100 = 400
      expect(editor.context.strokeRect).toHaveBeenCalledWith(400, 400, 100, 100);
    });
  });

  describe('_drawTextLayer', () => {
    it('должен рисовать текст с правильными координатами', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      editor._drawTextLayer(
        editor.context,
        150, // layerOrigX
        150, // layerOrigY
        100, // layerOrigWidth
        50,  // layerOrigHeight
        { color: '#000000', fontSize: 16, text: 'Test' },
        cropCoords
      );

      expect(editor.wrapTextInRect).toHaveBeenCalled();
    });
  });

  describe('_drawBlurredLayer', () => {
    it('должен рисовать размытую область', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      editor._drawBlurredLayer(
        editor.context,
        150, // layerOrigX
        150, // layerOrigY
        100, // layerOrigWidth
        100, // layerOrigHeight
        { radius: 5 },
        cropCoords
      );

      expect(editor.context.drawImage).toHaveBeenCalled();
    });

    it('не должен рисовать если слой полностью за пределами кропа', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      editor._drawBlurredLayer(
        editor.context,
        500, // layerOrigX - далеко за пределами
        500, // layerOrigY
        100, // layerOrigWidth
        100, // layerOrigHeight
        { radius: 5 },
        cropCoords
      );

      expect(editor.context.drawImage).not.toHaveBeenCalled();
    });
  });

  describe('_applyLineLayerToCroppedCanvas', () => {
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

      editor._applyLineLayerToCroppedCanvas(editor.context, layer, cropCoords);

      expect(editor.context.moveTo).not.toHaveBeenCalled();
      expect(editor.context.lineTo).not.toHaveBeenCalled();
      expect(editor.context.stroke).not.toHaveBeenCalled();
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

      editor._applyLineLayerToCroppedCanvas(editor.context, layer, cropCoords);

      expect(editor.context.moveTo).toHaveBeenCalledWith(50, 50);
    });
  });

  describe('_applyRectLayerToCroppedCanvas', () => {
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

      editor._applyRectLayerToCroppedCanvas(editor.context, layer, cropCoords);

      expect(editor.context.strokeRect).not.toHaveBeenCalled();
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

      editor._applyRectLayerToCroppedCanvas(editor.context, layer, cropCoords);

      expect(editor.context.strokeRect).toHaveBeenCalledWith(50, 50, 100, 100);
    });
  });
});
