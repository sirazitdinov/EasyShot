// Tools/TextTool.js
import BaseTool from './BaseTool.js';

export default class TextTool extends BaseTool {
    constructor(editor) {
        super(editor, {
            name: 'text',
            settingsIds: ['textColorLabel', 'textSizeLabel']
        });
        this.color = '#000000';
        this.fontSize = 20;
        this.supportsCreation = true;
    }

    activate() {
        super.activate();
        const colorInput = document.getElementById('textColor');
        const sizeInput = document.getElementById('textSize');
        if (colorInput) this.color = colorInput.value;
        if (sizeInput) this.fontSize = +sizeInput.value;
    }

    setupOverlay() {
        super.setupOverlay();
        this.overlay.style.cursor = 'crosshair';
        this.overlay.style.border = '2px dashed #000';
        this.overlay.style.boxSizing = 'border-box';
        this.overlay.style.backgroundColor = 'rgba(0,0,0,0.05)';
    }

    handleMouseDown(event) {
        if (!this.isActive) return;
        const coords = this.getCanvasCoords(event);
        this.startPoint = { x: coords.x, y: coords.y };
        this.currentLayer = {
            type: 'text',
            rect: { x: coords.x, y: coords.y, width: 200, height: this.fontSize * 1.5 },
            params: {
                text: 'Текст',
                color: this.color,
                fontSize: this.fontSize
            }
        };
        this.isDrawing = true;
        this.editor.addHistoryState();
    }

    handleMouseMove(event) {
        if (!this.isActive || !this.isDrawing) return;
        const coords = this.getCanvasCoords(event);
        // Фиксированный размер при создании — только позиционирование
        this.currentLayer.rect.x = coords.x;
        this.currentLayer.rect.y = coords.y;
        this.updateOverlay();
    }

    handleMouseUp(event) {
        if (!this.isActive || !this.isDrawing) return;
        this.isDrawing = false;

        this.editor.addLayer(this.currentLayer);
        this.editor.setActiveLayer(this.currentLayer);

        // Двойной клик → редактирование текста
        setTimeout(() => {
            const rect = this.canvas.getBoundingClientRect();
            const clickX = (event.clientX - rect.left) * (this.canvas.width / rect.width);
            const clickY = (event.clientY - rect.top) * (this.canvas.height / rect.height);
            const layer = this.currentLayer;
            if (layer.rect &&
                clickX >= layer.rect.x && clickX <= layer.rect.x + layer.rect.width &&
                clickY >= layer.rect.y && clickY <= layer.rect.y + layer.rect.height) {
                this.editText(layer);
            }
        }, 50);

        this.cleanupOverlay();
        this.setupOverlay();
    }

    updateOverlay() {
        if (!this.currentLayer?.rect) return;
        const { x, y } = this.currentLayer.rect;
        const scale = this.canvas.width / this.canvas.clientWidth;

        this.overlay.style.left = `${x / scale}px`;
        this.overlay.style.top = `${y / scale}px`;
        this.overlay.style.width = `${200 / scale}px`;
        this.overlay.style.height = `${(this.fontSize * 1.5) / scale}px`;
    }

    cancelOperation() {
        super.cancelOperation();
        this.currentLayer = null;
    }

    updateSettingsUI() {
        const colorInput = document.getElementById('textColor');
        const sizeInput = document.getElementById('textSize');
        if (colorInput) {
            this.color = colorInput.value;
            const onChangeColor = () => {
                this.color = colorInput.value;
                const active = this.editor.getActiveLayer();
                if (active?.type === 'text') {
                    active.params.color = this.color;
                    this.editor.render();
                }
            };
            colorInput.removeEventListener('input', onChangeColor);
            colorInput.addEventListener('input', onChangeColor);
        }
        if (sizeInput) {
            this.fontSize = +sizeInput.value;
            const onChangeSize = () => {
                this.fontSize = +sizeInput.value;
                document.getElementById('textSizeValue').textContent = this.fontSize;
                const active = this.editor.getActiveLayer();
                if (active?.type === 'text') {
                    active.params.fontSize = this.fontSize;
                    this.editor.render();
                }
            };
            sizeInput.removeEventListener('input', onChangeSize);
            sizeInput.addEventListener('input', onChangeSize);
        }
    }

    editText(layer) {
        const newText = prompt('Введите текст:', layer.params.text || '');
        if (newText !== null) {
            this.editor.addHistoryState();
            layer.params.text = newText;
            this.editor.render();
        }
    }
}