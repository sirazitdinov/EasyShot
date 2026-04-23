// tests/core/CanvasManager.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CanvasManager from '../../editor/core/CanvasManager.js';

function createMockEditor(overrides = {}) {
  const canvas = {
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
  };
  const context = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(800 * 600 * 4) })),
    putImageData: vi.fn(),
    filter: '',
  };
  const layerManager = {
    layers: [],
    activeLayer: null,
    activeLayerIndex: -1,
  };
  const historyManager = {
    clear: vi.fn(),
    commit: vi.fn(),
  };
  const selectionRenderer = {
    renderSelectionHandles: vi.fn(),
  };
  return {
    canvas,
    context,
    layerManager,
    historyManager,
    selectionRenderer,
    image: { tagName: 'IMG' },
    tools: {},
    CONSTANTS: { LINE_WIDTH: 2 },
    ...overrides,
  };
}

describe('CanvasManager', () => {
  let editor;
  let manager;

  beforeEach(() => {
    editor = createMockEditor();
    manager = new CanvasManager(editor);
  });

  describe('setupCanvas', () => {
    it('должен задать начальный размер и залить белым', () => {
      manager.setupCanvas();
      expect(editor.canvas.width).toBe(800);
      expect(editor.canvas.height).toBe(600);
      expect(editor.context.fillStyle).toBe('#fff');
      expect(editor.context.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('должен сбросить историю, если она есть', () => {
      manager.setupCanvas();
      expect(editor.historyManager.clear).toHaveBeenCalled();
      expect(editor.historyManager.commit).toHaveBeenCalledWith('Initial canvas');
    });
  });

  describe('render', () => {
    it('не должен рендерить без image/context/canvas', () => {
      editor.image = null;
      expect(() => manager.render()).not.toThrow();
    });

    it('должен вызывать все под-методы рендера', () => {
      editor.layerManager.layers = [
        { type: 'rectangle', visible: true, rect: { x: 10, y: 10, width: 50, height: 50 }, params: { color: '#ff0000', thickness: 2 } }
      ];
      const tool = {
        renderLayer: vi.fn(),
        getBounds: vi.fn(() => ({ x: 10, y: 10, width: 50, height: 50 })),
      };
      editor.tools = { rectangle: tool };

      manager.render();

      expect(editor.context.clearRect).toHaveBeenCalled();
      expect(editor.context.drawImage).toHaveBeenCalled();
      expect(tool.renderLayer).toHaveBeenCalled();
      expect(editor.selectionRenderer.renderSelectionHandles).toHaveBeenCalled();
    });

    it('должен использовать dirtyRegion при частичном рендере', () => {
      const dirtyRegion = { x: 0, y: 0, width: 100, height: 100 };
      manager.render(dirtyRegion);
      expect(editor.context.save).toHaveBeenCalled();
      expect(editor.context.clip).toHaveBeenCalled();
      expect(editor.context.restore).toHaveBeenCalled();
    });
  });

  describe('renderBaseImage', () => {
    it('должен рисовать изображение на весь canvas', () => {
      manager.renderBaseImage();
      expect(editor.context.drawImage).toHaveBeenCalledWith(
        editor.image, 0, 0, editor.canvas.width, editor.canvas.height
      );
    });

    it('должен рисовать только dirtyRegion, если передан', () => {
      const dirty = { x: 10, y: 20, width: 100, height: 200 };
      manager.renderBaseImage(dirty);
      expect(editor.context.drawImage).toHaveBeenCalledWith(
        editor.image,
        10, 20, 100, 200,
        10, 20, 100, 200
      );
    });
  });

  describe('renderRasterLayers', () => {
    it('должен пропускать crop и base слои', () => {
      editor.layerManager.layers = [
        { type: 'base', visible: true },
        { type: 'crop', visible: true, rect: { x: 0, y: 0, width: 10, height: 10 } },
      ];
      manager.renderRasterLayers();
      expect(editor.context.save).not.toHaveBeenCalled();
    });

    it('должен пропускать невидимые слои', () => {
      editor.layerManager.layers = [
        { type: 'rectangle', visible: false, rect: { x: 0, y: 0, width: 10, height: 10 } }
      ];
      manager.renderRasterLayers();
      expect(editor.context.save).not.toHaveBeenCalled();
    });

    it('должен рендерить слой через инструмент', () => {
      const layer = {
        type: 'rectangle',
        visible: true,
        rect: { x: 10, y: 10, width: 50, height: 50 },
        params: { color: '#ff0000' }
      };
      editor.layerManager.layers = [layer];
      const renderLayer = vi.fn();
      editor.tools = { rectangle: { renderLayer, getBounds: () => ({ x: 10, y: 10, width: 50, height: 50 }) } };

      manager.renderRasterLayers();
      expect(editor.context.save).toHaveBeenCalled();
      expect(renderLayer).toHaveBeenCalledWith(editor.context, layer, expect.any(Object));
      expect(editor.context.restore).toHaveBeenCalled();
    });

    it('должен скипать слой вне dirtyRegion', () => {
      const layer = {
        type: 'rectangle',
        visible: true,
        rect: { x: 500, y: 500, width: 50, height: 50 },
      };
      editor.layerManager.layers = [layer];
      editor.tools = { rectangle: { renderLayer: vi.fn(), getBounds: () => ({ x: 500, y: 500, width: 50, height: 50 }) } };

      manager.renderRasterLayers({ x: 0, y: 0, width: 100, height: 100 });
      expect(editor.tools.rectangle.renderLayer).not.toHaveBeenCalled();
    });
  });

  describe('renderCropOverlay', () => {
    it('не должен рендерить без crop-слоя', () => {
      editor.layerManager.layers = [];
      manager.renderCropOverlay();
      expect(editor.context.fillRect).not.toHaveBeenCalled();
    });

    it('должен рисовать затемнение и рамку', () => {
      editor.layerManager.layers = [
        { type: 'crop', rect: { x: 50, y: 50, width: 200, height: 150 } }
      ];
      manager.renderCropOverlay();
      expect(editor.context.fillRect).toHaveBeenCalledTimes(4);
      expect(editor.context.strokeRect).toHaveBeenCalledWith(50, 50, 200, 150);
      expect(editor.context.fillText).toHaveBeenCalled();
    });
  });
});
