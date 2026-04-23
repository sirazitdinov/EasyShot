// tests/BlurTool.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import BlurTool from '../editor/Tools/BlurTool.js'

function createMockEditor() {
  return {
    canvas: { width: 800, height: 600, clientWidth: 800, clientHeight: 600 },
    image: {},
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

describe('BlurTool', () => {
  let editor
  let blurTool
  let mockOverlay

  beforeEach(() => {
    editor = createMockEditor()
    mockOverlay = createMockOverlay()
    blurTool = new BlurTool(editor, { radius: 5 })
  })

  describe('renderLayer', () => {
    it('должен рендерить blur без ошибок', () => {
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        filter: '',
        drawImage: vi.fn(),
      }
      const mockLayer = {
        type: 'blur',
        params: { radius: 5 },
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }

      expect(() => blurTool.renderLayer(ctx, mockLayer)).not.toThrow()
      expect(ctx.save).toHaveBeenCalled()
      expect(ctx.restore).toHaveBeenCalled()
    })

    it('не должен рендерить если нет rect или image', () => {
      const ctx = { save: vi.fn(), restore: vi.fn() }
      blurTool.renderLayer(ctx, { type: 'blur', rect: null })
      expect(ctx.save).not.toHaveBeenCalled()
    })
  })

  describe('hitTest', () => {
    it('должен возвращать true при попадании внутрь rect', () => {
      const mockLayer = {
        type: 'blur',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      expect(blurTool.hitTest({ x: 50, y: 50 }, mockLayer)).toBe(true)
    })

    it('должен возвращать false если нет rect', () => {
      expect(blurTool.hitTest({ x: 50, y: 50 }, { type: 'blur', rect: null })).toBe(false)
    })
  })

  describe('getBounds', () => {
    it('должен возвращать bounds для rect', () => {
      const mockLayer = {
        type: 'blur',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      expect(blurTool.getBounds(mockLayer)).toEqual({ x: 10, y: 10, width: 100, height: 100 })
    })

    it('должен возвращать null если нет rect', () => {
      expect(blurTool.getBounds({ type: 'blur', rect: null })).toBeNull()
    })
  })
})
