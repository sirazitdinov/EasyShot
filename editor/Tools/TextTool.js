// Tools/TextTool.js
import BaseTool from './BaseTool.js';

export default class TextTool extends BaseTool {
    constructor(editor) {
        super(editor, {
            name: 'text',
            settingsIds: ['textColorLabel', 'textSizeLabel']
        });

        this.settings = {
            color: '#ff0000',
            fontSize: 16,
            thickness: 2,
        };

        this.supportsCreation = true;
    }

    activate() {
        this.overlay.classList.add('text-mode');
        super.activate();
        const colorInput = document.getElementById('textColor');
        const sizeInput = document.getElementById('textSize');
        if (colorInput) this.color = colorInput.value;
        if (sizeInput) this.fontSize = +sizeInput.value;
    }

    deactivate() {
        super.deactivate();
        this.overlay.classList.remove('text-mode');
        this.editor.updateToolbarButtons();
    }

    getUISettingsConfig() {
        return {
            fields: [
                {
                    key: 'textColor',
                    type: 'color',
                    label: 'Цвет',
                    value: this.settings.color,
                    onChange: (value) => this.updateSetting('textColor', value)
                },
                {
                    key: 'textSize',
                    type: 'range',
                    label: 'Размер',
                    min: 1,
                    max: 72,
                    value: this.settings.fontSize,
                    onChange: (value) => this.updateSetting('textSize', value)
                },
            ]
        };
    }

    setupOverlay() {
        super.setupOverlay();
        // this.overlay.style.cursor = 'crosshair';
        // this.overlay.style.border = '2px dashed #000';
        // this.overlay.style.boxSizing = 'border-box';
        // this.overlay.style.backgroundColor = 'rgba(0,0,0,0.05)';
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
        if (hit || newLayer) {
            this.historyManager.beginAtomicOperation('Move/resize layer');
        }
    }

    // handleMouseMove(event) {
    //     if (!this.isActive || !this.isDrawing) return;
    //     const coords = this.getCanvasCoords(event);
    //     // Фиксированный размер при создании — только позиционирование
    //     this.currentLayer.rect.x = coords.x;
    //     this.currentLayer.rect.y = coords.y;
    //     this.updateOverlay();
    // }

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

    /**
     * Обновляет настройку инструмента и применяет её к активному слою, если он текстовый
     * @param {string} key — имя параметра ('textColor', 'textSize')
     * @param {string|number} value — новое значение
     */
    updateSetting(key, value) {
        switch (key) {
            case 'textColor':
                this.settings.color = value;
                break;
            case 'textSize':
                this.settings.fontSize = value;
                break;
            default:
                console.warn(`TextTool.updateSetting: unknown setting key "${key}"`);
                return;
        }

        // Применяем настройку к активному текстовому слою, если есть
        const activeLayer = this.editor.getActiveLayer();
        if (activeLayer?.type === 'text') {
            if (key === 'textColor') {
                activeLayer.params.color = value;
            } else if (key === 'textSize') {
                activeLayer.params.fontSize = value;
            }
            this.editor.render(); // перерисовываем
        }
    }

    editText(layer) {
        const newText = prompt('Введите текст:', layer.params.text || '');
        if (newText !== null) {
            if (this.editor.historyManager) {
                this.editor.historyManager.clear();
                this.editor.historyManager.commit('Initial canvas');
            }

            layer.params.text = newText;
            this.editor.render();
        }
    }
}