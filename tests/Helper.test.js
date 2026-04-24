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

    it('должен рассчитывать коэффициент масштабирования как отношение clientWidth к width', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const dpr = 2
      const result = Helper.getScaleFactor(canvas, dpr)

      // 400 / 800 = 0.5 (DPR больше не используется)
      expect(result).toBe(0.5)
    })

    it('должен рассчитывать коэффициент масштабирования без DPR', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const result = Helper.getScaleFactor(canvas)

      // 400 / 800 = 0.5
      expect(result).toBe(0.5)
    })

    it('должен возвращать 1 при одинаковых width и clientWidth', () => {
      const canvas = { width: 800, clientWidth: 800 }
      const result = Helper.getScaleFactor(canvas)

      expect(result).toBe(1)
    })
  })

  describe('toCssPixels', () => {
    it('должен конвертировать пиксели канваса в CSS-пиксели', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const dpr = 2

      // scaleFactor = 400 / 800 = 0.5, 100 * 0.5 = 50
      const result = Helper.toCssPixels(100, canvas, dpr)
      expect(result).toBe(50)
    })

    it('должен уменьшать значение при scaleFactor < 1', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const result = Helper.toCssPixels(100, canvas, 1)

      // scaleFactor = 0.5, 100 * 0.5 = 50
      expect(result).toBe(50)
    })

    it('должен возвращать то же значение при scaleFactor = 1', () => {
      const canvas = { width: 800, clientWidth: 800 }
      const result = Helper.toCssPixels(100, canvas)

      // scaleFactor = 1, 100 * 1 = 100
      expect(result).toBe(100)
    })
  })

  describe('toCanvasPixels', () => {
    it('должен конвертировать CSS-пиксели в пиксели канваса', () => {
      const canvas = { width: 800, clientWidth: 400 }
      const dpr = 2

      // scaleFactor = 0.5, 50 / 0.5 = 100
      const result = Helper.toCanvasPixels(50, canvas, dpr)
      expect(result).toBe(100)
    })

    it('должен увеличивать значение при scaleFactor < 1', () => {
      const canvas = { width: 800, clientWidth: 400 }

      // scaleFactor = 0.5, 50 / 0.5 = 100
      const result = Helper.toCanvasPixels(50, canvas, 1)
      expect(result).toBe(100)
    })

    it('должен возвращать исходное значение при scaleFactor = 0 (защита от деления на 0)', () => {
      const canvas = { width: 0, clientWidth: 0 }
      const result = Helper.toCanvasPixels(100, canvas)
      // При width = 0 getScaleFactor возвращает 1 (защита)
      // Поэтому 100 / 1 = 100
      expect(result).toBe(100)
    })
  })

  describe('mergeDirtyRegions', () => {
    it('должен объединять два пересекающихся региона', () => {
      const a = { x: 0, y: 0, width: 50, height: 50 }
      const b = { x: 30, y: 30, width: 50, height: 50 }
      const result = Helper.mergeDirtyRegions(a, b)

      expect(result).toEqual({ x: 0, y: 0, width: 80, height: 80 })
    })

    it('должен объединять два непересекающихся региона', () => {
      const a = { x: 0, y: 0, width: 10, height: 10 }
      const b = { x: 100, y: 100, width: 20, height: 20 }
      const result = Helper.mergeDirtyRegions(a, b)

      expect(result).toEqual({ x: 0, y: 0, width: 120, height: 120 })
    })

    it('должен возвращать второй регион если первый null', () => {
      const b = { x: 10, y: 10, width: 30, height: 30 }
      expect(Helper.mergeDirtyRegions(null, b)).toBe(b)
    })

    it('должен возвращать первый регион если второй null', () => {
      const a = { x: 10, y: 10, width: 30, height: 30 }
      expect(Helper.mergeDirtyRegions(a, null)).toBe(a)
    })

    it('должен возвращать null если оба региона null', () => {
      expect(Helper.mergeDirtyRegions(null, null)).toBeNull()
    })
  })
})
