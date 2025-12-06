// Tools/BlurTool.js
import BaseTool from './BaseTool.js';

export default class BlurTool extends BaseTool {
    constructor(editor) {
        super(editor, {
            name: 'blur',
            settingsIds: ['blurRadiusLabel']
        });
        this.radius = 5;
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
        this.editor.updateToolbarButtons(this.name);
    }

    setupOverlay() {
        super.setupOverlay();
        // this.overlay.style.cursor = 'crosshair';
        // this.overlay.style.border = 'none';
        // this.overlay.style.backgroundColor = 'rgba(0,128,255,0.2)';
        // this.overlay.style.pointerEvents = 'auto'; // Важно для получения событий
    }

    handleMouseDown(event) {
        if (!this.isActive) return;
        const coords = this.getCanvasCoords(event);
        this.startPoint = { x: coords.x, y: coords.y };
        this.currentLayer = {
            type: 'blur',
            rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
            params: { radius: this.radius }
        };
        this.isDrawing = true;
        this.editor.addHistoryState();
    }

    handleMouseMove(event) {
        if (!this.isActive || !this.isDrawing) return;
        const coords = this.getCanvasCoords(event);
        const x = Math.min(this.startPoint.x, coords.x);
        const y = Math.min(this.startPoint.y, coords.y);
        const width = Math.abs(coords.x - this.startPoint.x);
        const height = Math.abs(coords.y - this.startPoint.y);
        this.currentLayer.rect = { x, y, width, height };
        this.updateOverlay();
    }

    handleMouseUp(event) {
        if (!this.isActive || !this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentLayer.rect.width < 10 || this.currentLayer.rect.height < 10) {
            this.cancelOperation();
            return;
        }

        this.editor.addLayer(this.currentLayer);
        this.editor.setActiveLayer(this.currentLayer);

        this.cleanupOverlay();
        this.setupOverlay();
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

    updateSettingsUI() {
        const radiusInput = document.getElementById('blurRadius');
        if (!radiusInput) return;

        this.radius = +radiusInput.value;

        const onChange = () => {
            this.radius = +radiusInput.value;
            const active = this.editor.getActiveLayer();
            if (active?.type === 'blur') {
                active.params.radius = this.radius;
                this.editor.render();
            }
        };

        radiusInput.removeEventListener('input', onChange);
        radiusInput.addEventListener('input', onChange);
    }
}