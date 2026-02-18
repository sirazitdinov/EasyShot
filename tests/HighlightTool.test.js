// tests/HighlightTool.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import HighlightTool from '../editor/Tools/HighlightTool.js'
import Helper from '../editor/Helper.js'

// Мок для EditorCore
function createMockEditor() {
  const canvas = {
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600
  }

  const context = {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn()
  }

  const render = vi.fn()
  const updateToolbarButtons = vi.fn()
  const getActiveLayer = vi.fn()

  return {
    canvas,
    context,
    render,
    updateToolbarButtons,
    getActiveLayer,
    activeTool: null
  }
}

// Мок для DOM элементов overlay
function createMockOverlay() {
  return {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      contains: vi.fn()
    },
    style: {
      cursor: '',
      border: '',
      backgroundColor: '',
      pointerEvents: '',
      display: '',
      position: '',
      left: '',
      top: '',
      width: '',
      height: '',
      boxSizing: '',
      cssText: ''
    },
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    firstChild: null,
    querySelector: vi.fn()
  }
}

// Мок для DOM элемента input
function createMockColorInput(value = '#ff0000') {
  return {
    value,
    addEventListener: vi.fn()
  }
}

describe('HighlightTool', () => {
  let editor
  let highlightTool
  let mockOverlay

  beforeEach(() => {
    editor = createMockEditor()
    mockOverlay = createMockOverlay()

    // Мок для document.getElementById
    document.getElementById = vi.fn((id) => {
      if (id === 'highlightColor') {
        return createMockColorInput('#ff0000')
      }
      if (id === 'highlightColorLabel') {
        return { value: '#ff0000' }
      }
      return null
    })

    highlightTool = new HighlightTool(editor, {
      color: '#ff0000',
      thickness: 2
    })
  })

  describe('constructor', () => {
    it('должен инициализироваться с правильными настройками по умолчанию', () => {
      const tool = new HighlightTool(editor, {})

      expect(tool.name).toBe('highlight')
      expect(tool.settings.color).toBe('#ff0000')
      expect(tool.settings.thickness).toBe(2)
    })

    it('должен использовать переданные настройки', () => {
      const tool = new HighlightTool(editor, {
        color: '#00ff00',
        thickness: 5
      })

      expect(tool.settings.color).toBe('#00ff00')
      expect(tool.settings.thickness).toBe(5)
    })

    it('должен устанавливать supportsCreation', () => {
      expect(highlightTool.supportsCreation).toBe(true)
    })
  })

  describe('activate', () => {
    it('должен вызывать updateToolbarButtons', () => {
      highlightTool.activate()

      expect(editor.updateToolbarButtons).toHaveBeenCalled()
    })

    it('должен устанавливать currentLayer если активный слой highlight', () => {
      const mockHighlightLayer = {
        type: 'highlight',
        params: { color: '#00ff00', thickness: 3 },
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      editor.getActiveLayer.mockReturnValue(mockHighlightLayer)

      highlightTool.activate()

      expect(highlightTool.currentLayer).toBe(mockHighlightLayer)
      expect(highlightTool.settings.color).toBe('#00ff00')
      expect(highlightTool.settings.thickness).toBe(3)
    })

    it('должен устанавливать currentLayer в null если активный слой не highlight', () => {
      editor.getActiveLayer.mockReturnValue({ type: 'line' })

      highlightTool.activate()

      expect(highlightTool.currentLayer).toBe(null)
    })
  })

  describe('deactivate', () => {
    it('должен вызывать updateToolbarButtons', () => {
      highlightTool.deactivate()

      expect(editor.updateToolbarButtons).toHaveBeenCalled()
    })
  })

  describe('getUISettingsConfig', () => {
    it('должен возвращать конфигурацию для цвета и толщины', () => {
      const config = highlightTool.getUISettingsConfig()

      expect(config.fields).toHaveLength(2)
      expect(config.fields[0].key).toBe('color')
      expect(config.fields[0].type).toBe('color')
      expect(config.fields[0].value).toBe('#ff0000')
      expect(config.fields[1].key).toBe('thickness')
      expect(config.fields[1].type).toBe('range')
      expect(config.fields[1].value).toBe(2)
    })
  })

  describe('getSettings', () => {
    it('должен возвращать текущие настройки', () => {
      const settings = highlightTool.getSettings()

      expect(settings).toEqual({
        color: '#ff0000',
        thickness: 2
      })
    })
  })

  describe('setupOverlay', () => {
    it('должен добавлять класс highlight-mode', () => {
      highlightTool.setupOverlay(mockOverlay)

      expect(mockOverlay.classList.add).toHaveBeenCalledWith('highlight-mode')
    })

    it('должен устанавливать cursor в crosshair', () => {
      highlightTool.setupOverlay(mockOverlay)

      expect(mockOverlay.style.cursor).toBe('crosshair')
    })

    it('должен устанавливать border в none', () => {
      highlightTool.setupOverlay(mockOverlay)

      expect(mockOverlay.style.border).toBe('none')
    })

    it('должен создавать preview элемент', () => {
      highlightTool.setupOverlay(mockOverlay)

      expect(mockOverlay.appendChild).toHaveBeenCalled()
      expect(highlightTool.previewElement).toBeDefined()
    })
  })

  describe('updateOverlay', () => {
    beforeEach(() => {
      highlightTool.setupOverlay(mockOverlay)
    })

    it('должен скрывать preview если нет currentLayer и activeLayer', () => {
      highlightTool.currentLayer = null
      editor.getActiveLayer.mockReturnValue(null)
      highlightTool.updateOverlay()

      expect(highlightTool.previewElement.style.display).toBe('none')
    })

    it('должен скрывать preview если нет rect у слоя', () => {
      highlightTool.currentLayer = { type: 'highlight', rect: null }
      editor.getActiveLayer.mockReturnValue(null)
      highlightTool.updateOverlay()

      expect(highlightTool.previewElement.style.display).toBe('none')
    })

    it('должен показывать рамку вокруг выделения при наличии currentLayer.rect', () => {
      highlightTool.currentLayer = {
        type: 'highlight',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      editor.getActiveLayer.mockReturnValue(null)
      highlightTool.updateOverlay()

      const preview = highlightTool.previewElement
      expect(preview.style.display).toBe('block')
      expect(preview.style.position).toBe('absolute')
      expect(preview.style.border).toContain('2px dashed')
      expect(preview.style.border).toContain('#ff0000')
      expect(preview.style.boxSizing).toBe('border-box')
    })

    it('должен использовать activeLayer вместо currentLayer если он highlight', () => {
      const mockActiveLayer = {
        type: 'highlight',
        rect: { x: 20, y: 20, width: 200, height: 200 }
      }
      editor.getActiveLayer.mockReturnValue(mockActiveLayer)
      highlightTool.currentLayer = {
        type: 'highlight',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }

      highlightTool.updateOverlay()

      // Должен использовать координаты из activeLayer, а не currentLayer
      const preview = highlightTool.previewElement
      expect(parseFloat(preview.style.left)).toBeGreaterThan(15)
      expect(parseFloat(preview.style.top)).toBeGreaterThan(15)
    })

    it('должен использовать правильный цвет для рамки', () => {
      highlightTool.settings.color = '#00ff00'
      highlightTool.currentLayer = {
        type: 'highlight',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      editor.getActiveLayer.mockReturnValue(null)
      highlightTool.updateOverlay()

      expect(highlightTool.previewElement.style.border).toContain('#00ff00')
    })

    it('должен правильно рассчитывать позицию с учетом масштаба', () => {
      editor.canvas.width = 800
      editor.canvas.height = 600
      editor.canvas.clientWidth = 400
      editor.canvas.clientHeight = 300

      highlightTool.currentLayer = {
        type: 'highlight',
        rect: { x: 0, y: 0, width: 800, height: 600 }
      }
      editor.getActiveLayer.mockReturnValue(null)
      highlightTool.updateOverlay()

      const preview = highlightTool.previewElement
      // При DPR=1 и canvas 800x600 -> client 400x300, масштаб = 0.5
      expect(parseFloat(preview.style.left)).toBeCloseTo(0, 0)
      expect(parseFloat(preview.style.top)).toBeCloseTo(0, 0)
      expect(parseFloat(preview.style.width)).toBeLessThanOrEqual(400)
      expect(parseFloat(preview.style.height)).toBeLessThanOrEqual(300)
    })
  })

  describe('cleanupOverlay', () => {
    it('должен удалять класс highlight-mode', () => {
      highlightTool.setupOverlay(mockOverlay)
      highlightTool.cleanupOverlay()

      expect(mockOverlay.classList.remove).toHaveBeenCalledWith('highlight-mode')
    })

    it('должен сбрасывать cursor', () => {
      highlightTool.setupOverlay(mockOverlay)
      highlightTool.cleanupOverlay()

      expect(mockOverlay.style.cursor).toBe('')
    })

    it('должен сбрасывать border', () => {
      highlightTool.setupOverlay(mockOverlay)
      highlightTool.cleanupOverlay()

      expect(mockOverlay.style.border).toBe('')
    })

    it('должен очищать previewElement', () => {
      highlightTool.setupOverlay(mockOverlay)
      highlightTool.cleanupOverlay()

      expect(highlightTool.previewElement).toBe(null)
    })
  })

  describe('updateSetting', () => {
    beforeEach(() => {
      highlightTool.setupOverlay(mockOverlay)
    })

    it('должен обновлять цвет в настройках', () => {
      highlightTool.updateSetting('color', '#00ff00')

      expect(highlightTool.settings.color).toBe('#00ff00')
    })

    it('должен обновлять толщину в настройках', () => {
      highlightTool.updateSetting('thickness', 5)

      expect(highlightTool.settings.thickness).toBe(5)
    })

    it('должен применять цвет к активному слою highlight', () => {
      const mockLayer = {
        type: 'highlight',
        params: { color: '#ff0000', thickness: 2 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      highlightTool.updateSetting('color', '#00ff00')

      expect(mockLayer.params.color).toBe('#00ff00')
      expect(editor.render).toHaveBeenCalled()
    })

    it('должен применять толщину к активному слою highlight', () => {
      const mockLayer = {
        type: 'highlight',
        params: { color: '#ff0000', thickness: 2 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      highlightTool.updateSetting('thickness', 5)

      expect(mockLayer.params.thickness).toBe(5)
      expect(editor.render).toHaveBeenCalled()
    })

    it('должен вызывать updateOverlay после изменения настройки', () => {
      const spy = vi.spyOn(highlightTool, 'updateOverlay')
      highlightTool.updateSetting('color', '#00ff00')

      expect(spy).toHaveBeenCalled()
    })

    it('должен игнорировать неизвестные настройки', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      highlightTool.updateSetting('unknown', 'value')

      expect(spy).toHaveBeenCalledWith('HighlightTool.updateSetting unknown setting key', 'unknown')
      spy.mockRestore()
    })
  })

  describe('Интеграция: изменение цвета рамки', () => {
    it('должен обновлять цвет рамки при изменении настройки цвета', () => {
      highlightTool.setupOverlay(mockOverlay)
      highlightTool.currentLayer = {
        type: 'highlight',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }

      // Изначальный цвет
      highlightTool.updateOverlay()
      expect(highlightTool.previewElement.style.border).toContain('#ff0000')

      // Изменение цвета
      highlightTool.updateSetting('color', '#00ff00')
      expect(highlightTool.settings.color).toBe('#00ff00')
      expect(highlightTool.previewElement.style.border).toContain('#00ff00')
    })

    it('не должен создавать новую рамку при изменении цвета', () => {
      highlightTool.setupOverlay(mockOverlay)
      const originalPreviewElement = highlightTool.previewElement

      highlightTool.currentLayer = {
        type: 'highlight',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      highlightTool.updateSetting('color', '#00ff00')

      // Тот же самый элемент, не новый
      expect(highlightTool.previewElement).toBe(originalPreviewElement)
    })
  })
})
