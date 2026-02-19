// tests/LayerManager.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import LayerManager from '../editor/LayerManager.js'

// Мок для EditorCore
function createMockEditor() {
  const canvas = {
    width: 100,
    height: 100
  }
  
  const context = {
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(100 * 100 * 4)
    })),
    putImageData: vi.fn(),
    clearRect: vi.fn()
  }
  
  const render = vi.fn()
  
  return {
    canvas,
    context,
    render,
    activeTool: null
  }
}

// Мок для DOM элементов
function createMockLayersList() {
  return {
    innerHTML: '',
    addEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    removeChild: vi.fn(),
    appendChild: vi.fn(),
    createElement: vi.fn(() => ({
      className: '',
      dataset: {},
      draggable: false,
      innerHTML: '',
      classList: {
        toggle: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn()
      },
      style: {}
    })),
    getBoundingClientRect: vi.fn(() => ({ top: 0, height: 20 }))
  }
}

describe('LayerManager', () => {
  let editor
  let layerManager
  let mockLayersList

  beforeEach(() => {
    mockLayersList = createMockLayersList()
    document.getElementById = vi.fn(() => mockLayersList)
    
    editor = createMockEditor()
    layerManager = new LayerManager(editor)
  })

  describe('constructor', () => {
    it('должен инициализироваться с пустыми слоями', () => {
      expect(layerManager.layers).toEqual([])
      expect(layerManager.activeLayerIndex).toBe(-1)
      expect(layerManager.dragState).toBe(null)
    })
  })

  describe('init', () => {
    it('должен создавать базовый слой', () => {
      layerManager.init()
      
      expect(layerManager.layers.length).toBe(1)
      expect(layerManager.layers[0].type).toBe('base')
      expect(layerManager.activeLayerIndex).toBe(0)
    })

    it('должен вызывать updateLayersPanel', () => {
      const spy = vi.spyOn(layerManager, 'updateLayersPanel')
      layerManager.init()
      
      expect(spy).toHaveBeenCalled()
    })
  })

  describe('createLayerObject', () => {
    it('должен создавать слой с default параметрами', () => {
      const layer = layerManager.createLayerObject('highlight')
      
      expect(layer.type).toBe('highlight')
      expect(layer.visible).toBe(true)
      expect(layer.params.color).toBe('#ff0000')
      expect(layer.params.thickness).toBe(2)
    })

    it('должен создавать crop слой', () => {
      const layer = layerManager.createLayerObject('crop')
      
      expect(layer.type).toBe('crop')
      expect(layer.rect).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    })

    it('должен создавать blur слой с radius', () => {
      const layer = layerManager.createLayerObject('blur', { params: { radius: 10 } })
      
      expect(layer.type).toBe('blur')
      expect(layer.params.radius).toBe(10)
    })

    it('должен создавать line слой с points', () => {
      const layer = layerManager.createLayerObject('line', {
        points: { x1: 10, y1: 10, x2: 50, y2: 50 }
      })
      
      expect(layer.type).toBe('line')
      expect(layer.points).toEqual({ x1: 10, y1: 10, x2: 50, y2: 50 })
      expect(layer.params.color).toBe('#ff0000')
    })

    it('должен создавать text слой с default размерами', () => {
      const layer = layerManager.createLayerObject('text')
      
      expect(layer.type).toBe('text')
      expect(layer.rect).toEqual({ x: 0, y: 0, width: 200, height: 50 })
      expect(layer.params.fontSize).toBe(16)
    })

    it('должен использовать переданный id', () => {
      const layer = layerManager.createLayerObject('base', { id: 'custom-id' })
      
      expect(layer.id).toBe('custom-id')
    })

    it('должен генерировать id если не передан', () => {
      const layer = layerManager.createLayerObject('base')
      
      expect(layer.id).toMatch(/^layer-\d+$/)
    })
  })

  describe('activeLayer', () => {
    it('должен возвращать null если нет активных слоёв', () => {
      expect(layerManager.activeLayer).toBe(null)
    })

    it('должен возвращать активный слой', () => {
      layerManager.layers = [{ id: 'layer1', type: 'base' }]
      layerManager.activeLayerIndex = 0
      
      expect(layerManager.activeLayer.id).toBe('layer1')
    })

    it('должен устанавливать активный слой по объекту', () => {
      const layer = { id: 'layer1', type: 'base' }
      layerManager.layers = [layer]
      
      layerManager.activeLayer = layer
      
      expect(layerManager.activeLayerIndex).toBe(0)
    })

    it('должен сбрасывать активный слой при установке null', () => {
      layerManager.layers = [{ id: 'layer1', type: 'base' }]
      layerManager.activeLayerIndex = 0
      
      layerManager.activeLayer = null
      
      expect(layerManager.activeLayerIndex).toBe(-1)
    })
  })

  describe('getLayerById', () => {
    it('должен находить слой по id', () => {
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'highlight' }
      ]
      
      const layer = layerManager.getLayerById('layer2')
      
      expect(layer).toEqual({ id: 'layer2', type: 'highlight' })
    })

    it('должен возвращать null если слой не найден', () => {
      layerManager.layers = [{ id: 'layer1', type: 'base' }]
      
      const layer = layerManager.getLayerById('nonexistent')
      
      expect(layer).toBe(null)
    })
  })

  describe('addLayer', () => {
    it('должен добавлять новый слой', () => {
      layerManager.layers = []
      
      const layer = layerManager.addLayer({ type: 'highlight' })
      
      expect(layerManager.layers.length).toBe(1)
      expect(layer.type).toBe('highlight')
      expect(layerManager.activeLayerIndex).toBe(0)
    })

    it('должен делать добавленный слой активным', () => {
      layerManager.layers = [{ id: 'layer1', type: 'base' }]
      layerManager.activeLayerIndex = 0
      
      layerManager.addLayer({ type: 'line' })
      
      expect(layerManager.activeLayer.type).toBe('line')
    })

    it('должен вызывать render', () => {
      layerManager.addLayer({ type: 'blur' })
      
      expect(editor.render).toHaveBeenCalled()
    })
  })

  describe('deleteActiveLayer', () => {
    it('должен удалять активный слой', () => {
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'highlight' }
      ]
      layerManager.activeLayerIndex = 1
      
      const removed = layerManager.deleteActiveLayer()
      
      expect(layerManager.layers.length).toBe(1)
      expect(removed.id).toBe('layer2')
    })

    it('должен устанавливать предыдущий слой активным', () => {
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'highlight' }
      ]
      layerManager.activeLayerIndex = 1
      
      layerManager.deleteActiveLayer()
      
      expect(layerManager.activeLayerIndex).toBe(0)
    })

    it('должен возвращать false если нет активного слоя', () => {
      layerManager.activeLayerIndex = -1
      
      const result = layerManager.deleteActiveLayer()
      
      expect(result).toBe(false)
    })

    it('должен вызывать updateLayersPanel и render', () => {
      layerManager.layers = [{ id: 'layer1', type: 'base' }]
      layerManager.activeLayerIndex = 0
      
      const spy = vi.spyOn(layerManager, 'updateLayersPanel')
      layerManager.deleteActiveLayer()
      
      expect(spy).toHaveBeenCalled()
      expect(editor.render).toHaveBeenCalled()
    })
  })

  describe('setActiveLayerById', () => {
    it('должен устанавливать активный слой по id', () => {
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'highlight' }
      ]

      const result = layerManager.setActiveLayerById('layer2')

      expect(result).toBe(true)
      expect(layerManager.activeLayer.id).toBe('layer2')
    })

    it('должен возвращать false если слой не найден', () => {
      const result = layerManager.setActiveLayerById('nonexistent')

      expect(result).toBe(false)
    })

    it('должен обновлять currentLayer у активного инструмента если тип совпадает', () => {
      const mockTool = {
        name: 'highlight',
        currentLayer: null,
        updateOverlay: vi.fn()
      }
      editor.activeTool = mockTool
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'highlight', rect: { x: 0, y: 0, width: 10, height: 10 } }
      ]

      layerManager.setActiveLayerById('layer2')

      expect(mockTool.currentLayer).toEqual(layerManager.layers[1])
      expect(mockTool.updateOverlay).toHaveBeenCalled()
    })

    it('должен сбрасывать currentLayer у инструмента если тип слоя не совпадает', () => {
      const mockTool = {
        name: 'highlight',
        currentLayer: { id: 'old-layer', type: 'highlight' },
        updateOverlay: vi.fn()
      }
      editor.activeTool = mockTool
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'line', points: { x1: 0, y1: 0, x2: 10, y2: 10 } }
      ]

      layerManager.setActiveLayerById('layer2')

      expect(mockTool.currentLayer).toBe(null)
      expect(mockTool.updateOverlay).toHaveBeenCalled()
    })

    it('должен работать с blur инструментом', () => {
      const mockTool = {
        name: 'blur',
        currentLayer: null,
        updateOverlay: vi.fn()
      }
      editor.activeTool = mockTool
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'blur', rect: { x: 0, y: 0, width: 10, height: 10 } }
      ]

      layerManager.setActiveLayerById('layer2')

      expect(mockTool.currentLayer).toEqual(layerManager.layers[1])
    })

    it('должен работать с text инструментом', () => {
      const mockTool = {
        name: 'text',
        currentLayer: null,
        updateOverlay: vi.fn()
      }
      editor.activeTool = mockTool
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'text', rect: { x: 0, y: 0, width: 10, height: 10 }, params: { text: 'test' } }
      ]

      layerManager.setActiveLayerById('layer2')

      expect(mockTool.currentLayer).toEqual(layerManager.layers[1])
    })

    it('должен работать с line инструментом', () => {
      const mockTool = {
        name: 'line',
        currentLayer: null,
        updateOverlay: vi.fn()
      }
      editor.activeTool = mockTool
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'line', points: { x1: 0, y1: 0, x2: 10, y2: 10 } }
      ]

      layerManager.setActiveLayerById('layer2')

      expect(mockTool.currentLayer).toEqual(layerManager.layers[1])
    })

    it('должен работать с crop инструментом', () => {
      const mockTool = {
        name: 'crop',
        currentLayer: null,
        updateOverlay: vi.fn()
      }
      editor.activeTool = mockTool
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'crop', rect: { x: 0, y: 0, width: 10, height: 10 } }
      ]

      layerManager.setActiveLayerById('layer2')

      expect(mockTool.currentLayer).toEqual(layerManager.layers[1])
    })

    it('не должен вызывать ошибки если нет активного инструмента', () => {
      editor.activeTool = null
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'highlight' }
      ]

      const result = layerManager.setActiveLayerById('layer2')

      expect(result).toBe(true)
      expect(layerManager.activeLayer.id).toBe('layer2')
    })
  })

  describe('moveLayer', () => {
    it('должен перемещать слой выше', () => {
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'highlight' },
        { id: 'layer3', type: 'line' }
      ]
      
      layerManager.moveLayer('layer2', 'layer3', true)
      
      expect(layerManager.layers[1].id).toBe('layer3')
      expect(layerManager.layers[2].id).toBe('layer2')
    })

    it('должен перемещать слой ниже (вниз к концу массива)', () => {
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'highlight' },
        { id: 'layer3', type: 'line' }
      ]
      
      // Перемещаем layer2 ниже (после layer3)
      layerManager.moveLayer('layer2', 'layer3', false)
      
      expect(layerManager.layers[0].id).toBe('layer1')
      expect(layerManager.layers[1].id).toBe('layer3')
      expect(layerManager.layers[2].id).toBe('layer2')
    })

    it('должен обновлять activeLayerIndex при перемещении', () => {
      layerManager.layers = [
        { id: 'layer1', type: 'base' },
        { id: 'layer2', type: 'highlight' }
      ]
      layerManager.activeLayerIndex = 1
      
      layerManager.moveLayer('layer2', 'layer1', false)
      
      expect(layerManager.activeLayerIndex).toBe(0)
    })

    it('должен игнорировать если draggedLayerId === targetLayerId', () => {
      layerManager.layers = [{ id: 'layer1', type: 'base' }]
      
      layerManager.moveLayer('layer1', 'layer1', true)
      
      expect(layerManager.layers.length).toBe(1)
    })
  })

  describe('redrawAllLayers', () => {
    it('должен отрисовывать все видимые слои', () => {
      layerManager.layers = [
        {
          id: 'layer1',
          type: 'base',
          visible: true,
          imageData: { data: new Uint8ClampedArray(100) }
        }
      ]
      
      layerManager.redrawAllLayers()
      
      expect(editor.context.putImageData).toHaveBeenCalled()
    })
  })

  describe('captureActiveLayerFromCanvas', () => {
    it('должен копировать данные с холста в слой', () => {
      layerManager.layers = [{ id: 'layer1', type: 'base', visible: true }]
      layerManager.activeLayerIndex = 0
      
      layerManager.captureActiveLayerFromCanvas()
      
      expect(layerManager.layers[0].imageData).toBeDefined()
      expect(editor.context.getImageData).toHaveBeenCalled()
    })
  })

  describe('restoreActiveLayerToCanvas', () => {
    it('должен восстанавливать слой на холст', () => {
      const imageData = { data: new Uint8ClampedArray(100) }
      layerManager.layers = [{ id: 'layer1', type: 'base', imageData }]
      layerManager.activeLayerIndex = 0
      
      const result = layerManager.restoreActiveLayerToCanvas()
      
      expect(result).toBe(true)
      expect(editor.context.putImageData).toHaveBeenCalledWith(imageData, 0, 0)
    })

    it('должен возвращать false если нет imageData', () => {
      layerManager.layers = [{ id: 'layer1', type: 'base' }]
      layerManager.activeLayerIndex = 0
      
      const result = layerManager.restoreActiveLayerToCanvas()
      
      expect(result).toBe(false)
    })
  })

  describe('getLayerTypeDisplay', () => {
    it('должен возвращать иконку и имя для base слоя', () => {
      const display = layerManager.getLayerTypeDisplay('base')
      
      expect(display.name).toBe('Изображение')
      expect(display.iconPath).toBe('icons/Image.svg')
    })

    it('должен возвращать иконку и имя для highlight слоя', () => {
      const display = layerManager.getLayerTypeDisplay('highlight')
      
      expect(display.name).toBe('Выделение')
      expect(display.iconPath).toBe('icons/rectangle.svg')
    })

    it('должен возвращать иконку и имя для line слоя', () => {
      const display = layerManager.getLayerTypeDisplay('line')
      
      expect(display.name).toBe('Стрелка')
      expect(display.iconPath).toBe('icons/ArrowUpRight.svg')
    })

    it('должен возвращать иконку и имя для text слоя', () => {
      const display = layerManager.getLayerTypeDisplay('text')
      
      expect(display.name).toBe('Текст')
      expect(display.iconPath).toBe('icons/TextCreation.svg')
    })

    it('должен возвращать дефолтное значение для неизвестного типа', () => {
      const display = layerManager.getLayerTypeDisplay('unknown')
      
      expect(display.name).toBe('unknown')
      expect(display.iconPath).toBe('icons/Image.svg')
    })
  })

  describe('destroy', () => {
    it('должен очищать все данные', () => {
      layerManager.layers = [{ id: 'layer1', type: 'base' }]
      layerManager.activeLayerIndex = 0
      layerManager.dragState = { dragging: true }
      
      layerManager.destroy()
      
      expect(layerManager.layers).toEqual([])
      expect(layerManager.activeLayerIndex).toBe(-1)
      expect(layerManager.dragState).toBe(null)
      expect(layerManager.editor).toBe(null)
    })
  })
})
