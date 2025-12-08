// Tools/CropTool.js
import BaseTool from './BaseTool.js';

export default class CropTool extends BaseTool {
    constructor(editor) {
        super(editor, { name: 'crop' });
        this.supportsCreation = true;
    }

    activate() {
        super.activate();
        this.overlay.classList.add('crop-mode');
    }

    deactivate() {
        super.deactivate();
        // this.overlay.classList.remove('highlight-mode');
        this.editor.updateToolbarButtons();
    }

    getUISettingsConfig() {
        return {
            fields: []
        };
    }

    setupOverlay() {
        super.setupOverlay();
        this.overlay.style.cursor = 'crosshair';
    }

    updateOverlay() {
        if (!this.currentLayer?.rect) return;

        const { x, y, width, height } = this.currentLayer.rect;
        const scale = this.canvas.width / this.canvas.clientWidth;
        this.overlay.style.left = `${x / scale}px`;
        this.overlay.style.top = `${y / scale}px`;
        this.overlay.style.width = `${width / scale}px`;
        this.overlay.style.height = `${height / scale}px`;

        // this.overlay.style.border = '2px solid #fff';
        // this.overlay.style.boxSizing = 'border-box';
        // this.overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    }

    cancelOperation() {
        super.cancelOperation();
        this.currentLayer = null;
    }

    updateSettingsUI() {
        // Crop не имеет настроек, кроме формата/качества — они показываются всегда при активном инструменте
    }
}