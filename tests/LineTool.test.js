// tests/LineTool.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import LineTool from '../editor/Tools/LineTool.js'

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

describe('LineTool', () => {
  let editor
  let lineTool
  let mockOverlay

  beforeEach(() => {
    editor = createMockEditor()
    mockOverlay = createMockOverlay()

    // Мок для document.getElementById
    document.getElementById = vi.fn((id) => {
      if (id === 'highlightColor') {
        return createMockColorInput('#ff0000')
      }
      return null
    })

    lineTool = new LineTool(editor, {
      color: '#ff0000',
      thickness: 2
    })
  })

  describe('constructor', () => {
    it('должен инициализироваться с правильными настройками по умолчанию', () => {
      const tool = new LineTool(editor, {})

      expect(tool.name).toBe('line')
      expect(tool.settings.color).toBe('#ff0000')
      expect(tool.settings.thickness).toBe(2)
      expect(tool.supportsCreation).toBe(true)
    })

    it('должен использовать переданные настройки', () => {
      const tool = new LineTool(editor, {
        color: '#00ff00',
        thickness: 5
      })

      expect(tool.settings.color).toBe('#00ff00')
      expect(tool.settings.thickness).toBe(5)
    })
  })

  describe('activate', () => {
    it('должен вызывать updateToolbarButtons', () => {
      lineTool.activate()

      expect(editor.updateToolbarButtons).toHaveBeenCalled()
    })

    it('должен устанавливать currentLayer если активный слой line', () => {
      const mockLineLayer = {
        type: 'line',
        params: { color: '#00ff00', thickness: 3 },
        points: { x1: 10, y1: 10, x2: 100, y2: 100 }
      }
      editor.getActiveLayer.mockReturnValue(mockLineLayer)

      lineTool.activate()

      expect(lineTool.currentLayer).toBe(mockLineLayer)
      expect(lineTool.settings.color).toBe('#00ff00')
      expect(lineTool.settings.thickness).toBe(3)
    })

    it('должен устанавливать currentLayer в null если активный слой не line', () => {
      editor.getActiveLayer.mockReturnValue({ type: 'highlight' })

      lineTool.activate()

      expect(lineTool.currentLayer).toBe(null)
    })
  })

  describe('deactivate', () => {
    it('должен вызывать updateToolbarButtons', () => {
      lineTool.deactivate()

      expect(editor.updateToolbarButtons).toHaveBeenCalled()
    })
  })

  describe('getUISettingsConfig', () => {
    it('должен возвращать конфигурацию для цвета и толщины', () => {
      const config = lineTool.getUISettingsConfig()

      expect(config.fields).toHaveLength(2)
      expect(config.fields[0].key).toBe('color')
      expect(config.fields[0].type).toBe('color')
      expect(config.fields[0].value).toBe('#ff0000')
      expect(config.fields[1].key).toBe('thickness')
      expect(config.fields[1].type).toBe('range')
      expect(config.fields[1].value).toBe(2)
    })
  })

  describe('setupOverlay', () => {
    it('должен добавлять класс line-mode', () => {
      lineTool.setupOverlay(mockOverlay)

      expect(mockOverlay.classList.add).toHaveBeenCalledWith('line-mode')
    })

    it('должен устанавливать cursor в crosshair', () => {
      lineTool.setupOverlay(mockOverlay)

      expect(mockOverlay.style.cursor).toBe('crosshair')
    })

    it('не должен создавать preview элемент (не используется)', () => {
      lineTool.setupOverlay(mockOverlay)

      // Preview больше не создается
      expect(lineTool.previewElement).toBeNull()
    })
  })

  describe('updateOverlay', () => {
    it('должен быть пустым методом (preview не используется)', () => {
      // Метод существует но ничего не делает
      expect(() => lineTool.updateOverlay()).not.toThrow()
    })
  })

  describe('cleanupOverlay', () => {
    it('должен удалять класс line-mode', () => {
      lineTool.setupOverlay(mockOverlay)
      lineTool.cleanupOverlay()

      expect(mockOverlay.classList.remove).toHaveBeenCalledWith('line-mode')
    })

    it('должен сбрасывать cursor', () => {
      lineTool.setupOverlay(mockOverlay)
      lineTool.cleanupOverlay()

      expect(mockOverlay.style.cursor).toBe('')
    })

    it('должен сбрасывать border', () => {
      lineTool.setupOverlay(mockOverlay)
      lineTool.cleanupOverlay()

      expect(mockOverlay.style.border).toBe('')
    })
  })

  describe('updateSetting', () => {
    it('должен обновлять цвет в настройках', () => {
      lineTool.updateSetting('color', '#00ff00')

      expect(lineTool.settings.color).toBe('#00ff00')
    })

    it('должен обновлять толщину в настройках', () => {
      lineTool.updateSetting('thickness', 5)

      expect(lineTool.settings.thickness).toBe(5)
    })

    it('должен применять цвет к активному слою line', () => {
      const mockLayer = {
        type: 'line',
        params: { color: '#ff0000', thickness: 2 },
        points: { x1: 10, y1: 10, x2: 100, y2: 100 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      lineTool.updateSetting('color', '#00ff00')

      expect(mockLayer.params.color).toBe('#00ff00')
      expect(editor.render).toHaveBeenCalled()
    })

    it('должен применять толщину к активному слою line', () => {
      const mockLayer = {
        type: 'line',
        params: { color: '#ff0000', thickness: 2 },
        points: { x1: 10, y1: 10, x2: 100, y2: 100 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      lineTool.updateSetting('thickness', 5)

      expect(mockLayer.params.thickness).toBe(5)
      expect(editor.render).toHaveBeenCalled()
    })

    it('должен игнорировать неизвестные настройки', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      lineTool.updateSetting('unknown', 'value')

      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  describe('Интеграция: изменение цвета и толщины линии', () => {
    it('должен обновлять цвет линии на канвасе при изменении настройки цвета', () => {
      const mockLayer = {
        type: 'line',
        params: { color: '#ff0000', thickness: 2 },
        points: { x1: 10, y1: 10, x2: 100, y2: 100 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      lineTool.updateSetting('color', '#00ff00')
      expect(lineTool.settings.color).toBe('#00ff00')
      expect(mockLayer.params.color).toBe('#00ff00')
    })

    it('должен обновлять толщину линии на канвасе при изменении настройки толщины', () => {
      const mockLayer = {
        type: 'line',
        params: { color: '#ff0000', thickness: 2 },
        points: { x1: 10, y1: 10, x2: 100, y2: 100 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      lineTool.updateSetting('thickness', 5)
      expect(lineTool.settings.thickness).toBe(5)
      expect(mockLayer.params.thickness).toBe(5)
    })
  })
})
