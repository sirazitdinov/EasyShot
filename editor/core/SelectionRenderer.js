// SelectionRenderer.js

export default class SelectionRenderer {
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * Рисует хэндлы и точки выделения активного слоя.
   * @param {Object|null} dirtyRegion
   */
  renderSelectionHandles(dirtyRegion = null) {
    const { layerManager, context } = this.editor;
    if (!layerManager || !context) return;
    const activeLayer = layerManager.activeLayer;
    if (!activeLayer) return;

    // Простая проверка: если есть dirtyRegion и есть rect — не рисуем вне dirtyRegion.
    if (dirtyRegion && activeLayer.rect) {
      const r = activeLayer.rect;
      const intersects =
        dirtyRegion.x < r.x + r.width &&
        dirtyRegion.x + dirtyRegion.width > r.x &&
        dirtyRegion.y < r.y + r.height &&
        dirtyRegion.y + dirtyRegion.height > r.y;
      if (!intersects) {
        return;
      }
    }

    if (activeLayer.rect) {
      this.drawHandles(context, activeLayer.rect);
    }

    if (activeLayer.type === 'line' && activeLayer.points) {
      this.drawLinePoints(context, activeLayer.points);
    }
  }

  /**
   * Рисует ручки управления (handles) для прямоугольника, используя контекст 2D.
   * Каждая ручка представляет собой квадратный элемент с указанными координатами и направлением.
   * @param {CanvasRenderingContext2D} ctx - Контекст 2D канваса.
   * @param {Object} rect - Объект с координатами прямоугольника: { x, y, width, height }.
   * @returns {void} - Функция не возвращает значения.
   * @throws {Error} - Бросает ошибку, если ctx или rect равны null.
   */
  drawHandles(ctx, rect) {
    if (!ctx || !rect) return;
    try {
      ctx.save();
      ctx.fillStyle = '#0096ff';
      const size = 6;

      const handles = [
        { x: rect.x, y: rect.y, dx: -1, dy: -1 },           // nw
        { x: rect.x + rect.width / 2, y: rect.y, dx: 0, dy: -1 }, // n
        { x: rect.x + rect.width, y: rect.y, dx: 1, dy: -1 },     // ne
        { x: rect.x, y: rect.y + rect.height / 2, dx: -1, dy: 0 }, // w
        { x: rect.x + rect.width, y: rect.y + rect.height / 2, dx: 1, dy: 0 }, // e
        { x: rect.x, y: rect.y + rect.height, dx: -1, dy: 1 },    // sw
        { x: rect.x + rect.width / 2, y: rect.y + rect.height, dx: 0, dy: 1 }, // s
        { x: rect.x + rect.width, y: rect.y + rect.height, dx: 1, dy: 1 }      // se
      ];

      handles.forEach(h => {
        const cx = h.x + h.dx * 4;
        const cy = h.y + h.dy * 4;
        ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      });
      ctx.restore();
    } catch (error) {
      console.error('Error drawing handles:', error);
      ctx.restore(); // Ensure context is restored even if drawing fails
    }
  }

  /**
   * Рисует точки на линии с указанными координатами.
   * @param {CanvasRenderingContext2D} ctx - Контекст 2D для рисования.
   * @param {Object} points - Объект с координатами точек: {x1, y1, x2, y2}.
   * @returns {void} - Функция не возвращает значение.
   * @throws {Error} - Если ctx или points равны null/undefined.
   */
  drawLinePoints(ctx, points) {
    if (!ctx || !points) return;
    try {
      ctx.save();
      ctx.fillStyle = '#0096ff';
      const r = 5;
      ctx.beginPath();
      ctx.arc(points.x1, points.y1, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(points.x2, points.y2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } catch (error) {
      console.error('Error drawing line points:', error);
      ctx.restore(); // Ensure context is restored even if drawing fails
    }
  }
}
