// Tools/RectangleTool.js
import BaseTool from './BaseTool.js';
import Helper from '../Helper.js';

export default class RectangleTool extends BaseTool {
    constructor(editor, settings) {
        super(editor, settings, 'rectangle', {
            supportsCreation: true,
            settingsIds: ['highlightColorLabel', 'thicknessLabel']
        });

        this.settings = {
            color: '#ff0000',
            thickness: 2
        };

        this.currentLayer = null;
    }

    activate() {
        super.activate();

        const colorInput = document.getElementById('highlightColor');
        const thicknessInput = document.getElementById('thickness');

        if (colorInput) {
            const activeLayer = this.editor.getActiveLayer?.();
            if (activeLayer?.type === 'rectangle') {
                this.settings.color = activeLayer.params.color ?? colorInput.value;
            } else {
                this.settings.color = colorInput.value;
            }
        }

        if (thicknessInput) {
            const activeLayer = this.editor.getActiveLayer?.();
            if (activeLayer?.type === 'rectangle') {
                this.settings.thickness = activeLayer.params.thickness ?? Number(thicknessInput.value);
            } else {
                this.settings.thickness = Number(thicknessInput.value);
            }
        }

        const activeLayer = this.editor.getActiveLayer?.();
        this.currentLayer = activeLayer?.type === 'rectangle' ? activeLayer : null;

        this.editor.updateToolbarButtons();
    }

    deactivate() {
        super.deactivate();
        this.editor.updateToolbarButtons();
    }

    getUISettingsConfig() {
        const thicknessInput = document.getElementById('thickness');
        const colorInput = document.getElementById('highlightColor');
        
        return {
            fields: [
                {
                    key: 'color',
                    type: 'color',
                    label: 'Цвет',
                    value: colorInput ? colorInput.value : this.settings.color,
                    onChange: (value) => this.updateSetting('color', value)
                },
                {
                    key: 'thickness',
                    type: 'range',
                    label: 'Толщина',
                    min: 1,
                    max: 10,
                    value: thicknessInput ? Number(thicknessInput.value) : this.settings.thickness,
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

        this.overlay.classList.add('rectangle-mode');
        this.overlay.style.cursor = 'crosshair';
        this.overlay.style.border = 'none';
        this.overlay.style.pointerEvents = 'auto';

        if (!this.previewElement) {
            const el = this.createPreviewElement('rectanglePreview', 'rectangle-preview');
            if (el) {
                // preview элемент создан
            }
        }
    }

    /**
     * Обновляет позицию preview прямоугольника
     */
    updateOverlay() {
        const canvas = this.editor?.canvas;
        if (!canvas || !this.previewElement) return;

        const activeLayer = this.editor.getActiveLayer?.();
        const layer = (activeLayer?.type === 'rectangle') ? activeLayer : this.currentLayer;

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
            this.overlay.classList.remove('rectangle-mode');
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

    updateSetting(key, value) {
        switch (key) {
            case 'color':
                this.settings.color = value;
                break;
            case 'thickness':
                this.settings.thickness = Number(value);
                break;
            default:
                console.warn('RectangleTool.updateSetting unknown setting key', key);
                return;
        }

        const activeLayer = this.editor.getActiveLayer();
        if (activeLayer?.type === 'rectangle') {
            if (key === 'color') {
                activeLayer.params.color = value;
            } else if (key === 'thickness') {
                activeLayer.params.thickness = Number(value);
            }
            this.editor.render();
        }

        // Обновляем значение input элемента
        const inputElement = document.getElementById(key === 'thickness' ? 'thickness' : 'highlightColor');
        if (inputElement) {
            inputElement.value = value;
            // Для range обновляем отображение значения
            const valueDisplay = inputElement.parentElement.querySelector('.range-value');
            if (valueDisplay) {
                valueDisplay.textContent = value;
            }
        }

        this.updateOverlay();
    }
}
