// Tools/LineTool.js
import BaseTool from './BaseTool.js';

export default class LineTool extends BaseTool {
    constructor(editor) {
        super(editor, {
            name: 'line',
            settingsIds: ['highlightColorLabel']
        });
        // this.color = '#ff0000';
        this.settings = {
            color: '#ff0000',
            thickness: 2,
            opacity: 1.0
        };

        this.supportsCreation = true;
    }

    activate() {
        super.activate();
        // const colorInput = document.getElementById('highlightColor');
        // if (colorInput) this.color = colorInput.value;
    }

    deactivate() {
        super.deactivate();
        // this.overlay.classList.remove('highlight-mode');
        this.editor.updateToolbarButtons();
    }

    getUISettingsConfig() {
        return {
            fields: [
                {
                    key: 'color',
                    type: 'color',
                    label: 'Цвет линии',
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

    // Метод для обновления настроек (вызывается из UI)
    updateSetting(key, value) {
        if (this.validateSetting(key, value)) {
            this.settings[key] = value;
            this.notifyObservers(); // Уведомить о изменении (Observer pattern)
        }
    }

    // Валидация (например, толщина должна быть положительной)
    validateSetting(key, value) {
        // Логика валидации
    }

    setupOverlay() {
        super.setupOverlay();
        // this.overlay.style.cursor = 'crosshair';
        // this.overlay.innerHTML = `
        //     <div id="linePreview" style="
        //         position: absolute;
        //         top: 0; left: 0;
        //         border: 2px solid ${this.color};
        //         transform-origin: 0 0;
        //         width: 10px; height: 12px;
        //     "></div>
        // `;
        this.linePreview = this.overlay.querySelector('#linePreview');
    }

    updateOverlay() {
        if (!this.linePreview || !this.currentLayer?.points) return;
        const { x1, y1, x2, y2 } = this.currentLayer.points;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        const scale = this.canvas.width / this.canvas.clientWidth;

        this.linePreview.style.left = `${x1 / scale}px`;
        this.linePreview.style.top = `${y1 / scale}px`;
        this.linePreview.style.width = `${len / scale}px`;
        this.linePreview.style.transform = `rotate(${angle}deg)`;
        this.linePreview.style.borderColor = this.color;
    }

    cancelOperation() {
        super.cancelOperation();
        this.currentLayer = null;
        this.linePreview = null;
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
                console.warn(`LineTool.updateSetting: unknown setting key "${key}"`);
                return;
        }

        // Применяем настройку к активному текстовому слою, если есть
        const activeLayer = this.editor.getActiveLayer();
        if (activeLayer?.type === 'line') {
            if (key === 'color') {
                activeLayer.params.color = value;
            } else if (key === 'thickness') {
                activeLayer.params.thickness = value;
            }
            this.editor.render(); // перерисовываем
        }
    }
}