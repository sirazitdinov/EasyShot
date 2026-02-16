// Tools/CropTool.js
import BaseTool from './BaseTool.js';

export default class CropTool extends BaseTool {
    constructor(editor, settings) {
        // name и supportsCreation задаём через options, как для других инструментов
        super(editor, settings, 'crop', { supportsCreation: true });
    }

    activate() {
        super.activate();

        const activeLayer = this.editor.getActiveLayer?.();
        this.currentLayer = activeLayer?.type === 'crop' ? activeLayer : null;

        this.updateOverlay();
        this.editor.updateToolbarButtons?.();
    }

    deactivate() {
        super.deactivate();
    }

    getUISettingsConfig() {
        return {
            fields: []
        };
    }

    setupOverlay(overlayElement) {
        super.setupOverlay(overlayElement);
        if (!overlayElement) return;

        // overlayElement.classList.add('crop-mode');
        // overlayElement.style.cursor = 'crosshair';
        this.createPreviewElement('cropPreview', 'crop-mode');
    }

    cleanupOverlay() {
        if (this.overlay) {
            this.overlay.classList.remove('crop-mode');
            // ✅ Сбрасываем стили, чтобы другие инструменты могли работать
            this.overlay.style.cursor = '';
            this.overlay.style.pointerEvents = '';
            this.overlay.style.display = '';
            this.overlay.style.left = '';
            this.overlay.style.top = '';
            this.overlay.style.width = '';
            this.overlay.style.height = '';
        }

        super.cleanupOverlay();
        this.currentLayer = null;
    }

    updateOverlay() {
        if (!this.overlay) return;
        if (!this.currentLayer?.rect) return;

        const { x, y, width, height } = this.currentLayer.rect;

        const canvas = this.editor?.canvas;
        if (!canvas || !canvas.clientWidth || !canvas.clientHeight) return;

        // Учитываем возможный неодинаковый масштаб по X и Y
        const scaleX = canvas.width / canvas.clientWidth;
        const scaleY = canvas.height / canvas.clientHeight;

        this.overlay.style.left = `${x / scaleX}px`;
        this.overlay.style.top = `${y / scaleY}px`;
        this.overlay.style.width = `${width / scaleX}px`;
        this.overlay.style.height = `${height / scaleY}px`;
    }

    cancelOperation() {
        super.cancelOperation();
        this.currentLayer = null;
    }

    updateSettingsUI() {
        // Crop не имеет настроек, кроме формата/качества — они показываются всегда при активном инструменте
    }

    applyToCroppedCanvas() {
        // Кроп не применяется к самому себе, этот метод не нужен
    }
}