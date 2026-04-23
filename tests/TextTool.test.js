// tests/TextTool.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import TextTool from '../editor/Tools/TextTool.js'

function createMockEditor() {
  const canvas = {
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    parentElement: {
      appendChild: vi.fn(),
    }
  }
  return {
    canvas,
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

describe('TextTool', () => {
  let editor
  let textTool
  let mockOverlay

  beforeEach(() => {
    editor = createMockEditor()
    mockOverlay = createMockOverlay()
    document.getElementById = vi.fn(() => ({ value: '#000000', addEventListener: vi.fn() }))
    textTool = new TextTool(editor, { color: '#000000', fontSize: 16 })
  })

  describe('renderLayer', () => {
    it('должен рендерить текст без ошибок', () => {
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 50 })),
      }
      const mockLayer = {
        type: 'text',
        params: { text: 'Hello', color: '#000000', fontSize: 16 },
        rect: { x: 10, y: 10, width: 100, height: 50 }
      }

      expect(() => textTool.renderLayer(ctx, mockLayer)).not.toThrow()
      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })

    it('не должен рендерить если нет rect', () => {
      const ctx = { save: vi.fn(), restore: vi.fn() }
      textTool.renderLayer(ctx, { type: 'text', rect: null })
      expect(ctx.save).not.toHaveBeenCalled()
    })
  })

  describe('hitTest', () => {
    it('должен возвращать true при попадании внутрь rect', () => {
      const mockLayer = {
        type: 'text',
        rect: { x: 10, y: 10, width: 100, height: 50 }
      }
      expect(textTool.hitTest({ x: 50, y: 30 }, mockLayer)).toBe(true)
    })

    it('должен возвращать false если нет rect', () => {
      expect(textTool.hitTest({ x: 50, y: 30 }, { type: 'text', rect: null })).toBe(false)
    })
  })

  describe('getBounds', () => {
    it('должен возвращать bounds для rect', () => {
      const mockLayer = {
        type: 'text',
        rect: { x: 10, y: 10, width: 100, height: 50 }
      }
      expect(textTool.getBounds(mockLayer)).toEqual({ x: 10, y: 10, width: 100, height: 50 })
    })

    it('должен возвращать null если нет rect', () => {
      expect(textTool.getBounds({ type: 'text', rect: null })).toBeNull()
    })
  })
})
