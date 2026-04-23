// Tools/TextTool.js
import BaseTool from './BaseTool.js';
import Helper from '../Helper.js';

/**
 * Инструмент для добавления и редактирования текста.
 * Вместо prompt() использует inline-виджет (textarea) поверх canvas.
 */
export default class TextTool extends BaseTool {
  constructor(editor, settings = {}) {
    super(editor, settings, 'text', {
      supportsCreation: true,
      settingsIds: ['textColorLabel', 'textSizeLabel'],
    });

    this.settings = {
      color: settings.color ?? '#ff0000',
      fontSize: settings.fontSize ?? 16,
    };

    this.currentLayer = null;
    this.isDrawing = false;

    // DOM-элемент inline-редактора текста
    this.textEditorWidget = null;
    this.isEditing = false;
  }

  activate() {
    super.activate();

    const colorInput = document.getElementById('textColor');
    const sizeInput = document.getElementById('textSize');

    if (colorInput) {
      this.settings.color = colorInput.value;
    }
    if (sizeInput) {
      this.settings.fontSize = Number(sizeInput.value);
    }

    const activeLayer = this.editor.getActiveLayer?.();
    this.currentLayer = activeLayer?.type === 'text' ? activeLayer : null;

    // updateOverlay() вызывается в EditorCore.activateTool() после activate()
    this.editor.updateToolbarButtons?.();
  }

  /**
     * Деактивация инструмента с завершением редактирования, если оно идёт.
     */
  deactivate() {
    if (this.isEditing) {
      this.finishEditing();
    }
    super.deactivate();
    this.editor.updateToolbarButtons();
  }

  getUISettingsConfig() {
    return {
      fields: [
        {
          key: 'textColor',
          type: 'color',
          label: 'Цвет',
          value: this.settings.color,
          onChange: (value) => this.updateSetting('textColor', value)
        },
        {
          key: 'textSize',
          type: 'range',
          label: 'Размер',
          min: 1,
          max: 72,
          value: this.settings.fontSize,
          onChange: (value) => this.updateSetting('textSize', value)
        },
      ]
    };
  }

  setupOverlay(overlayElement) {
    super.setupOverlay(overlayElement);
    if (!this.overlay) return;

    this.overlay.classList.add('text-mode');
    this.overlay.style.cursor = 'text';
    this.overlay.style.pointerEvents = 'auto';
    this.overlay.style.display = 'block';

    // textPreview не нужен — сам overlay служит индикатором позиции текста
    this.textPreview = null;
  }

  /**
     * Обновляет позицию overlay текстового слоя
     */
  updateOverlay() {
    if (!this.overlay) {
      return;
    }

    const canvas = this.editor?.canvas;
    if (!canvas) {
      return;
    }

    // Если есть текущий текстовый слой, позиционируем overlay по нему
    if (this.currentLayer?.rect && this.currentLayer.type === 'text') {
      const { x, y, width, height } = this.currentLayer.rect;

      // Используем единую утилиту для конвертации координат канваса в CSS-пиксели
      this.overlay.style.left = `${Helper.toCssPixels(x, canvas)}px`;
      this.overlay.style.top = `${Helper.toCssPixels(y, canvas)}px`;
      this.overlay.style.width = `${Helper.toCssPixels(width, canvas)}px`;
      this.overlay.style.height = `${Helper.toCssPixels(height, canvas)}px`;
      this.overlay.style.display = 'block';
    } else {
      // Если нет текущего слоя, показываем overlay на весь canvas для создания нового слоя
      this.overlay.style.left = '0';
      this.overlay.style.top = '0';
      this.overlay.style.width = `${canvas.clientWidth}px`;
      this.overlay.style.height = `${canvas.clientHeight}px`;
      this.overlay.style.display = 'block';
    }
  }

  handleMouseDown(event) { }

  handleMouseMove(event) { }

  handleMouseUp(event) {
    // Начинаем редактирование только если слой создан и еще не редактируется
    // Проверяем, что это был drag для создания/изменения размера
    if (this.currentLayer && !this.isEditing && this.editor.dragState?.handle === 'create') {
      // Небольшая задержка, чтобы убедиться, что размер установлен окончательно
      setTimeout(() => {
        this.editText(this.currentLayer);
      }, 0);
    }
  }

  cancelOperation() {
    super.cancelOperation();
    this.currentLayer = null;
    this.isDrawing = false;
    this.updateOverlay();
  }

