// tests/core/SelectionRenderer.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SelectionRenderer from '../../editor/core/SelectionRenderer.js';

function createMockEditor() {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
  };
  return {
    context,
    layerManager: {
      layers: [],
      activeLayer: null,
      activeLayerIndex: -1,
    },
  };
}

describe('SelectionRenderer', () => {
  let editor;
  let renderer;

  beforeEach(() => {
    editor = createMockEditor();
    renderer = new SelectionRenderer(editor);
  });

  describe('renderSelectionHandles', () => {
    it('не должен рендерить без активного слоя', () => {
      editor.layerManager.activeLayer = null;
      renderer.renderSelectionHandles();
      expect(editor.context.save).not.toHaveBeenCalled();
    });

    it('должен рисовать ручки для rect-слоя', () => {
      editor.layerManager.activeLayer = {
        type: 'rectangle',
        rect: { x: 10, y: 20, width: 100, height: 80 },
      };
      renderer.renderSelectionHandles();
      expect(editor.context.save).toHaveBeenCalled();
      expect(editor.context.fillRect).toHaveBeenCalled();
      expect(editor.context.restore).toHaveBeenCalled();
    });

    it('должен рисовать точки для line-слоя', () => {
      editor.layerManager.activeLayer = {
        type: 'line',
        points: { x1: 10, y1: 20, x2: 100, y2: 80 },
      };
      renderer.renderSelectionHandles();
      expect(editor.context.arc).toHaveBeenCalledTimes(2);
      expect(editor.context.fill).toHaveBeenCalledTimes(2);
    });

    it('должен скипать рендер вне dirtyRegion', () => {
      editor.layerManager.activeLayer = {
        type: 'rectangle',
        rect: { x: 500, y: 500, width: 50, height: 50 },
      };
      renderer.renderSelectionHandles({ x: 0, y: 0, width: 100, height: 100 });
      expect(editor.context.save).not.toHaveBeenCalled();
    });
  });

  describe('drawHandles', () => {
    it('не должен падать с null ctx/rect', () => {
      expect(() => renderer.drawHandles(null, null)).not.toThrow();
    });

    it('должен рисовать 8 ручек', () => {
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      renderer.drawHandles(editor.context, rect);
      expect(editor.context.fillRect).toHaveBeenCalledTimes(8);
    });
  });

  describe('drawLinePoints', () => {
    it('не должен падать с null ctx/points', () => {
      expect(() => renderer.drawLinePoints(null, null)).not.toThrow();
    });

    it('должен рисовать 2 точки', () => {
      const points = { x1: 10, y1: 20, x2: 30, y2: 40 };
      renderer.drawLinePoints(editor.context, points);
      expect(editor.context.arc).toHaveBeenCalledTimes(2);
      expect(editor.context.fill).toHaveBeenCalledTimes(2);
    });
  });
});
