// Tools/BlurTool.js
import BaseTool from './BaseTool.js';

export default class BlurTool extends BaseTool {
    constructor(editor) {
        super(editor, {
            name: 'blur',
            settingsIds: ['blurRadiusLabel']
        });

        this.settings = {
            radius: 6
        }

        this.supportsCreation = true;
    }

    activate() {
        this.overlay.classList.add('blur-mode');
        super.activate();
        const radiusInput = document.getElementById('blurRadius');
        if (radiusInput) this.radius = +radiusInput.value;
    }

    deactivate() {
        super.deactivate();
        this.overlay.classList.remove('blur-mode');
        this.editor.updateToolbarButtons();
    }

    getUISettingsConfig() {
        return {
            fields: [
                {
                    key: 'radius',
                    type: 'range',
                    label: 'Радиус',
                    min: 1,
                    max: 20,
                    value: this.settings.radius,
                    onChange: (value) => this.updateSetting('radius', value)
                },
            ]
        };
    }

    setupOverlay() {
        super.setupOverlay();
        // this.overlay.style.cursor = 'crosshair';
        // this.overlay.style.border = 'none';
        // this.overlay.style.backgroundColor = 'rgba(0,128,255,0.2)';
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
        this.overlay.style.boxSizing = 'border-box';
    }

    cancelOperation() {
        super.cancelOperation();
        this.currentLayer = null;
    }

    /**
     * Обновляет настройку инструмента и применяет её к активному слою, если он текстовый
     * @param {string} key — имя параметра ('textColor', 'textSize')
     * @param {string|number} value — новое значение
     */
    updateSetting(key, value) {
        switch (key) {
            case 'radius':
                this.settings.radius = value;
                break;
            default:
                console.warn(`BlurTool.updateSetting: unknown setting key "${key}"`);
                return;
        }

        // Применяем настройку к активному текстовому слою, если есть
        const activeLayer = this.editor.getActiveLayer();
        if (activeLayer?.type === 'blur') {
            if (key === 'radius') {
                activeLayer.params.radius = value;
            }
            this.editor.render(); // перерисовываем
        }
    }

}