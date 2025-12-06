// Tools/HighlightTool.js
import BaseTool from './BaseTool.js';

export default class HighlightTool extends BaseTool {
    constructor(editor) {
        super(editor, {
            name: 'highlight',
            settingsIds: ['highlightColorLabel']
        });
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
                this.color = activeLayer.params.color;
                colorInput.value = this.color;
                this.editor.updateToolbarButtons(this.name);
            } else {
                this.color = colorInput.value;
            }
        }

        this.updateSettingsUI();
    }

    deactivate() {
        super.deactivate();
        this.overlay.classList.remove('highlight-mode');
        this.editor.updateToolbarButtons(this.name);
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

    updateSettingsUI() {
        const colorInput = document.getElementById('highlightColor');
        if (!colorInput) return;

        // Установить начальное значение
        const activeLayer = this.editor.getActiveLayer();
        if (activeLayer?.type === 'highlight') {
            colorInput.value = activeLayer.params.color;
            this.color = activeLayer.params.color;
        }

        const onChange = () => {
            this.color = colorInput.value;
            if (activeLayer?.type === 'highlight') {
                activeLayer.params.color = this.color;
                this.editor.render();
            }
        };

        colorInput.removeEventListener('input', onChange);
        colorInput.addEventListener('input', onChange);
    }
}