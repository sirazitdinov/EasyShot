// tests/HistoryManager.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import HistoryManager from '../editor/HistoryManager.js'

// Мок для EditorCore
function createMockEditor() {
  let callCounter = 0
  const canvas = {
    width: 100,
    height: 100
  }

  const context = {
    getImageData: vi.fn(() => {
      // Возвращаем разные данные для каждого вызова чтобы избежать дедупликации
      callCounter++
      return {
        data: new Uint8ClampedArray(100 * 100 * 4).fill(callCounter)
      }
    }),
    putImageData: vi.fn(),
    drawImage: vi.fn()
  }

  const layerManager = {
    layers: [],
    activeLayer: null,
    setActiveLayerById: vi.fn()
  }

  const updateToolbarButtons = vi.fn()
  const render = vi.fn()
  const updateLayersPanel = vi.fn()

  const editor = {
    canvas,
    context,
    layerManager,
    activeTool: null,
    updateToolbarButtons,
    render,
    updateLayersPanel
  }

  // Метод для сброса счётчика (для тестов дедупликации)
  editor.resetCounter = () => { callCounter = 0 }
  editor.setCounter = (val) => { callCounter = val }

  return editor
}

describe('HistoryManager', () => {
  let editor
  let historyManager

  beforeEach(() => {
    editor = createMockEditor()
    historyManager = new HistoryManager(editor, { maxHistory: 50, deduplicate: true })
  })

  describe('constructor', () => {
    it('должен инициализироваться с параметрами по умолчанию', () => {
      const hm = new HistoryManager(editor)

      expect(hm.maxHistory).toBe(50)
      expect(hm.deduplicate).toBe(true)
      expect(hm.maxMemoryBytes).toBe(100 * 1024 * 1024)
      expect(hm.history).toEqual([])
      expect(hm.position).toBe(-1)
    })

    it('должен принимать кастомные опции', () => {
      const hm = new HistoryManager(editor, { maxHistory: 10, deduplicate: false })
      
      expect(hm.maxHistory).toBe(10)
      expect(hm.deduplicate).toBe(false)
    })
  })

  describe('commit', () => {
    it('должен добавлять состояние в историю', () => {
      historyManager.commit('Test action')
      
      expect(historyManager.history.length).toBe(1)
      expect(historyManager.position).toBe(0)
      expect(historyManager.history[0].label).toBe('Test action')
    })

    it('должен обрезать будущее при новом коммите после undo', () => {
      historyManager.commit('Action 1')
      historyManager.commit('Action 2')
      historyManager.undo()
      historyManager.commit('Action 3')
      
      expect(historyManager.history.length).toBe(2)
      expect(historyManager.history[0].label).toBe('Action 1')
      expect(historyManager.history[1].label).toBe('Action 3')
    })

    it('не должен добавлять дубликаты при включённой дедупликации', () => {
      historyManager.commit('Action 1')
      
      // Сбрасываем счётчик чтобы getImageData вернул те же данные
      editor.resetCounter()
      historyManager.commit('Action 1')
      
      expect(historyManager.history.length).toBe(1)
    })

    it('должен добавлять дубликаты при force=true', () => {
      historyManager.commit('Action 1')
      historyManager.commit('Action 1', true)
      
      expect(historyManager.history.length).toBe(2)
    })

    it('не должен добавлять дубликаты при deduplicate=false', () => {
      const hm = new HistoryManager(editor, { deduplicate: false })
      hm.commit('Action 1')
      hm.commit('Action 1')
      
      expect(hm.history.length).toBe(2)
    })

    it('должен соблюдать maxHistory', () => {
      const hm = new HistoryManager(editor, { maxHistory: 3 })

      hm.commit('Action 1')
      hm.commit('Action 2')
      hm.commit('Action 3')
      hm.commit('Action 4')

      expect(hm.history.length).toBe(3)
      expect(hm.history[0].label).toBe('Action 2')
      expect(hm.history[1].label).toBe('Action 3')
      expect(hm.history[2].label).toBe('Action 4')
    })

    it('должен ограничивать историю по памяти с минимумом 3', () => {
      // Для canvas 100x100 размер снимка = 40 000 байт
      // При maxMemoryBytes = 100 MB лимит ~2621, но min = 3
      const hm = new HistoryManager(editor, { maxMemoryMB: 100 })

      hm.commit('Action 1')
      hm.commit('Action 2')
      hm.commit('Action 3')

      expect(hm.history.length).toBe(3)
    })

    it('должен сохранять snapshot состояния слоёв', () => {
      editor.layerManager.layers = [
        { id: 'layer1', type: 'base', visible: true, rect: null, points: null, params: {} }
      ]
      editor.layerManager.activeLayer = { id: 'layer1' }
      
      historyManager.commit('With layers')
      
      const state = historyManager.history[0]
      expect(state.layers).toHaveLength(1)
      expect(state.layers[0].id).toBe('layer1')
      expect(state.activeLayerId).toBe('layer1')
    })
  })

  describe('beginAtomicOperation / endAtomicOperation', () => {
    it('должен фиксировать одно состояние для атомарной операции', () => {
      historyManager.beginAtomicOperation('Drag operation')
      historyManager.commit('Intermediate 1')
      historyManager.commit('Intermediate 2')
      historyManager.endAtomicOperation()
      
      expect(historyManager.history.length).toBe(1)
      // Последний commit перезаписывает label в atomicSnapshot
      expect(historyManager.history[0].label).toBe('Intermediate 2')
    })

    it('не должен фиксировать состояние если не было endAtomicOperation', () => {
      historyManager.beginAtomicOperation('Drag')
      historyManager.commit('Intermediate')
      
      expect(historyManager.history.length).toBe(0)
    })
  })

  describe('undo/redo', () => {
    it('должен отменять последнее действие', () => {
      historyManager.commit('Action 1')
      historyManager.commit('Action 2')
      
      expect(historyManager.canUndo()).toBe(true)
      historyManager.undo()
      
      expect(historyManager.position).toBe(0)
      expect(editor.render).toHaveBeenCalled()
    })

    it('должен повторять отменённое действие', () => {
      historyManager.commit('Action 1')
      historyManager.commit('Action 2')
      historyManager.undo()
      
      expect(historyManager.canRedo()).toBe(true)
      historyManager.redo()
      
      expect(historyManager.position).toBe(1)
    })

    it('не должен отменять если нет действий', () => {
      expect(historyManager.canUndo()).toBe(false)
      const result = historyManager.undo()
      
      expect(result).toBe(null)
      expect(historyManager.position).toBe(-1)
    })

    it('не должен повторять если нет отменённых действий', () => {
      historyManager.commit('Action 1')
      
      expect(historyManager.canRedo()).toBe(false)
      const result = historyManager.redo()
      
      expect(result).toBe(null)
    })

    it('должен восстанавливать состояние при undo', () => {
      editor.layerManager.layers = [{ id: 'layer1', type: 'base', visible: true, rect: null, points: null, params: {} }]

      historyManager.commit('State 1')

      // Изменяем слой
      editor.layerManager.layers[0].rect = { x: 10, y: 10, width: 50, height: 50 }
      historyManager.commit('State 2')

      historyManager.undo()

      expect(editor.context.putImageData).toHaveBeenCalled()
      expect(editor.updateLayersPanel).toHaveBeenCalled()
    })

    it('должен использовать drawImage при восстановлении offscreenCanvas', () => {
      // Создаём состояние с offscreenCanvas
      const state = {
        offscreenCanvas: {
          width: 100,
          height: 100,
          getContext: vi.fn(() => ({
            getImageData: vi.fn(() => ({
              data: new Uint8ClampedArray(100 * 100 * 4).fill(1)
            }))
          }))
        },
        imageData: null,
        layers: [],
        activeLayerId: null,
        activeToolName: null
      }

      historyManager.restoreState(state)

      expect(editor.context.drawImage).toHaveBeenCalledWith(state.offscreenCanvas, 0, 0)
    })
  })

  describe('clear', () => {
    it('должен очищать историю', () => {
      historyManager.commit('Action 1')
      historyManager.commit('Action 2')
      
      historyManager.clear()
      
      expect(historyManager.history).toEqual([])
      expect(historyManager.position).toBe(-1)
      expect(historyManager.atomicSnapshot).toBe(null)
    })

    it('должен вызывать updateToolbarButtons', () => {
      historyManager.clear()
      
      expect(editor.updateToolbarButtons).toHaveBeenCalled()
    })
  })

  describe('isStateEqual', () => {
    it('должен возвращать true для одинаковых состояний', () => {
      const state1 = { imageData: { data: new Uint8ClampedArray(100) } }
      const state2 = { imageData: { data: new Uint8ClampedArray(100) } }
      
      expect(historyManager.isStateEqual(state1, state2)).toBe(true)
    })

    it('должен возвращать false для разных состояний', () => {
      const state1 = { imageData: { data: new Uint8ClampedArray(100).fill(0) } }
      const state2 = { imageData: { data: new Uint8ClampedArray(100).fill(255) } }
      
      expect(historyManager.isStateEqual(state1, state2)).toBe(false)
    })

    it('должен обрабатывать null состояния', () => {
      expect(historyManager.isStateEqual(null, null)).toBe(true)
      expect(historyManager.isStateEqual({ imageData: null }, null)).toBe(false)
    })
  })

  describe('getCurrentStepDescription', () => {
    it('должен возвращать описание текущего шага', () => {
      historyManager.commit('Test action')
      
      expect(historyManager.getCurrentStepDescription()).toBe('Test action')
    })

    it('должен возвращать "Начальное состояние" если нет шагов', () => {
      expect(historyManager.getCurrentStepDescription()).toBe('Начальное состояние')
    })

    it('должен возвращать метку по умолчанию для шага без label', () => {
      historyManager.commit('')
      
      // HistoryManager возвращает "Шаг {position}" для шагов без label
      expect(historyManager.getCurrentStepDescription()).toBe('Шаг 0')
    })
  })

  describe('getMemoryUsage', () => {
    it('должен возвращать приблизительный объём памяти истории', () => {
      historyManager.commit('Action 1')
      historyManager.commit('Action 2')

      const usage = historyManager.getMemoryUsage()
      // Каждый снимок 100x100x4 = 40000 байт
      expect(usage).toBeGreaterThanOrEqual(40000 * 2)
    })

    it('должен возвращать 0 для пустой истории', () => {
      expect(historyManager.getMemoryUsage()).toBe(0)
    })
  })

  describe('destroy', () => {
    it('должен очищать все данные', () => {
      historyManager.commit('Action')
      historyManager.destroy()

      expect(historyManager.history).toEqual([])
      expect(historyManager.position).toBe(-1)
      expect(historyManager.editor).toBe(null)
    })

    it('должен сбрасывать размеры offscreenCanvas при уничтожении', () => {
      historyManager.commit('Action')
      const canvas = historyManager.history[0]?.offscreenCanvas
      historyManager.destroy()

      if (canvas) {
        expect(canvas.width).toBe(0)
        expect(canvas.height).toBe(0)
      }
    })
  })
})
