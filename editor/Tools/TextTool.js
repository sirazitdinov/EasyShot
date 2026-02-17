// Tools/TextTool.js
import BaseTool from './BaseTool.js';
import Helper from '../Helper.js';

/**
 * Инструмент для добавления и редактирования текста.
 * Вместо prompt() использует inline-виджет (textarea) поверх canvas.
 */
export default class TextTool extends BaseTool {
    constructor(editor, settings) {
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

        this.updateOverlay();
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
        this.overlay.style.border = '1px dashed #000';
        this.overlay.style.boxSizing = 'border-box';
        this.overlay.style.pointerEvents = 'auto';

        if (!this.previewElement) {
            const el = this.createPreviewElement('textPreview', 'text-mode');
            if (el) {
                this.textPreview = el;
                this.textPreview.style.cursor = 'text';
                this.textPreview.style.position = 'absolute';
                this.textPreview.style.boxSizing = 'border-box';
            }
        } else {
            this.textPreview = this.previewElement;
        }
    }

    updateOverlay() {
        if (!this.overlay || !this.currentLayer?.rect) return;

        const canvas = this.editor?.canvas;
        if (!canvas) return;

        const { x, y, width, height } = this.currentLayer.rect;

        // Используем единую утилиту для конвертации координат канваса в CSS-пиксели
        this.overlay.style.left = `${Helper.toCssPixels(x, canvas)}px`;
        this.overlay.style.top = `${Helper.toCssPixels(y, canvas)}px`;
        this.overlay.style.width = `${Helper.toCssPixels(width, canvas)}px`;
        this.overlay.style.height = `${Helper.toCssPixels(height, canvas)}px`;
        this.overlay.style.display = 'block';
    }

    handleMouseDown(event) { }

    handleMouseMove(event) { }

    handleMouseUp(event) { }

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
                activeLayer.params.fontSize = Number(value);
                activeLayer.rect.height = this.settings.fontSize * 1.5; // чтобы overlay и слой совпадали
            }
            this.currentLayer = activeLayer;
        }

        this.editor.render(); // перерисовываем
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

        // Позиционируем виджет
        const widget = this.textEditorWidget;
        const canvas = this.editor.canvas;
        const { x, y, width, height } = layer.rect;

        // Конвертируем координаты канваса в CSS-пиксели
        const cssX = Helper.toCssPixels(x, canvas);
        const cssY = Helper.toCssPixels(y, canvas);
        const cssWidth = Helper.toCssPixels(width, canvas);
        const cssHeight = Helper.toCssPixels(height, canvas);

        widget.style.left = `${cssX}px`;
        widget.style.top = `${cssY}px`;
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
        } else {
            this.editor.render();
        }

        this.hideTextEditor();
        this.isEditing = false;
    }

    /**
     * Отменяет редактирование без сохранения изменений.
     */
    cancelEditing() {
        if (!this.isEditing) return;

        this.hideTextEditor();
        this.isEditing = false;
        this.editor.render();
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

    cleanupOverlay() {
        if (this.isEditing) {
            this.finishEditing();
        }
        if (this.overlay) {
            this.overlay.classList.remove('text-mode');
            this.overlay.style.cursor = '';
            this.overlay.style.border = '';
            this.overlay.style.pointerEvents = 'auto';
            this.overlay.style.display = '';
        }
        super.cleanupOverlay();
    }
}