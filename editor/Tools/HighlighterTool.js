// Tools/HighlighterTool.js
import BaseTool from './BaseTool.js';
import Helper from '../Helper.js';
import * as highlighterRenderer from '../renderers/highlighterRenderer.js';

export default class HighlighterTool extends BaseTool {
  constructor(editor, settings = {}) {
    super(editor, settings, 'highlighter', {
      supportsCreation: true,
      settingsIds: ['highlighterColorLabel', 'highlighterOpacityLabel']
    });

    this.settings = {
      color: settings?.color ?? '#FFA500',
      opacity: settings?.opacity ?? 0.3
    };

    this.currentLayer = null;
  }

  activate() {
    super.activate();

    const activeLayer = this.editor.getActiveLayer?.();
    if (activeLayer?.type === 'highlighter') {
      this.settings.color = activeLayer.params.color ?? '#FFA500';
      this.settings.opacity = activeLayer.params.opacity ?? 0.3;
    }

    this.currentLayer = activeLayer?.type === 'highlighter' ? activeLayer : null;

    this.editor.updateToolbarButtons();
  }

  deactivate() {
    super.deactivate();
    this.editor.updateToolbarButtons();
  }

  getUISettingsConfig() {
    return {
      fields: [
        {
          key: 'color',
          type: 'color',
          label: 'Цвет',
          value: this.settings.color,
          onChange: (value) => this.updateSetting('color', value)
        },
        {
          key: 'opacity',
          type: 'range',
          label: 'Прозрачность',
          min: 0.1,
          max: 1,
          step: 0.1,
          value: this.settings.opacity,
          onChange: (value) => this.updateSetting('opacity', value)
        },
      ]
    };
  }

  getSettings() {
    return this.settings;
  }

  setupOverlay(overlayElement) {
    super.setupOverlay(overlayElement);
    if (!this.overlay) return;

    this.overlay.classList.add('highlighter-mode');
    this.overlay.style.cursor = 'crosshair';
    this.overlay.style.border = 'none';
    this.overlay.style.pointerEvents = 'auto';

    if (!this.previewElement) {
      const el = this.createPreviewElement('highlighterPreview', 'highlighter-preview');
      if (el) {
        // preview element создан
      }
    }
  }

  updateOverlay() {
    const canvas = this.editor?.canvas;
    if (!canvas || !this.previewElement) return;

    const activeLayer = this.editor.getActiveLayer?.();
    const layer = (activeLayer?.type === 'highlighter') ? activeLayer : this.currentLayer;

    if (layer?.rect) {
      const { x, y, width, height } = layer.rect;

      const el = this.previewElement;
      el.style.position = 'absolute';
      el.style.left = `${Helper.toCssPixels(x, canvas)}px`;
      el.style.top = `${Helper.toCssPixels(y, canvas)}px`;
      el.style.width = `${Helper.toCssPixels(width, canvas)}px`;
      el.style.height = `${Helper.toCssPixels(height, canvas)}px`;
      el.style.border = `2px dashed ${this.settings.color}`;
      el.style.boxSizing = 'border-box';
      el.style.display = 'block';
    } else {
      this.previewElement.style.display = 'none';
    }
  }

  /**
     * Очищает overlay инструмента
     */
  cleanupOverlay() {
    if (this.overlay) {
      this.overlay.classList.remove('highlighter-mode');
      this.overlay.style.cursor = '';
      this.overlay.style.border = '';
      this.overlay.style.pointerEvents = 'auto';
      this.overlay.style.display = '';
    }
    // Скрываем preview элемент
    if (this.previewElement) {
      this.previewElement.style.display = 'none';
    }
    super.cleanupOverlay();
  }

  /**
     * Обновляет настройку инструмента и применяет её к активному слою highlighter
     * @param {string} key — имя параметра ('color', 'opacity')
     * @param {string|number} value — новое значение
     */
  updateSetting(key, value) {
    switch (key) {
      case 'color':
        this.settings.color = value;
        break;
      case 'opacity':
        this.settings.opacity = Number(value);
        break;
      default:
        console.warn('HighlighterTool.updateSetting unknown setting key', key);
        return;
    }

    const activeLayer = this.editor.getActiveLayer();
    if (activeLayer?.type === 'highlighter') {
      if (key === 'color') {
        activeLayer.params.color = value;
      } else if (key === 'opacity') {
        activeLayer.params.opacity = Number(value);
      }
      this.editor.render();
    }

    // Обновляем значение input элемента, созданного ToolSettingsUI
    const inputElement = document.getElementById(key);
    if (inputElement) {
      inputElement.value = value;
      // Для range обновляем отображение значения
      const valueDisplay = inputElement.parentElement?.querySelector('.range-value');
      if (valueDisplay) {
        valueDisplay.textContent = value;
      }
    }

    this.updateOverlay();
  }

  renderLayer(ctx, layer, options = {}) {
    highlighterRenderer.render(ctx, layer, options);
  }

  hitTest(point, layer) {
    return highlighterRenderer.hitTest(point, layer);
  }

  getBounds(layer) {
    if (!layer.rect) return null;
    return { x: layer.rect.x, y: layer.rect.y, width: layer.rect.width, height: layer.rect.height };
  }
}
