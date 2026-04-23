// CanvasManager.js

import Helper from '../Helper.js';

export default class CanvasManager {
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * Устанавливает начальные параметры холста
   * Задает размеры холста и заливает его белым цветом
   */
  setupCanvas() {
    const { canvas, context, historyManager } = this.editor;
    canvas.width = 800;
    canvas.height = 600;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (historyManager) {
      historyManager.clear();
      historyManager.commit('Initial canvas');
    }
  }

  /**
   * Обновляет отображение холста при изменении размера окна
   */
  updateCanvasDisplay() {
    // Можно добавить логику для адаптации отображения холста под размер окна
  }

  /**
   * Основной метод перерисовки
   * @param {Object|null} dirtyRegion - { x, y, width, height } для частичного рендера.
   */
  render(dirtyRegion = null) {
    const { image, context, canvas, selectionRenderer } = this.editor;
    if (!image || !context || !canvas) {
      return;
    }

    try {
      if (dirtyRegion) {
        context.save();
        context.beginPath();
        context.rect(
          dirtyRegion.x,
          dirtyRegion.y,
          dirtyRegion.width,
          dirtyRegion.height
        );
        context.clip();
      } else {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }

      this.renderBaseImage(dirtyRegion);
      this.renderRasterLayers(dirtyRegion);
      this.renderCropOverlay(dirtyRegion);
      if (selectionRenderer) {
        selectionRenderer.renderSelectionHandles(dirtyRegion);
      }
    } catch (error) {
      console.error('Error during rendering', error);
    } finally {
      if (dirtyRegion) {
        try {
          context.restore();
        } catch {
          // ignore restore errors
        }
      }
    }
  }

  /**
   * Рисует базовое изображение с учетом dirtyRegion.
   * @param {Object|null} dirtyRegion
   */
  renderBaseImage(dirtyRegion = null) {
    const { image, context, canvas } = this.editor;
    if (!image || !context || !canvas) return;

    if (dirtyRegion) {
      context.drawImage(
        image,
        dirtyRegion.x,
        dirtyRegion.y,
        dirtyRegion.width,
        dirtyRegion.height,
        dirtyRegion.x,
        dirtyRegion.y,
        dirtyRegion.width,
        dirtyRegion.height
      );
    } else {
      context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
  }

  /**
   * Рендерит растер‑слои (blur, highlight, line, text).
   * @param {Object|null} dirtyRegion
   */
  renderRasterLayers(dirtyRegion = null) {
    const { layerManager, context, canvas, tools } = this.editor;
    if (!layerManager || !Array.isArray(layerManager.layers)) return;
    if (!context || !canvas) return;

    layerManager.layers.forEach(layer => {
      if (!layer || layer.type === 'crop' || layer.type === 'base') return;
      if (layer.visible === false) return;

      const tool = tools[layer.type];
      if (!tool?.renderLayer) return;

      // Простейшая оптимизация по dirtyRegion — скипаем слой, если он точно вне области.
      if (dirtyRegion) {
        const bounds = tool.getBounds?.(layer);
        if (bounds) {
          const intersects =
            dirtyRegion.x < bounds.x + bounds.width &&
            dirtyRegion.x + dirtyRegion.width > bounds.x &&
            dirtyRegion.y < bounds.y + bounds.height &&
            dirtyRegion.y + dirtyRegion.height > bounds.y;
          if (!intersects) {
            return;
          }
        }
      }

      context.save();
      tool.renderLayer(context, layer, {
        image: this.editor.image,
        lineWidth: this.editor.CONSTANTS?.LINE_WIDTH,
      });
      context.restore();
    });
  }

  /**
   * Рисует затемнение и рамку crop‑области.
   * @param {Object|null} dirtyRegion
   */
  renderCropOverlay(dirtyRegion = null) {
    const { layerManager, context, canvas } = this.editor;
    if (!layerManager || !context || !canvas) return;
    const cropLayer = layerManager.layers?.find(l => l.type === 'crop');
    if (!cropLayer || !cropLayer.rect) return;

    const r = cropLayer.rect;

    // Если dirtyRegion не пересекается с cropRect и областями затемнения — можно скипнуть.
    if (dirtyRegion) {
      const intersects =
        dirtyRegion.x < canvas.width &&
        dirtyRegion.x + dirtyRegion.width > 0 &&
        dirtyRegion.y < canvas.height &&
        dirtyRegion.y + dirtyRegion.height > 0;
      if (!intersects) {
        return;
      }
    }

    context.save();
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';

    // верх
    context.fillRect(0, 0, canvas.width, r.y);
    // низ
    context.fillRect(
      0,
      r.y + r.height,
      canvas.width,
      canvas.height - r.y - r.height
    );
    // слева
    context.fillRect(0, r.y, r.x, r.height);
    // справа
    context.fillRect(
      r.x + r.width,
      r.y,
      canvas.width - r.x - r.width,
      r.height
    );

    context.restore();

    // рамка и подпись размеров
    context.save();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.strokeRect(r.x, r.y, r.width, r.height);

    context.fillStyle = '#ffffff';
    context.font = '14px Arial';
    const wText = Helper.formatSize(r.width);
    const hText = Helper.formatSize(r.height);
    context.fillText(
      `${wText} × ${hText}`,
      r.x - 10,
      r.y - 10
    );
    context.restore();
  }
}
