// Tools/HighlightTool.js
import BaseTool from './BaseTool.js';
import Helper from '../Helper.js';

export default class HighlightTool extends BaseTool {
    constructor(editor, settings) {
        super(editor, settings, 'highlight', {
            supportsCreation: true,
            settingsIds: ['highlightColorLabel'] // если реально используется
        });

        this.settings = {
            color: settings?.color ?? '#ff0000',
            thickness: settings?.thickness ?? 2
        };
    }

    activate() {
        super.activate();

        const colorInput = document.getElementById('highlightColor');
        if (colorInput) {
            const activeLayer = this.editor.getActiveLayer?.();
            if (activeLayer?.type === 'highlight') {
                this.settings.color = activeLayer.params.color ?? colorInput.value;
                this.settings.thickness = activeLayer.params.thickness ?? this.settings.thickness;
            } else {
                this.settings.color = colorInput.value;
            }
        }

        const activeLayer = this.editor.getActiveLayer?.();
        this.currentLayer = activeLayer?.type === 'highlight' ? activeLayer : null;

        // updateOverlay() вызывается в EditorCore.activateTool() после activate()
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
                    key: 'thickness',
                    type: 'range',
                    label: 'Толщина',
                    min: 1,
                    max: 10,
                    value: this.settings.thickness,
                    onChange: (value) => this.updateSetting('thickness', value)
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

        this.overlay.classList.add('highlight-mode');
        this.overlay.style.cursor = 'crosshair';
        this.overlay.style.border = 'none';
        // this.overlay.style.backgroundColor = 'transparent';
        this.overlay.style.pointerEvents = 'auto';

        if (!this.previewElement) {
            const el = this.createPreviewElement('highlightPreview', 'highlight-preview');
            if (el) {
                // this.highlightPreview = el;
                // this.highlightPreview.style.cursor = 'crosshair';
                // this.highlightPreview.style.border = 'none';
                // this.highlightPreview.style.backgroundColor = 'transparent';
                // this.highlightPreview.style.pointerEvents = 'auto';
            }
        }
    }

    updateOverlay() {
        const canvas = this.editor?.canvas;
        if (!canvas || !this.previewElement) return;

        // Всегда берем актуальный активный слой из редактора
        const activeLayer = this.editor.getActiveLayer?.();
        const layer = (activeLayer?.type === 'highlight') ? activeLayer : this.currentLayer;

        // Если есть слой выделения с rect - показываем рамку
        if (layer?.rect) {
            const { x, y, width, height } = layer.rect;

            const el = this.previewElement;
            el.style.position = 'absolute';
            // Используем единую утилиту для конвертации координат канваса в CSS-пиксели
            el.style.left = `${Helper.toCssPixels(x, canvas)}px`;
            el.style.top = `${Helper.toCssPixels(y, canvas)}px`;
            el.style.width = `${Helper.toCssPixels(width, canvas)}px`;
            el.style.height = `${Helper.toCssPixels(height, canvas)}px`;
            el.style.border = `2px dashed ${this.settings.color}`;
            // el.style.backgroundColor = `${this.settings.color}33`;
            el.style.boxSizing = 'border-box';
            el.style.display = 'block';
        } else {
            // Если нет активного слоя выделения - скрываем рамку
            this.previewElement.style.display = 'none';
        }
    }

    cleanupOverlay() {
        if (this.overlay) {
            this.overlay.classList.remove('highlight-mode');
            // ✅ Сбрасываем стили, чтобы другие инструменты могли работать
            this.overlay.style.cursor = '';
            this.overlay.style.border = '';
            // this.overlay.style.backgroundColor = '';
            this.overlay.style.pointerEvents = 'auto'; // ✅ Возвращаем в исходное состояние для работы других инструментов
            this.overlay.style.display = '';
        }
        // Скрываем preview элемент
        if (this.previewElement) {
            this.previewElement.style.display = 'none';
        }
        super.cleanupOverlay();
    }

    /**
     * Обновляет настройку инструмента и применяет её к активному слою, если он текстовый
     * @param {string} key — имя параметра ('textColor', 'textSize')
     * @param {string|number} value — новое значение
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
                console.warn('HighlightTool.updateSetting unknown setting key', key);
                return;
        }

        const activeLayer = this.editor.getActiveLayer();
        if (activeLayer?.type === 'highlight') {
            if (key === 'color') {
                activeLayer.params.color = value;
            } else if (key === 'thickness') {
                activeLayer.params.thickness = Number(value);
            }
            this.editor.render();
        }

        this.updateOverlay();
    }
}