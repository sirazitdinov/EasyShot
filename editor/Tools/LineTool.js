// Tools/LineTool.js
import BaseTool from './BaseTool.js';
import Helper from '../Helper.js';

export default class LineTool extends BaseTool {
    constructor(editor, settings = {}) {
        super(editor, settings, 'line', { supportsCreation: true });

        this.settings = {
            color: settings.color ?? '#ff0000',
            thickness: settings.thickness ?? 2,
        };

        this.currentLayer = null;
        this.linePreview = null;
    }

    activate() {
        super.activate();

        const colorInput = document.getElementById('highlightColor');
        if (colorInput) {
            const activeLayer = this.editor.getActiveLayer?.();
            if (activeLayer?.type === 'line') {
                this.settings.color = activeLayer.params.color ?? colorInput.value;
                this.settings.thickness =
                    activeLayer.params.thickness ?? this.settings.thickness;
            } else {
                this.settings.color = colorInput.value;
            }
        }

        const activeLayer = this.editor.getActiveLayer?.();
        this.currentLayer = activeLayer?.type === 'line' ? activeLayer : null;

        // updateOverlay() вызывается в EditorCore.activateTool() после activate()
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
                    key: 'color',
                    type: 'color',
                    label: 'Цвет линии',
                    value: this.settings.color,
                    onChange: (value) => this.updateSetting('color', value),
                },
                {
                    key: 'thickness',
                    type: 'range',
                    label: 'Толщина',
                    min: 1,
                    max: 10,
                    value: this.settings.thickness,
                    onChange: (value) => this.updateSetting('thickness', value),
                },
            ],
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

    setupOverlay(overlayElement) {
        super.setupOverlay(overlayElement);
        if (!this.overlay) return;

        this.overlay.classList.add('line-mode');
        this.overlay.style.cursor = 'crosshair';
        this.overlay.style.border = 'none';
        // this.overlay.style.backgroundColor = 'transparent';
        this.overlay.style.pointerEvents = 'auto';

        // создаём DOM-превью через общий механизм BaseTool
        if (!this.previewElement) {
            const el = this.createPreviewElement('linePreview', 'line-preview');
            if (el) {
                this.linePreview = el;
                this.linePreview.style.position = 'absolute';
                this.linePreview.style.top = '0';
                this.linePreview.style.left = '0';
                this.linePreview.style.transformOrigin = '0 0';
                this.linePreview.style.height = '1px';
                this.linePreview.style.borderStyle = 'solid';
                this.linePreview.style.display = 'none';
            }
        } else {
            this.linePreview = this.previewElement;
        }

        this.updateOverlay();
    }

    cleanupOverlay() {
        if (this.overlay) {
            this.overlay.classList.remove('line-mode');
            // ✅ Сбрасываем стили, чтобы другие инструменты могли работать
            this.overlay.style.cursor = '';
            this.overlay.style.border = '';
            this.overlay.style.pointerEvents = 'auto'; // ✅ Возвращаем в исходное состояние для работы других инструментов
            this.overlay.style.display = '';
        }

        this.linePreview = null;

        super.cleanupOverlay();
    }

    updateOverlay() {
        if (!this.linePreview || !this.currentLayer?.points) {
            if (this.linePreview) {
                this.linePreview.style.display = 'none';
            }
            return;
        }

        const canvas = this.editor?.canvas;
        if (!canvas) return;

        const {x1, y1, x2, y2} = this.currentLayer.points;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        // Используем единую утилиту для конвертации координат канваса в CSS-пиксели
        this.linePreview.style.left = `${Helper.toCssPixels(x1, canvas)}px`;
        this.linePreview.style.top = `${Helper.toCssPixels(y1, canvas)}px`;
        this.linePreview.style.width = `${Helper.toCssPixels(len, canvas)}px`;
        this.linePreview.style.transform = `rotate(${angle}deg)`;
        this.linePreview.style.borderColor = this.settings.color;
        this.linePreview.style.borderWidth = `${this.settings.thickness}px`;
        this.linePreview.style.display = 'block';
    }

    handleMouseDown(event) {
        // За создание слоёв отвечает EditorCore.onOverlayMouseDown
        // if (!this.isActive) return;
    }

    handleMouseMove(event) { }

    handleMouseUp(event) {
        // if (!this.isActive) return;
    }

    cancelOperation() {
        super.cancelOperation();
        this.currentLayer = null;
        this.isDrawing = false;
        if (this.linePreview) this.linePreview.style.display = 'none';
    }

    /**
     * Обновляет настройку инструмента и применяет её к активному слою, если он линейный
     * @param {string} key — 'color' | 'thickness'
     * @param {string|number} value
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
                console.warn(`LineTool.updateSetting: unknown setting key "${key}"`);
                return;
        }

        const activeLayer = this.editor.getActiveLayer?.();
        if (activeLayer?.type === 'line') {
            if (key === 'color') {
                activeLayer.params.color = value;
            } else if (key === 'thickness') {
                activeLayer.params.thickness = Number(value);
            }
            this.currentLayer = activeLayer;
            this.editor.render();
        }

        this.updateOverlay();
    }
}