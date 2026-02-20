// tests/HighlighterTool.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import HighlighterTool from '../editor/Tools/HighlighterTool.js'
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

describe('HighlighterTool', () => {
  let editor
  let highlighterTool
  let mockOverlay
  let mockOpacityInput
  let mockColorInput
  let mockOpacityValueDisplay
  let mockColorValueDisplay

  beforeEach(() => {
    editor = createMockEditor()
    mockOverlay = createMockOverlay()

    // Создаём моки для отображения значений
    mockOpacityValueDisplay = { textContent: '0.3' }
    mockColorValueDisplay = { textContent: '#FFA500' }

    // Создаём моки для input элементов с правильными parentElement
    mockOpacityValueDisplay.parentElement = {
      querySelector: vi.fn(() => mockOpacityValueDisplay)
    }
    mockColorValueDisplay.parentElement = {
      querySelector: vi.fn(() => mockColorValueDisplay)
    }

    mockOpacityInput = {
      value: '0.3',
      addEventListener: vi.fn(),
      parentElement: mockOpacityValueDisplay.parentElement
    }
    mockColorInput = {
      value: '#FFA500',
      addEventListener: vi.fn(),
      parentElement: mockColorValueDisplay.parentElement
    }

    // Мок для document.getElementById
    document.getElementById = vi.fn((id) => {
      if (id === 'highlighterOpacity') {
        return mockOpacityInput
      }
      if (id === 'highlighterColor') {
        return mockColorInput
      }
      if (id === 'highlighterOpacityLabel') {
        return { value: '0.3' }
      }
      if (id === 'highlighterColorLabel') {
        return { value: '#FFA500' }
      }
      return null
    })

    highlighterTool = new HighlighterTool(editor, {
      color: '#FFA500',
      opacity: 0.3
    })
  })

  describe('constructor', () => {
    it('должен инициализироваться с правильными настройками по умолчанию', () => {
      const tool = new HighlighterTool(editor, {})

      expect(tool.name).toBe('highlighter')
      expect(tool.settings.color).toBe('#FFA500')
      expect(tool.settings.opacity).toBe(0.3)
    })

    it('должен использовать переданные настройки', () => {
      const tool = new HighlighterTool(editor, {
        color: '#00ff00',
        opacity: 0.5
      })

      expect(tool.settings.color).toBe('#00ff00')
      expect(tool.settings.opacity).toBe(0.5)
    })

    it('должен устанавливать supportsCreation', () => {
      expect(highlighterTool.supportsCreation).toBe(true)
    })
  })

  describe('activate', () => {
    it('должен вызывать updateToolbarButtons', () => {
      highlighterTool.activate()

      expect(editor.updateToolbarButtons).toHaveBeenCalled()
    })

    it('должен устанавливать currentLayer если активный слой highlighter', () => {
      const mockHighlighterLayer = {
        type: 'highlighter',
        params: { color: '#00ff00', opacity: 0.5 },
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      editor.getActiveLayer.mockReturnValue(mockHighlighterLayer)

      highlighterTool.activate()

      expect(highlighterTool.currentLayer).toBe(mockHighlighterLayer)
      expect(highlighterTool.settings.color).toBe('#00ff00')
      expect(highlighterTool.settings.opacity).toBe(0.5)
    })

    it('должен устанавливать currentLayer в null если активный слой не highlighter', () => {
      editor.getActiveLayer.mockReturnValue({ type: 'line' })

      highlighterTool.activate()

      expect(highlighterTool.currentLayer).toBe(null)
    })

    it('должен использовать значение по умолчанию если нет активного слоя', () => {
      editor.getActiveLayer.mockReturnValue(null)

      highlighterTool.activate()

      expect(highlighterTool.settings.opacity).toBe(0.3)
      expect(highlighterTool.settings.color).toBe('#FFA500')
    })
  })

  describe('deactivate', () => {
    it('должен вызывать updateToolbarButtons', () => {
      highlighterTool.deactivate()

      expect(editor.updateToolbarButtons).toHaveBeenCalled()
    })
  })

  describe('getUISettingsConfig', () => {
    it('должен возвращать конфигурацию для цвета и прозрачности', () => {
      const config = highlighterTool.getUISettingsConfig()

      expect(config.fields).toHaveLength(2)
      expect(config.fields[0].key).toBe('color')
      expect(config.fields[0].type).toBe('color')
      expect(config.fields[0].value).toBe('#FFA500')
      expect(config.fields[1].key).toBe('opacity')
      expect(config.fields[1].type).toBe('range')
      expect(config.fields[1].min).toBe(0.1)
      expect(config.fields[1].max).toBe(1)
      expect(config.fields[1].step).toBe(0.1)
      expect(config.fields[1].value).toBe(0.3)
    })
  })

  describe('getSettings', () => {
    it('должен возвращать текущие настройки', () => {
      const settings = highlighterTool.getSettings()

      expect(settings).toEqual({
        color: '#FFA500',
        opacity: 0.3
      })
    })
  })

  describe('setupOverlay', () => {
    it('должен добавлять класс highlighter-mode', () => {
      highlighterTool.setupOverlay(mockOverlay)

      expect(mockOverlay.classList.add).toHaveBeenCalledWith('highlighter-mode')
    })

    it('должен устанавливать cursor в crosshair', () => {
      highlighterTool.setupOverlay(mockOverlay)

      expect(mockOverlay.style.cursor).toBe('crosshair')
    })

    it('должен устанавливать border в none', () => {
      highlighterTool.setupOverlay(mockOverlay)

      expect(mockOverlay.style.border).toBe('none')
    })

    it('должен создавать preview элемент', () => {
      highlighterTool.setupOverlay(mockOverlay)

      expect(mockOverlay.appendChild).toHaveBeenCalled()
      expect(highlighterTool.previewElement).toBeDefined()
    })
  })

  describe('updateOverlay', () => {
    beforeEach(() => {
      highlighterTool.setupOverlay(mockOverlay)
    })

    it('должен скрывать preview если нет currentLayer и activeLayer', () => {
      highlighterTool.currentLayer = null
      editor.getActiveLayer.mockReturnValue(null)
      highlighterTool.updateOverlay()

      expect(highlighterTool.previewElement.style.display).toBe('none')
    })

    it('должен скрывать preview если нет rect у слоя', () => {
      highlighterTool.currentLayer = { type: 'highlighter', rect: null }
      editor.getActiveLayer.mockReturnValue(null)
      highlighterTool.updateOverlay()

      expect(highlighterTool.previewElement.style.display).toBe('none')
    })

    it('должен показывать рамку вокруг выделения при наличии currentLayer.rect', () => {
      highlighterTool.currentLayer = {
        type: 'highlighter',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      editor.getActiveLayer.mockReturnValue(null)
      highlighterTool.updateOverlay()

      const preview = highlighterTool.previewElement
      expect(preview.style.display).toBe('block')
      expect(preview.style.position).toBe('absolute')
      expect(preview.style.border).toContain('2px dashed')
      expect(preview.style.border).toContain('#FFA500')
      expect(preview.style.boxSizing).toBe('border-box')
    })

    it('должен использовать activeLayer вместо currentLayer если он highlighter', () => {
      const mockActiveLayer = {
        type: 'highlighter',
        rect: { x: 20, y: 20, width: 200, height: 200 }
      }
      editor.getActiveLayer.mockReturnValue(mockActiveLayer)
      highlighterTool.currentLayer = {
        type: 'highlighter',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }

      highlighterTool.updateOverlay()

      // Должен использовать координаты из activeLayer, а не currentLayer
      const preview = highlighterTool.previewElement
      expect(parseFloat(preview.style.left)).toBeGreaterThan(15)
      expect(parseFloat(preview.style.top)).toBeGreaterThan(15)
    })

    it('должен использовать правильный цвет для рамки', () => {
      highlighterTool.settings.color = '#00ff00'
      highlighterTool.currentLayer = {
        type: 'highlighter',
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      editor.getActiveLayer.mockReturnValue(null)
      highlighterTool.updateOverlay()

      expect(highlighterTool.previewElement.style.border).toContain('#00ff00')
    })
  })

  describe('cleanupOverlay', () => {
    it('должен удалять класс highlighter-mode', () => {
      highlighterTool.setupOverlay(mockOverlay)
      highlighterTool.cleanupOverlay()

      expect(mockOverlay.classList.remove).toHaveBeenCalledWith('highlighter-mode')
    })

    it('должен сбрасывать cursor', () => {
      highlighterTool.setupOverlay(mockOverlay)
      highlighterTool.cleanupOverlay()

      expect(mockOverlay.style.cursor).toBe('')
    })

    it('должен сбрасывать border', () => {
      highlighterTool.setupOverlay(mockOverlay)
      highlighterTool.cleanupOverlay()

      expect(mockOverlay.style.border).toBe('')
    })

    it('должен очищать previewElement', () => {
      highlighterTool.setupOverlay(mockOverlay)
      highlighterTool.cleanupOverlay()

      expect(highlighterTool.previewElement).toBe(null)
    })
  })

  describe('updateSetting', () => {
    beforeEach(() => {
      highlighterTool.setupOverlay(mockOverlay)
    })

    it('должен обновлять цвет в настройках', () => {
      highlighterTool.updateSetting('color', '#00ff00')

      expect(highlighterTool.settings.color).toBe('#00ff00')
    })

    it('должен обновлять прозрачность в настройках', () => {
      highlighterTool.updateSetting('opacity', 0.5)

      expect(highlighterTool.settings.opacity).toBe(0.5)
    })

    it('должен применять цвет к активному слою highlighter', () => {
      const mockLayer = {
        type: 'highlighter',
        params: { color: '#FFA500', opacity: 0.3 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      highlighterTool.updateSetting('color', '#00ff00')

      expect(mockLayer.params.color).toBe('#00ff00')
      expect(editor.render).toHaveBeenCalled()
    })

    it('должен применять прозрачность к активному слою highlighter', () => {
      const mockLayer = {
        type: 'highlighter',
        params: { color: '#FFA500', opacity: 0.3 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      highlighterTool.updateSetting('opacity', 0.7)

      expect(mockLayer.params.opacity).toBe(0.7)
      expect(editor.render).toHaveBeenCalled()
    })

    it('должен вызывать updateOverlay после изменения настройки', () => {
      const spy = vi.spyOn(highlighterTool, 'updateOverlay')
      highlighterTool.updateSetting('color', '#00ff00')

      expect(spy).toHaveBeenCalled()
    })

    it('должен игнорировать неизвестные настройки', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      highlighterTool.updateSetting('unknown', 'value')

      expect(spy).toHaveBeenCalledWith('HighlighterTool.updateSetting unknown setting key', 'unknown')
      spy.mockRestore()
    })
  })

  describe('Изменение прозрачности ползунком', () => {
    let mockOpacityInputElement

    beforeEach(() => {
      highlighterTool.setupOverlay(mockOverlay)
      
      // Создаём мок для input элемента, который будет создан ToolSettingsUI
      mockOpacityInputElement = {
        value: '0.3',
        parentElement: {
          querySelector: vi.fn(() => mockOpacityValueDisplay)
        }
      }
      // Переопределяем getElementById для возврата нашего мока
      document.getElementById = vi.fn((id) => {
        if (id === 'opacity') {
          return mockOpacityInputElement
        }
        if (id === 'color') {
          return mockColorInput
        }
        return null
      })
    })

    it('должен изменять прозрачность от 0.1 до 1 с шагом 0.1', () => {
      // Начальное значение
      expect(highlighterTool.settings.opacity).toBe(0.3)

      // Изменяем на 0.5
      highlighterTool.updateSetting('opacity', 0.5)
      expect(highlighterTool.settings.opacity).toBe(0.5)

      // Изменяем на 0.7
      highlighterTool.updateSetting('opacity', 0.7)
      expect(highlighterTool.settings.opacity).toBe(0.7)

      // Изменяем на 1.0 (максимум)
      highlighterTool.updateSetting('opacity', 1.0)
      expect(highlighterTool.settings.opacity).toBe(1.0)

      // Изменяем на 0.1 (минимум)
      highlighterTool.updateSetting('opacity', 0.1)
      expect(highlighterTool.settings.opacity).toBe(0.1)
    })

    it('должен обновлять значение input элемента при изменении прозрачности', () => {
      highlighterTool.updateSetting('opacity', 0.5)

      expect(mockOpacityInputElement.value).toBe(0.5)
    })

    it('должен обновлять отображение значения (.range-value) при изменении прозрачности', () => {
      highlighterTool.updateSetting('opacity', 0.7)

      expect(mockOpacityValueDisplay.textContent).toBe(0.7)
    })

    it('должен применять прозрачность к активному слою и обновлять render', () => {
      const mockLayer = {
        type: 'highlighter',
        params: { color: '#FFA500', opacity: 0.3 },
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      highlighterTool.updateSetting('opacity', 0.8)

      expect(mockLayer.params.opacity).toBe(0.8)
      expect(editor.render).toHaveBeenCalled()
    })

    it('должен сохранять цвет при изменении прозрачности', () => {
      const originalColor = highlighterTool.settings.color

      highlighterTool.updateSetting('opacity', 0.9)

      expect(highlighterTool.settings.color).toBe(originalColor)
    })

    it('должен позволять устанавливать минимальное значение 0.1', () => {
      highlighterTool.updateSetting('opacity', 0.1)

      expect(highlighterTool.settings.opacity).toBe(0.1)
    })

    it('должен позволять устанавливать максимальное значение 1.0', () => {
      highlighterTool.updateSetting('opacity', 1.0)

      expect(highlighterTool.settings.opacity).toBe(1.0)
    })

    it('должен корректно обрабатывать промежуточные значения', () => {
      const testValues = [0.2, 0.4, 0.5, 0.6, 0.8, 0.9]

      testValues.forEach(value => {
        highlighterTool.updateSetting('opacity', value)
        expect(highlighterTool.settings.opacity).toBe(value)
      })
    })
  })

  describe('Интеграция: изменение прозрачности и цвета', () => {
    it('должен обновлять настройки при последовательном изменении цвета и прозрачности', () => {
      highlighterTool.setupOverlay(mockOverlay)

      // Изменение цвета
      highlighterTool.updateSetting('color', '#00ff00')
      expect(highlighterTool.settings.color).toBe('#00ff00')
      expect(highlighterTool.settings.opacity).toBe(0.3)

      // Изменение прозрачности
      highlighterTool.updateSetting('opacity', 0.7)
      expect(highlighterTool.settings.color).toBe('#00ff00')
      expect(highlighterTool.settings.opacity).toBe(0.7)

      // Снова изменение цвета
      highlighterTool.updateSetting('color', '#ff00ff')
      expect(highlighterTool.settings.color).toBe('#ff00ff')
      expect(highlighterTool.settings.opacity).toBe(0.7)
    })

    it('должен применять оба изменения к активному слою', () => {
      const mockLayer = {
        type: 'highlighter',
        params: { color: '#FFA500', opacity: 0.3 },
        rect: { x: 10, y: 10, width: 100, height: 100 }
      }
      editor.getActiveLayer.mockReturnValue(mockLayer)

      highlighterTool.updateSetting('color', '#00ff00')
      highlighterTool.updateSetting('opacity', 0.8)

      expect(mockLayer.params.color).toBe('#00ff00')
      expect(mockLayer.params.opacity).toBe(0.8)
    })
  })
})
