// Tools/TextTool.js
import BaseTool from './BaseTool.js';
import Helper from '../Helper.js';

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

    deactivate() {
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
        // this.overlay.style.backgroundColor = 'transparent';
        this.overlay.style.boxSizing = 'border-box';
        this.overlay.style.pointerEvents = 'auto'; // ✅ Должно быть 'auto' для создания слоя

        // создаём DOM-превью через общий механизм BaseTool
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

    cleanupOverlay() {
        if (this.overlay) {
            this.overlay.classList.remove('text-mode');
            // ✅ Сбрасываем стили, чтобы другие инструменты могли работать
            this.overlay.style.cursor = '';
            this.overlay.style.border = '';
            this.overlay.style.pointerEvents = 'auto'; // ✅ Возвращаем в исходное состояние для работы других инструментов
            this.overlay.style.display = '';
        }
        super.cleanupOverlay();
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

    editText(layer) {
        const newText = prompt('Введите текст:', layer.params.text || '');
        if (newText !== null) {
            if (this.editor.historyManager) {
                this.editor.historyManager.clear();
                this.editor.historyManager.commit('Initial canvas');
            }

            layer.params.text = newText;
            this.editor.render();

            this.currentLayer = layer;
            this.updateOverlay();
        }
    }
}