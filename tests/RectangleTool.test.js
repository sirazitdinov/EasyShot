// tests/RectangleTool.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import RectangleTool from '../editor/Tools/RectangleTool.js'

function createMockEditor() {
  return {
    canvas: { width: 800, height: 600, clientWidth: 800, clientHeight: 600 },
    CONSTANTS: { LINE_WIDTH: 2 },
    render: vi.fn(),
    updateToolbarButtons: vi.fn(),
    getActiveLayer: vi.fn(),
  }
}

function createMockOverlay() {
  return {
    classList: { add: vi.fn(), remove: vi.fn() },
    style: {},
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    firstChild: null,
  }
}

describe('RectangleTool', () => {
  let editor
  let rectangleTool
  let mockOverlay

  beforeEach(() => {
    editor = createMockEditor()
    mockOverlay = createMockOverlay()
    rectangleTool = new RectangleTool(editor, { color: '#ff0000', thickness: 2 })
  })

  describe('renderLayer', () => {
    it('должен рендерить rectangle без ошибок', () => {
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        strokeRect: vi.fn(),
      }
      const mockLayer = {
        type: 'rectangle',
        params: { color: '#ff0000', thickness: 2 },
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }

      expect(() => rectangleTool.renderLayer(ctx, mockLayer)).not.toThrow()
      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })

    it('не должен рендерить если нет rect', () => {
      const ctx = { save: vi.fn(), restore: vi.fn() }
      rectangleTool.renderLayer(ctx, { type: 'rectangle', rect: null })
      expect(ctx.save).not.toHaveBeenCalled()
    })
  })

  describe('hitTest', () => {
    it('должен возвращать true при попадании внутрь rect', () => {
      const mockLayer = {
        type: 'rectangle',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      expect(rectangleTool.hitTest({ x: 50, y: 50 }, mockLayer)).toBe(true)
    })

    it('должен возвращать false если нет rect', () => {
      expect(rectangleTool.hitTest({ x: 50, y: 50 }, { type: 'rectangle', rect: null })).toBe(false)
    })
  })

  describe('getBounds', () => {
    it('должен возвращать bounds для rect', () => {
      const mockLayer = {
        type: 'rectangle',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      expect(rectangleTool.getBounds(mockLayer)).toEqual({ x: 10, y: 10, width: 100, height: 100 })
    })

    it('должен возвращать null если нет rect', () => {
      expect(rectangleTool.getBounds({ type: 'rectangle', rect: null })).toBeNull()
    })
  })
})
