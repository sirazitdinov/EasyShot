// tests/core/EventManager.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventManager from '../../editor/core/EventManager.js';

function createMockEditor(overrides = {}) {
  const canvas = {
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
  };
  const selectionOverlay = {
    className: '',
    style: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return {
    canvas,
    selectionOverlay,
    context: {},
    image: {},
    layerManager: {
      layers: [],
      activeLayer: null,
      activeLayerIndex: -1,
      createLayerObject: vi.fn((type, options) => ({ id: 'layer-test', type, ...options })),
    },
    tools: {},
    activeTool: null,
    historyManager: {
      beginAtomicOperation: vi.fn(),
      endAtomicOperation: vi.fn(),
    },
    HANDLES: ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'],
    CONSTANTS: { LINE_WIDTH: 2 },
    render: vi.fn(),
    updateLayersPanel: vi.fn(),
    resetSelection: vi.fn(),
    deleteActiveLayer: vi.fn(),
    switchToLayerTool: vi.fn(),
    addLayer: vi.fn((layer) => layer),
    handlePaste: vi.fn(),
    canvasManager: {
      updateCanvasDisplay: vi.fn(),
      render: vi.fn(),
    },
    ...overrides,
  };
}

function createMouseEvent(x, y, opts = {}) {
  return {
    clientX: x,
    clientY: y,
    detail: opts.detail ?? 1,
    preventDefault: vi.fn(),
    ...opts,
  };
}

describe('EventManager', () => {
  let editor;
  let em;

  beforeEach(() => {
    editor = createMockEditor();
    em = new EventManager(editor);
  });

  describe('constructor', () => {
    it('должен инициализировать dragState и bound-обработчики', () => {
      expect(em.dragState).toBeNull();
      expect(em.boundMouseMove).toBeInstanceOf(Function);
      expect(em.boundMouseUp).toBeInstanceOf(Function);
      expect(em.boundOverlayMouseDown).toBeInstanceOf(Function);
      expect(em.boundOverlayHover).toBeInstanceOf(Function);
      expect(em.boundKeyDown).toBeInstanceOf(Function);
    });
  });

  describe('init / destroy', () => {
    it('init должен навешивать обработчики', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      em.init();
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', em.boundMouseMove);
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', em.boundMouseUp);
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', em.boundKeyDown);
      expect(addEventListenerSpy).toHaveBeenCalledWith('paste', em.boundPaste);
      addEventListenerSpy.mockRestore();
    });

    it('destroy должен снимать обработчики и сбрасывать состояние', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      em.init();
      em.destroy();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', em.boundMouseMove);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', em.boundMouseUp);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', em.boundKeyDown);
      expect(em.dragState).toBeNull();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('onKeyDown', () => {
    it('Escape должен вызывать resetSelection', () => {
      const e = { key: 'Escape', preventDefault: vi.fn() };
      em.onKeyDown(e);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(editor.resetSelection).toHaveBeenCalled();
    });

    it('Delete должен вызывать deleteActiveLayer при активном слое', () => {
      editor.layerManager.activeLayer = { id: '1' };
      const e = { key: 'Delete', preventDefault: vi.fn() };
      em.onKeyDown(e);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(editor.deleteActiveLayer).toHaveBeenCalled();
    });

    it('Delete не должен ничего делать без активного слоя', () => {
      editor.layerManager.activeLayer = null;
      const e = { key: 'Delete', preventDefault: vi.fn() };
      em.onKeyDown(e);
      expect(editor.deleteActiveLayer).not.toHaveBeenCalled();
    });
  });

  describe('getCanvasCoords', () => {
    it('должен возвращать координаты относительно canvas', () => {
      const event = createMouseEvent(100, 150);
      const coords = em.getCanvasCoords(event);
      expect(coords.x).toBe(100);
      expect(coords.y).toBe(150);
    });

    it('должен защищать от нулевых размеров canvas', () => {
      editor.canvas.clientWidth = 0;
      const event = createMouseEvent(10, 20);
      const coords = em.getCanvasCoords(event);
      expect(coords).toEqual({ x: 0, y: 0 });
    });
  });

  describe('onOverlayMouseDown', () => {
    it('должен создавать слой при активном инструменте с supportsCreation', () => {
      editor.activeTool = { name: 'rectangle', supportsCreation: true };
      editor.tools = { rectangle: { settings: { color: '#ff0000', thickness: 2 } } };
      const e = createMouseEvent(50, 50);
      em.onOverlayMouseDown(e);
      expect(editor.layerManager.createLayerObject).toHaveBeenCalled();
      expect(editor.addLayer).toHaveBeenCalled();
      expect(em.dragState).not.toBeNull();
    });

    it('не должен создавать второй crop-слой', () => {
      editor.activeTool = { name: 'crop', supportsCreation: true };
      editor.layerManager.layers = [{ type: 'crop' }];
      const e = createMouseEvent(50, 50);
      em.onOverlayMouseDown(e);
      expect(editor.layerManager.createLayerObject).not.toHaveBeenCalled();
    });

    it('должен активировать слой при попадании', () => {
      const layer = { type: 'rectangle', rect: { x: 0, y: 0, width: 100, height: 100 }, id: 'l1' };
      editor.layerManager.layers = [layer];
      editor.tools = {
        rectangle: {
          hitTest: vi.fn(() => true),
          renderLayer: vi.fn(),
          getBounds: vi.fn(() => layer.rect),
        }
      };
      const e = createMouseEvent(10, 10);
      em.onOverlayMouseDown(e);
      expect(editor.activeLayer).toBe(layer);
    });

    it('должен начинать resize при попадании в ручку', () => {
      const layer = { type: 'rectangle', rect: { x: 100, y: 100, width: 100, height: 100 }, id: 'l1' };
      editor.layerManager.layers = [layer];
      editor.tools = {
        rectangle: {
          hitTest: vi.fn(() => true),
        }
      };
      // центр ручки se: (200, 200)
      const e = createMouseEvent(200, 200);
      em.onOverlayMouseDown(e);
      expect(em.dragState.handle).toBe('se');
    });

    it('должен начинать move если слой уже активен', () => {
      const layer = { type: 'rectangle', rect: { x: 10, y: 10, width: 50, height: 50 }, id: 'l1' };
      editor.layerManager.layers = [layer];
      editor.tools = {
        rectangle: {
          hitTest: vi.fn(() => true),
        }
      };
      editor.activeLayer = layer;
      const e = createMouseEvent(30, 30);
      em.onOverlayMouseDown(e);
      expect(em.dragState.handle).toBe('move');
    });

    it('должен обрабатывать двойной клик по текстовому слою', () => {
      const layer = { type: 'text', rect: { x: 10, y: 10, width: 50, height: 50 }, id: 'l1', params: {} };
      editor.layerManager.layers = [layer];
      editor.tools = {
        text: {
          hitTest: vi.fn(() => true),
          currentLayer: null,
          editText: vi.fn(),
        }
      };
      const e = createMouseEvent(15, 15, { detail: 2 });
      em.onOverlayMouseDown(e);
      expect(editor.switchToLayerTool).toHaveBeenCalledWith('text');
      expect(editor.tools.text.editText).toHaveBeenCalledWith(layer);
    });

    it('должен делегировать handleMouseDown активному инструменту', () => {
      const handleMouseDown = vi.fn();
      editor.activeTool = { handleMouseDown };
      const e = createMouseEvent(0, 0);
      em.onOverlayMouseDown(e);
      expect(handleMouseDown).toHaveBeenCalledWith(e);
    });
  });

  describe('onMouseMove / _processDragFrame', () => {
    let rafSpy;

    beforeEach(() => {
      rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => cb());
    });

    afterEach(() => {
      rafSpy.mockRestore();
    });

    it('не должен запрашивать RAF без dragState', () => {
      em.onMouseMove(createMouseEvent(10, 10));
      expect(rafSpy).not.toHaveBeenCalled();
    });

    it('должен обновлять rect при create-режиме', () => {
      const layer = { rect: { x: 0, y: 0, width: 0, height: 0 } };
      em.dragState = { start: { x: 10, y: 10 }, layer, handle: 'create', orig: { ...layer.rect } };

      em.onMouseMove(createMouseEvent(110, 90));

      expect(layer.rect.width).toBe(100);
      expect(layer.rect.height).toBe(80);
      expect(editor.render).toHaveBeenCalled();
    });

    it('должен двигать слой при move-режиме', () => {
      const layer = { rect: { x: 10, y: 10, width: 50, height: 50 } };
      em.dragState = { start: { x: 10, y: 10 }, layer, handle: 'move', orig: { ...layer.rect } };

      em.onMouseMove(createMouseEvent(30, 40));

      expect(layer.rect.x).toBe(30);
      expect(layer.rect.y).toBe(40);
    });

    it('должен обновлять точки линии при x1/x2 handle', () => {
      const layer = { points: { x1: 10, y1: 10, x2: 50, y2: 50 } };
      em.dragState = { start: { x: 0, y: 0 }, layer, handle: 'x2', orig: { ...layer.points } };

      em.onMouseMove(createMouseEvent(100, 100));

      expect(layer.points.x2).toBe(100);
      expect(layer.points.y2).toBe(100);
    });
  });

  describe('onMouseUp', () => {
    it('должен завершать atomic operation и сбрасывать dragState', () => {
      em.dragState = { layer: { id: '1' }, handle: 'move' };
      em.onMouseUp(createMouseEvent(0, 0));
      expect(editor.historyManager.endAtomicOperation).toHaveBeenCalled();
      expect(em.dragState).toBeNull();
      expect(editor.render).toHaveBeenCalled();
    });

    it('должен вызывать handleMouseUp у инструмента', () => {
      const handleMouseUp = vi.fn();
      editor.activeTool = { handleMouseUp };
      em.onMouseUp(createMouseEvent(0, 0));
      expect(handleMouseUp).toHaveBeenCalled();
    });
  });

  describe('onOverlayHover', () => {
    it('не должен ничего делать при активном dragState', () => {
      em.dragState = { layer: {} };
      em.onOverlayHover(createMouseEvent(0, 0));
      expect(editor.selectionOverlay.className).toBe('');
    });

    it('должен устанавливать класс resize при наведении на ручку', () => {
      const layer = { type: 'rectangle', rect: { x: 100, y: 100, width: 100, height: 100 } };
      editor.layerManager.layers = [layer];
      // центр ручки se: (200, 200), hitSize=16 -> область 192..208
      em.onOverlayHover(createMouseEvent(200, 200));
      expect(editor.selectionOverlay.className).toBe('resize-se');
    });

    it('должен сбрасывать класс при отсутствии попадания', () => {
      editor.layerManager.layers = [];
      em.onOverlayHover(createMouseEvent(0, 0));
      expect(editor.selectionOverlay.className).toBe('');
    });
  });

  describe('updateRectFromHandle', () => {
    it('должен корректно изменять размеры для se', () => {
      const layer = { rect: { x: 100, y: 100, width: 50, height: 50 } };
      em.dragState = { orig: { ...layer.rect } };
      em.updateRectFromHandle('se', layer, { x: 0, y: 0 }, 20, 30);
      expect(layer.rect.width).toBe(70);
      expect(layer.rect.height).toBe(80);
    });

    it('должен ограничивать минимальный размер', () => {
      const layer = { rect: { x: 100, y: 100, width: 50, height: 50 } };
      em.dragState = { orig: { ...layer.rect } };
      em.updateRectFromHandle('nw', layer, { x: 0, y: 0 }, 1000, 1000);
      expect(layer.rect.width).toBe(10);
      expect(layer.rect.height).toBe(10);
    });
  });
});
