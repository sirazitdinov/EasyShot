// Tools/LineTool.js
import BaseTool from './BaseTool.js';
import Helper from '../Helper.js';
import * as lineRenderer from '../renderers/lineRenderer.js';

export default class LineTool extends BaseTool {
  constructor(editor, settings = {}) {
    super(editor, settings, 'line', { supportsCreation: true });

    this.settings = {
      color: settings.color ?? '#ff0000',
      thickness: settings.thickness ?? 2,
    };

    this.currentLayer = null;
  }

  activate() {
    super.activate();

    const colorInput = document.getElementById('highlightColor');
    if (colorInput) {
      const activeLayer = this.editor.getActiveLayer?.();
      if (activeLayer?.type === 'line') {
        this.settings.color = activeLayer.params.color ?? colorInput.value;
        this.settings.thickness =
                    activeLayer.params.thickness ?? this.settings.thickness;
      } else {
        this.settings.color = colorInput.value;
      }
    }

    const activeLayer = this.editor.getActiveLayer?.();
    this.currentLayer = activeLayer?.type === 'line' ? activeLayer : null;

    // updateOverlay() вызывается в EditorCore.activateTool() после activate()
    this.editor.updateToolbarButtons?.();
  }

  deactivate() {
    super.deactivate();
    this.editor.updateToolbarButtons?.();
  }

  getUISettingsConfig() {
    return {
      fields: [
        {
          key: 'color',
          type: 'color',
          label: 'Цвет линии',
          value: this.settings.color,
          onChange: (value) => this.updateSetting('color', value),
        },
        {
          key: 'thickness',
          type: 'range',
          label: 'Толщина',
          min: 1,
          max: 10,
          value: this.settings.thickness,
          onChange: (value) => this.updateSetting('thickness', value),
        },
      ],
    };
  }

  setupOverlay(overlayElement) {
    super.setupOverlay(overlayElement);
    if (!this.overlay) return;

    this.overlay.classList.add('line-mode');
    this.overlay.style.cursor = 'crosshair';
    this.overlay.style.border = 'none';
    this.overlay.style.pointerEvents = 'auto';

    // Preview-бокс для линии не используется — выделение работает через hit-test
    // Оставляем возможность создания в будущем при необходимости
  }

  cleanupOverlay() {
    if (this.overlay) {
      this.overlay.classList.remove('line-mode');
      this.overlay.style.cursor = '';
      this.overlay.style.border = '';
      this.overlay.style.pointerEvents = 'auto';
      this.overlay.style.display = '';
    }

    super.cleanupOverlay();
  }

  updateOverlay() {
    // Preview-бокс не используется для линий
    // Выделение и перемещение работают через hit-test в EditorCore
  }

  handleMouseDown(event) {
    // За создание слоёв отвечает EditorCore.onOverlayMouseDown
    // if (!this.isActive) return;
  }

  handleMouseMove(event) { }

  handleMouseUp(event) {
    // if (!this.isActive) return;
  }

  cancelOperation() {
    super.cancelOperation();
    this.currentLayer = null;
    this.isDrawing = false;
  }

  /**
     * Обновляет настройку инструмента и применяет её к активному слою, если он линейный
     * @param {string} key — 'color' | 'thickness'
     * @param {string|number} value
     */
  updateSetting(key, value) {
    switch (key) {
      case 'color':
        this.settings.color = value;
        break;
      case 'thickness':
        this.settings.thickness = Number(value);
        break;
      default:
        console.warn(`LineTool.updateSetting: unknown setting key "${key}"`);
        return;
    }

    const activeLayer = this.editor.getActiveLayer?.();
    if (activeLayer?.type === 'line') {
      if (key === 'color') {
        activeLayer.params.color = value;
      } else if (key === 'thickness') {
        activeLayer.params.thickness = Number(value);
      }
      this.currentLayer = activeLayer;
      this.editor.render();
    }

    this.updateOverlay();
  }

  renderLayer(ctx, layer, options = {}) {
    lineRenderer.render(ctx, layer, { lineWidth: this.editor?.CONSTANTS?.LINE_WIDTH, ...options });
  }

  hitTest(point, layer) {
    return lineRenderer.hitTest(point, layer);
  }

  getBounds(layer) {
    if (!layer.points) return null;
    const { x1, y1, x2, y2 } = layer.points;
    const thickness = layer.params?.thickness ?? 2;
    const padding = Math.max(12, thickness + 5);
    const minX = Math.min(x1, x2) - padding;
    const minY = Math.min(y1, y2) - padding;
    const maxX = Math.max(x1, x2) + padding;
    const maxY = Math.max(y1, y2) + padding;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}