  /**
     * Обновляет настройку инструмента и применяет её к активному слою, если он текстовый
     * @param {string} key — имя параметра ('textColor', 'textSize')
     * @param {string|number} value — новое значение
     */
  updateSetting(key, value) {
    switch (key) {
      case 'textColor':
        this.settings.color = value;
        break;
      case 'textSize':
        this.settings.fontSize = Number(value);
        break;
      default:
        console.warn(`TextTool.updateSetting: unknown setting key "${key}"`);
        return;
    }

    // Применяем настройку к активному текстовому слою, если есть
    const activeLayer = this.editor.getActiveLayer?.();
    if (activeLayer?.type === 'text') {
      if (key === 'textColor') {
        activeLayer.params.color = value;
      } else if (key === 'textSize') {
        const oldFontSize = activeLayer.params.fontSize;
        activeLayer.params.fontSize = Number(value);
        // Масштабируем высоту пропорционально изменению размера шрифта
        const scale = activeLayer.params.fontSize / oldFontSize;
        activeLayer.rect.height *= scale;
      }
      // Не устанавливаем currentLayer, чтобы overlay не позиционировался по слою
      // currentLayer используется только во время редактирования
    }

    // Сначала перерисовываем canvas, затем обновляем overlay
    this.editor.render();
    this.updateOverlay();
  }

  /**
     * Показывает inline-виджет для редактирования текста.
     * Создаёт textarea поверх canvas в позиции текстового слоя.
     * @param {Object} layer — текстовый слой для редактирования
     */
  editText(layer) {
    if (this.isEditing) {
      this.hideTextEditor();
      return;
    }

    this.isEditing = true;
    this.currentLayer = layer;

    // Скрываем overlay во время редактирования
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }

    // Создаём виджет, если ещё не создан
    if (!this.textEditorWidget) {
      this.textEditorWidget = document.createElement('textarea');
      this.textEditorWidget.className = 'text-editor-widget';
      this.textEditorWidget.addEventListener('blur', () => this.finishEditing());
      this.textEditorWidget.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.finishEditing();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelEditing();
        }
      });
      this.editor.canvas.parentElement.appendChild(this.textEditorWidget);
    }

    // Позиционируем виджет точно по координатам слоя
    const widget = this.textEditorWidget;
    const canvas = this.editor.canvas;
    const { x, y, width, height } = layer.rect;

    // Используем CSS-пиксели канваса напрямую (без DPR)
    const scaleFactor = canvas.clientWidth / canvas.width;
    const cssX = x * scaleFactor;
    const cssY = y * scaleFactor;
    const cssWidth = width * scaleFactor;
    const cssHeight = height * scaleFactor;

    // Учитываем border виджета для точного позиционирования
    widget.style.left = `${cssX - 2}px`; // -2px для border
    widget.style.top = `${cssY - 2}px`; // -2px для border
    widget.style.width = `${cssWidth}px`;
    widget.style.minHeight = `${cssHeight}px`;
    widget.value = layer.params.text || '';
    widget.style.color = layer.params.color || '#000000';
    widget.style.fontSize = `${layer.params.fontSize || 16}px`;
    widget.style.display = 'block';
    widget.focus();
    widget.select();
  }

  /**
     * Завершает редактирование: сохраняет текст в слой и добавляет в историю.
     */
  finishEditing() {
    if (!this.isEditing || !this.currentLayer) return;

    const newText = this.textEditorWidget?.value?.trim() || '';

    if (this.editor.historyManager) {
      this.editor.historyManager.commit('Edit text');
    }

    this.currentLayer.params.text = newText;

    // Если текст пустой, можно удалить слой (опционально)
    if (!newText) {
      this.editor.layerManager.deleteActiveLayer();
      this.currentLayer = null;
    } else {
      this.editor.render();
    }

    this.hideTextEditor();
    this.isEditing = false;

    // После завершения редактирования сбрасываем currentLayer и показываем overlay на весь холст
    // для возможности создания нового текста
    this.currentLayer = null;
    this.updateOverlay();
  }

  /**
     * Отменяет редактирование без сохранения изменений.
     */
  cancelEditing() {
    if (!this.isEditing) return;

    this.hideTextEditor();
    this.isEditing = false;
    this.editor.render();

    // Сбрасываем currentLayer и показываем overlay на весь холст
    this.currentLayer = null;
    this.updateOverlay();
  }

  /**
     * Скрывает виджет редактирования текста.
     */
  hideTextEditor() {
    if (this.textEditorWidget) {
      this.textEditorWidget.style.display = 'none';
      this.textEditorWidget.value = '';
    }
  }

  /**
     * Очищает overlay текстового инструмента
     */
  cleanupOverlay() {
    if (this.isEditing) {
      this.finishEditing();
    }
    if (this.overlay) {
      this.overlay.classList.remove('text-mode');
      this.overlay.style.cursor = '';
      this.overlay.style.pointerEvents = 'auto';
      // Не сбрасываем display, чтобы overlay оставался видимым для других инструментов
      this.overlay.style.display = 'block';
      // Сбрасываем позиционирование
      this.overlay.style.left = '0';
      this.overlay.style.top = '0';
      this.overlay.style.width = '';
      this.overlay.style.height = '';
    }
    // Скрываем preview элемент
    if (this.previewElement) {
      this.previewElement.style.display = 'none';
    }
    // Вызываем базовую очистку для удаления previewElement
    super.cleanupOverlay();
    this.textPreview = null;
  }
}