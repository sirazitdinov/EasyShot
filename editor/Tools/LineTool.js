// Tools/LineTool.js
import BaseTool from './BaseTool.js';

export default class LineTool extends BaseTool {
    constructor(editor) {
        super(editor, {
            name: 'line',
            settingsIds: ['highlightColorLabel']
        });
        this.color = '#ff0000';
        this.supportsCreation = true;
    }

    activate() {
        super.activate();
        const colorInput = document.getElementById('highlightColor');
        if (colorInput) this.color = colorInput.value;
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

    handleMouseDown(event) {
        if (!this.isActive) return;
        const coords = this.getCanvasCoords(event);
        this.startPoint = { x: coords.x, y: coords.y };
        this.currentLayer = {
            type: 'line',
            points: { x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y, color: this.color }
        };
        this.isDrawing = true;
        this.editor.addHistoryState();
    }

    handleMouseMove(event) {
        if (!this.isActive || !this.isDrawing) return;
        const coords = this.getCanvasCoords(event);
        this.currentLayer.points.x2 = coords.x;
        this.currentLayer.points.y2 = coords.y;
        this.updateOverlay();
    }

    handleMouseUp(event) {
        if (!this.isActive || !this.isDrawing) return;
        this.isDrawing = false;

        const dx = this.currentLayer.points.x2 - this.currentLayer.points.x1;
        const dy = this.currentLayer.points.y2 - this.currentLayer.points.y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) {
            this.cancelOperation();
            return;
        }

        this.editor.addLayer(this.currentLayer);
        this.editor.setActiveLayer(this.currentLayer);

        this.cleanupOverlay();
        this.setupOverlay();
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

    updateSettingsUI() {
        const colorInput = document.getElementById('highlightColor');
        if (!colorInput) return;

        this.color = colorInput.value;

        const onChange = () => {
            this.color = colorInput.value;
            if (this.linePreview) this.linePreview.style.borderColor = this.color;
            const active = this.editor.getActiveLayer();
            if (active?.type === 'line') {
                active.points.color = this.color;
                this.editor.render();
            }
        };

        colorInput.removeEventListener('input', onChange);
        colorInput.addEventListener('input', onChange);
    }
}