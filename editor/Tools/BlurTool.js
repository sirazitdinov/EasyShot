// Tools/BlurTool.js
import BaseTool from './BaseTool.js';

export default class BlurTool extends BaseTool {
    constructor(editor, settings) {
        super(editor, settings, 'blur', {
            supportsCreation: true,
            settingsIds: ['blurRadiusLabel'],
        });

        this.settings = {
            radius: settings?.radius ?? 6,
        };

        this.currentLayer = null;
        this.isDrawing = false;
    }


    activate() {
        super.activate();

        const radiusInput = document.getElementById('blurRadius');
        if (radiusInput) {
            this.settings.radius = Number(radiusInput.value);
        }

        const activeLayer = this.editor.getActiveLayer?.();
        this.currentLayer = activeLayer?.type === 'blur' ? activeLayer : null;

        this.updateOverlay();
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

    setupOverlay(overlayElement) {
        super.setupOverlay(overlayElement);
        if (!this.overlay) return;

        this.overlay.classList.add('blur-mode');
        this.createPreviewElement('blurPreview', 'blur-mode');
    }

    cleanupOverlay() {
        if (this.overlay) {
            this.overlay.classList.remove('blur-mode');
            // ✅ Сбрасываем стили, чтобы другие инструменты могли работать
            this.overlay.style.cursor = '';
            this.overlay.style.pointerEvents = '';
            this.overlay.style.display = '';
        }
        super.cleanupOverlay();
    }

    /**
     * Обновляет позицию/размер превью по rect слоя
     * @param {{x:number,y:number,width:number,height:number}} rect
     */
    updatePreviewPosition(rect) {
        if (!this.previewElement || !rect) return;
        const canvas = this.editor?.canvas;
        if (!canvas) return;

        const { x, y, width, height } = rect;
        const scale = canvas.clientWidth / canvas.width;

        this.previewElement.style.position = 'absolute';
        this.previewElement.style.left = `${x * scale}px`;
        this.previewElement.style.top = `${y * scale}px`;
        this.previewElement.style.width = `${width * scale}px`;
        this.previewElement.style.height = `${height * scale}px`;
        this.previewElement.style.boxSizing = 'border-box';
        this.previewElement.style.display = 'block';
    }

    updateOverlay() {
        if (!this.previewElement || !this.currentLayer?.rect) {
            if (this.previewElement) {
                this.previewElement.style.display = 'none';
            }
            return;
        }

        this.updatePreviewPosition(this.currentLayer.rect);
    }

    handleMouseDown(event) {
        // За создание слоёв отвечает EditorCore.onOverlayMouseDown
        // if (!this.isActive) return;
    }

    handleMouseMove(event) {
        // if (!this.isActive) return;
    }

    handleMouseUp(event) {
        // if (!this.isActive) return;
    }

    cancelOperation() {
        super.cancelOperation();
        this.currentLayer = null;
        this.isDrawing = false;
        this.updateOverlay();
    }

    /**
     * Обновляет настройку инструмента и применяет её к активному слою blur
     * @param {string} key — имя параметра ('radius')
     * @param {string|number} value — новое значение
     */
    updateSetting(key, value) {
        switch (key) {
            case 'radius':
                this.settings.radius = Number(value);
                break;
            default:
                console.warn(`BlurTool.updateSetting: unknown setting key "${key}"`);
                return;
        }

        const activeLayer = this.editor.getActiveLayer?.();
        if (activeLayer?.type === 'blur') {
            if (key === 'radius') {
                activeLayer.params.radius = this.settings.radius;
            }
            this.currentLayer = activeLayer;
        }

        this.editor.render?.();
        this.updateOverlay();
    }

}