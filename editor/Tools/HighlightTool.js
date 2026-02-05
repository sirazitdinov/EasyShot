// Tools/HighlightTool.js
import BaseTool from './BaseTool.js';

export default class HighlightTool extends BaseTool {
    constructor(editor) {
        super(editor, {
            name: 'highlight',
            settingsIds: ['highlightColorLabel']
        });

        this.settings = {
            color: '#ff0000',
            thickness: 2,
        };
        this.color = '#ff0000';

        this.supportsCreation = true;

    }

    activate() {
        this.overlay.classList.add('highlight-mode');
        super.activate();
        const colorInput = document.getElementById('highlightColor');
        if (colorInput) {
            // Установить цвет из активного слоя, если он есть
            const activeLayer = this.editor.getActiveLayer();
            if (activeLayer?.type === 'highlight') {
                this.settings.color = activeLayer.params.color;
                colorInput.value = this.settings.color;
                this.editor.updateToolbarButtons();
            } else {
                this.settings.color = colorInput.value;
            }
        }
    }

    deactivate() {
        super.deactivate();
        this.overlay.classList.remove('highlight-mode');
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

    setupOverlay() {
        super.setupOverlay();
        // this.overlay.style.cursor = 'crosshair';
        // this.overlay.style.border = 'none';
        // this.overlay.style.backgroundColor = 'transparent';
        // this.overlay.style.pointerEvents = 'auto'; // Важно для получения событий
    }

    updateOverlay() {
        if (!this.currentLayer?.rect) return;

        const { x, y, width, height } = this.currentLayer.rect;
        const scale = this.canvas.width / this.canvas.clientWidth;

        this.overlay.style.left = `${x / scale}px`;
        this.overlay.style.top = `${y / scale}px`;
        this.overlay.style.width = `${width / scale}px`;
        this.overlay.style.height = `${height / scale}px`;
        this.overlay.style.border = `2px dashed ${this.color}`;
        this.overlay.style.backgroundColor = this.color + '33'; // 20% opacity (hex + alpha)
        this.overlay.style.boxSizing = 'border-box';
        this.overlay.style.display = 'block';
    }

    cancelOperation() {
        super.cancelOperation();
        this.currentLayer = null;
        this.cleanupOverlay();
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
                this.settings.fontSize = value;
                break;
            default:
                console.warn(`HighlightTool.updateSetting: unknown setting key "${key}"`);
                return;
        }

        // Применяем настройку к активному текстовому слою, если есть
        const activeLayer = this.editor.getActiveLayer();
        if (activeLayer?.type === 'highlight') {
            if (key === 'color') {
                activeLayer.params.color = value;
            } else if (key === 'thickness') {
                activeLayer.params.thickness = value;
            }
            this.editor.render(); // перерисовываем
        }
    }

    // Применение кропа
    applyToCroppedCanvas(ctx, layer, cropX, cropY, cropWidth, cropHeight) {
        // Кроп не применяется к самому себе, этот метод не нужен
        if (!this.currentLayer?.rect) return;

        const { x, y, width, height } = this.currentLayer.rect;
        const scale = this.canvas.width / this.canvas.clientWidth;

        // смещённые координаты относительно кропа
        const shiftedX = layer.rect.x - cropX;
        const shiftedY = layer.rect.y - cropY;
        const shiftedR = shiftedX + layer.rect.width;
        const shiftedB = shiftedY + layer.rect.height;

        // Границы кроп-области
        const cropLeft = 0, cropTop = 0, cropRight = cropWidth, cropBottom = cropHeight;

        // Находим пересечение (видимую часть)
        const visibleLeft = Math.max(cropLeft, shiftedX);
        const visibleTop = Math.max(cropTop, shiftedY);
        const visibleRight = Math.min(cropRight, shiftedR);
        const visibleBottom =  Math.min(cropBottom, shiftedB);
        const visibleWidth = visibleRight - visibleLeft;
        const visibleHeight = visibleBottom - visibleTop;

        // Пропускаем, если пересечения нет
        if (visibleWidth <= 0 || visibleHeight <= 0) return;

        tempCtx.save();
        tempCtx.beginPath();
        tempCtx.rect(0, 0, cropWidth, cropHeight); // clip к области кропа
        tempCtx.clip();

        // Рисуем видимую часть контура внутри кропа
        tempCtx.strokeRect(shiftedX, shiftedY, layer.rect.width, layer.rect.height);
        tempCtx.restore();
    }
}