// tests/Helper.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import Helper from '../editor/Helper.js'

describe('Helper', () => {
  describe('deepMerge', () => {
    it('должен объединять объекты на первом уровне', () => {
      const target = { a: 1, b: 2 }
      const source = { b: 3, c: 4 }
      const result = Helper.deepMerge(target, source)
      
      expect(result).toEqual({ a: 1, b: 3, c: 4 })
      expect(target).toEqual({ a: 1, b: 2 }) // target не изменён
    })

    it('должен глубоко объединять вложенные объекты', () => {
      const target = { a: 1, nested: { x: 10, y: 20 } }
      const source = { nested: { y: 200, z: 300 } }
      const result = Helper.deepMerge(target, source)
      
      expect(result).toEqual({ a: 1, nested: { x: 10, y: 200, z: 300 } })
    })

    it('должен добавлять отсутствующие ключи из target', () => {
      const target = { a: 1, b: 2 }
      const source = { c: 3 }
      const result = Helper.deepMerge(target, source)
      
      expect(result).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('должен обрабатывать пустые объекты', () => {
      expect(Helper.deepMerge({}, {})).toEqual({})
      expect(Helper.deepMerge({ a: 1 }, {})).toEqual({ a: 1 })
      expect(Helper.deepMerge({}, { b: 2 })).toEqual({ b: 2 })
    })
  })

  describe('formatSize', () => {
    it('должен округлять до 1 знака после запятой', () => {
      expect(Helper.formatSize(10.123)).toBe(10.1)
      expect(Helper.formatSize(10.156)).toBe(10.2)
      expect(Helper.formatSize(10.0)).toBe(10)
    })

    it('должен обрабатывать целые числа', () => {
      expect(Helper.formatSize(100)).toBe(100)
    })
  })

  describe('getScaleFactor', () => {
    it('должен возвращать 1 при отсутствии canvas', () => {
      expect(Helper.getScaleFactor(null)).toBe(1)
      expect(Helper.getScaleFactor(undefined)).toBe(1)
    })

    it('должен возвращать 1 при нулевой ширине canvas', () => {
      const canvas = { width: 0, clientWidth: 100 }
      expect(Helper.getScaleFactor(canvas)).toBe(1)
    })

    it('должен рассчитывать коэффициент масштабирования с DPR', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const dpr = 2
      const result = Helper.getScaleFactor(canvas, dpr)
      
      // (400 / 800) * 2 = 1
      expect(result).toBe(1)
    })

    it('должен рассчитывать коэффициент масштабирования без DPR', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const result = Helper.getScaleFactor(canvas)
      
      // (400 / 800) * 1 = 0.5
      expect(result).toBe(0.5)
    })
  })

  describe('toCssPixels', () => {
    it('должен конвертировать пиксели канваса в CSS-пиксели', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const dpr = 2
      
      // scaleFactor = (400 / 800) * 2 = 1
      const result = Helper.toCssPixels(100, canvas, dpr)
      expect(result).toBe(100)
    })

    it('должен уменьшать значение при scaleFactor < 1', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const result = Helper.toCssPixels(100, canvas, 1)
      
      // scaleFactor = 0.5, 100 * 0.5 = 50
      expect(result).toBe(50)
    })
  })

  describe('toCanvasPixels', () => {
    it('должен конвертировать CSS-пиксели в пиксели канваса', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const dpr = 2
      
      // scaleFactor = 1, 100 / 1 = 100
      const result = Helper.toCanvasPixels(100, canvas, dpr)
      expect(result).toBe(100)
    })

    it('должен увеличивать значение при scaleFactor < 1', () => {
      const canvas = { width: 800, clientWidth: 400 }
      
      // scaleFactor = 0.5, 50 / 0.5 = 100
      const result = Helper.toCanvasPixels(50, canvas, 1)
      expect(result).toBe(100)
    })

    it('должен возвращать 100 при scaleFactor === NaN (защита от деления на 0)', () => {
      const canvas = { width: 0, clientWidth: 0 }
      const result = Helper.toCanvasPixels(100, canvas)
      // При scale = NaN (0/0), проверка scale === 0 возвращает false, 
      // поэтому возвращается cssValue / NaN = NaN, но getScaleFactor возвращает 1 при width = 0
      expect(result).toBe(100)
    })
  })
})
