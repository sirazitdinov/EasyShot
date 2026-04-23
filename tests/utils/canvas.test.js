import { describe, it, expect } from 'vitest';
import { formatFileSize, wrapTextInRect } from '../../editor/utils/canvas.js';

describe('canvas utils', () => {
  describe('formatFileSize', () => {
    it('форматирует 0 байт', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('форматирует килобайты', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('форматирует мегабайты', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    });
  });

  describe('wrapTextInRect', () => {
    it('не падает при пустом тексте', () => {
      const ctx = {
        fillText: () => {},
        measureText: () => ({ width: 0 })
      };
      expect(() => wrapTextInRect(ctx, '', 0, 0, 100, 100, 16)).not.toThrow();
    });
  });
});
