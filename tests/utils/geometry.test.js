import { describe, it, expect } from 'vitest';
import { pointToSegmentDistance, calculateVisibleArea } from '../../editor/utils/geometry.js';

describe('geometry', () => {
  describe('pointToSegmentDistance', () => {
    it('возвращает 0 для точки на отрезке', () => {
      expect(pointToSegmentDistance(5, 0, 0, 0, 10, 0)).toBe(0);
    });

    it('возвращает расстояние до конца отрезка', () => {
      expect(pointToSegmentDistance(12, 0, 0, 0, 10, 0)).toBe(2);
    });

    it('работает для вырожденного отрезка', () => {
      expect(pointToSegmentDistance(3, 4, 0, 0, 0, 0)).toBe(5);
    });

    it('возвращает перпендикулярное расстояние', () => {
      expect(pointToSegmentDistance(5, 5, 0, 0, 10, 0)).toBe(5);
    });
  });

  describe('calculateVisibleArea', () => {
    it('должен правильно вычислять видимую область для слоя полностью внутри кропа', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      const result = calculateVisibleArea(120, 120, 50, 50, cropCoords);

      expect(result.validX).toBe(20);
      expect(result.validY).toBe(20);
      expect(result.validWidth).toBe(70);
      expect(result.validHeight).toBe(70);
    });

    it('должен правильно вычислять видимую область для слоя частично за пределами кропа слева', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      const result = calculateVisibleArea(80, 120, 50, 50, cropCoords);

      expect(result.validX).toBeGreaterThanOrEqual(0);
      expect(result.validY).toBeGreaterThanOrEqual(0);
    });

    it('должен возвращать отрицательную ширину для слоя полностью за пределами кропа', () => {
      const cropCoords = {
        validX: 100,
        validY: 100,
        validWidth: 200,
        validHeight: 200
      };

      const result = calculateVisibleArea(350, 120, 50, 50, cropCoords);

      expect(result.validWidth - result.validX).toBeLessThanOrEqual(0);
    });
  });
});
