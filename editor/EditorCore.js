// EditorCore.js

import CropTool from './Tools/CropTool.js';
import BlurTool from './Tools/BlurTool.js';
import HighlightTool from './Tools/HighlightTool.js';
import LineTool from './Tools/LineTool.js';
import TextTool from './Tools/TextTool.js';
import Helper from './Helper.js';

export default class ImageEditor {
    constructor() {
        // DOM элементы
        this.canvas = document.getElementById('canvas');
        this.context = this.canvas.getContext('2d', { willReadFrequently: true });
        this.selectionOverlay = document.getElementById('selectionOverlay');
        this.fileInput = document.getElementById('fileInput');

        // Элементы интерфейса для обновления информации
        this.imageSizeElement = document.getElementById('imageSize');
        this.imageWidthElement = document.getElementById('imageWidth');
        this.imageHeightElement = document.getElementById('imageHeight');
        this.fileSizeElement = document.getElementById('fileSize');

        // Данные изображения
        this.image = null;
        this.originalImage = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        // Слои
        this.layers = [];
        this.activeLayerIndex = -1;

        // Текущий активный слой
        this.activeLayer = null;

        // История для отмены/повтора
        this.history = [];
        this.historyPosition = -1;

        // Хранилище настроек инструментов
        this.toolSettings = {
            // Настройки по умолчанию для каждого инструмента
            highlight: {
                color:'#ff0000',
                thinknes: 2
            },
            crop: {aspectRatio: 'free'},
            line: {color:'#ff0000'},
            blur: {radius: 5}
        }

        // UI элементы для отображения настроек
        this.settingsElements = {
            highlight: {
                colorInput: document.getElementById('highlightColor'),
                colorLabel: document.getElementById('highlightColorLabel')
            },
            crop: {},
            blur: {
                radiusInput:document.getElementById('blurRadius'),
                radiusLabel: document.getElementById('blurRadiusLabel')
            },
            line: {},
            text: {
                colorInput: document.getElementById('textColor'),
                colorLabel: document.getElementById('textColorLabel'),
                sizeInput: document.getElementById('textSize'),
                sizeLabel: document.getElementById('textSizeLabel')
            }
        }

        // Создание инструментов
        this.tools = {
            crop: new CropTool(this,this.settingsElements['crop']),
            blur: new BlurTool(this,this.settingsElements['blur']),
            highlight: new HighlightTool(this,this.settingsElements['highlight']),
            line: new LineTool(this,this.settingsElements['line']),
            text: new TextTool(this,this.settingsElements['text'])
        };

        // Текущий активный инструмент
        this.activeTool = null;

        this.LINE_WIDTH = 2;
        this.DPR = window.devicePixelRatio || 1;
        this.HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

        // Инициализация
        this.init();
    }

    init() {
        this.setupCanvas();
        this.initEventListeners();
        this.initLayers();
        this.updateToolbarButtons();
        this.loadVersion();
    }

    setupCanvas() {
        // Установка начального размера холста
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.context.fillStyle = '#ffffff';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.addHistoryState();
    }

    initLayers() {
        // Создание базового слоя
        this.layers = [{
            id: 'layer-' + Date.now(),
            type: 'изображение',
            visible: true,
            imageData: this.context.getImageData(0, 0, this.canvas.width, this.canvas.height)
        }];
        this.activeLayerIndex = 0;
        this.updateLayersPanel();
    }

    setActiveTool(tool) {
        if (this.activeTool) {
            this.selectionOverlay.style.pointerEvents = 'auto';
            this.selectionOverlay.removeEventListener('mousedown', this.boundToolMouseDown);
            this.selectionOverlay.removeEventListener('mousemove', this.boundToolMouseMove);
            this.selectionOverlay.removeEventListener('mouseup', this.boundToolMouseUp);

            this.activeTool.deactivate();
        }

        this.activeTool = tool;

        if (tool) {
            tool.activate();
        }
    }

    updateToolbarButtons(activeToolType) {
        // Обновление состояния кнопок в тулбаре
        Object.keys(this.tools).forEach(toolType => {
            const button = document.getElementById(`${toolType}Btn`);
            if (button) {
                button.classList.toggle('active', toolType === activeToolType);
            }
        });
    }

    initEventListeners() {
        // Загрузка изображения
        document.getElementById('fileBtn').addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            this.loadImage(e.target.files[0]);
        });

        // Сохранение изображения
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveImage();
        });

        // Отмена действия
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undo();
        });

        // Кнопки инструментов
        document.getElementById('cropBtn').addEventListener('click', () => {
            this.setActiveTool(this.tools.crop);
        });

        document.getElementById('blurBtn').addEventListener('click', () => {
            this.setActiveTool(this.tools.blur);
        });

        document.getElementById('highlightBtn').addEventListener('click', () => {
            this.setActiveTool(this.tools.highlight);
        });

        document.getElementById('lineBtn').addEventListener('click', () => {
            this.setActiveTool(this.tools.line);
        });

        document.getElementById('textBtn').addEventListener('click', () => {
            this.setActiveTool(this.tools.text);
        });

        // Обработка изменения размера окна
        window.addEventListener('resize', () => {
            this.updateCanvasDisplay();
        });

        // Слои
        document.getElementById('layersList').addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (layerItem) {
                const layerId = layerItem.dataset.layerId;
                this.setActiveLayer(layerId);
            }
        });

        // Удаление слоя по Delete
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.activeLayer) {
                this.deleteActiveLayer();
            }
        });

        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));


        // Привязка обработчиков для selectionOverlay
        this.selectionOverlay.addEventListener('mousedown', (e) => this.onOverlayMouseDown(e));
        this.selectionOverlay.addEventListener('mousemove', (e) => this.onOverlayHover(e));


        // Перетаскивание слоев
        this.setupLayerDragAndDrop();
    }

    addHistoryState() {
        // Сохранение текущего состояния для отмены/повтора
        const currentState = this.canvas.toDataURL();
        // Обрезаем историю, если были отменены действия
        if (this.historyPosition < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyPosition + 1);
        }
        this.history.push(currentState);
        this.historyPosition = this.history.length - 1;
    }

    undo() {
        if (this.historyPosition > 0) {
            this.historyPosition--;
            const img = new Image();
            img.onload = () => {
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.context.drawImage(img, 0, 0);
                this.updateLayersFromCanvas();
            };
            img.src = this.history[this.historyPosition];
        }
    }

    loadImage(file) {

        // Сброс активного инструмента
        if (this.activeTool) {
            this.activeTool.deactivate();
            this.activeTool = null;
        }

        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Храним canvas в full-resolution (в пикселях источника)
                this.canvas.width = img.naturalWidth;
                this.canvas.height = img.naturalHeight;

                // Отображаем canvas на экране в CSS-пикселях (умножаем на 1/drp)
                this.canvas.style.width = `${img.naturalWidth / this.DPR}px`
                this.canvas.style.height = `${img.naturalHeight / this.DPR}px`

                // Сохранение оригинального изображения
                this.originalImage = img;

                this.image = img;

                // Установка размеров холста
                // this.canvas.width = img.width;
                // this.canvas.height = img.height;

                // Обновляем размеры selectionOverlay сразу после изменения canvas
                this.selectionOverlay.style.width = `${this.canvas.clientWidth}px`;
                this.selectionOverlay.style.height = `${this.canvas.clientHeight}px`;

                // Очистка и отрисовка изображения
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.context.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

                // Обновление информации об изображении
                this.updateImageInfo(file);

                // Сброс истории
                this.history = [this.canvas.toDataURL()];
                this.historyPosition = 0;

                // Инициализация слоев
                this.initLayers();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    saveImage(format = 'png', quality = 0.9) {

        // Получение параметров сохранения из UI, если они видны
        // TODO: Перенести получение значений формата и качества
        // const formatSelect = document.getElementById('formatSelect');
        // const qualityRange = document.getElementById('qualityRange');

        // if (formatSelect && formatSelect.style.display !== 'none') {
        //     format = formatSelect.value;
        // }

        // if (qualityRange && qualityRange.style.display !== 'none') {
        //     quality = parseFloat(qualityRange.value);
        // }

        const link = document.createElement('a');
        link.download = `image.${format === 'jpeg' ? 'jpg' : format}`;

        if (format === 'jpeg') {
            link.href = this.canvas.toDataURL(`image/${format}`, quality);
        } else {
            link.href = this.canvas.toDataURL(`image/${format}`);
        }

        link.click();
    }

    updateImageInfo(file) {
        if (!this.image) return;

        this.imageSizeElement.textContent = `${Math.round(file.size / 1024)} КБ`;
        this.imageWidthElement.textContent = `${this.canvas.width}px`;
        this.imageHeightElement.textContent = `${this.canvas.height}px`;

        // Приблизительный размер файла после сохранения
        this.canvas.toBlob((blob) => {
            this.fileSizeElement.textContent = `${Math.round(blob.size / 1024)} КБ`;
        }, 'image/png');
    }

    updateCanvasDisplay() {
        // Можно добавить логику для адаптации отображения холста под размер окна
    }

    addLayer(layer) {
        layer.id = 'layer-' + Date.now();
        this.layers.push(layer);
        this.activeLayer = layer;
        this.render();
        this.addHistoryState();
        this.updateLayersPanel();
    }

    setActiveLayer(layerId) {
        const layerIndex = this.layers.findIndex(layer => layer.id === layerId);
        if (layerIndex !== -1) {
            this.activeLayerIndex = layerIndex;
            this.updateLayersPanel();
            this.redrawCanvas();
        }
    }

    getActiveLayer() {
        return this.activeLayer;
    }

    // Получение настроек для конкретного инструмента
    getToolSettings(toolName) {
        return this.toolSettings[toolName] || {};
    }

    // Обновление настроек инструмента TODO
    updateToolSettings(toolName, settings) {
        if (!this.toolSettings[toolName]) {
            this.toolSettings[toolName] = {};
        }

        // Глубокое слияние настроек
        this.toolSettings[toolName] = {
            ...this.toolSettings[toolName],
            ...settings
        };

        // Сохранение настроек пользователя
        this.saveUserSettings();

        // Уведомление активного инструмента об изменении настроек
        if (this.activeTool && this.activeTool.name === toolName) {
            this.activeTool.updateSettings(this.toolSettings[toolName]);
        }
    }

    // Сохранение настроек пользователя в localStorage TODO
    saveUserSettings() {
        try {
            localStorage.setItem('editorToolSettings', JSON.stringify(this.toolSettings));
        } catch (e) {
            console.error('Failed to save user settings:', e);
        }
    }

    // Загрузка сохраненных настроек TODO
    loadUserSettings() {
        try {
            const savedSettings = localStorage.getItem('editorToolSettings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                // Глубокое слияние с настройками по умолчанию
                this.toolSettings = this.deepMerge(this.toolSettings, parsedSettings);
            }
        } catch (e) {
            console.error('Failed to load user settings:', e);
        }
    }

    updateLayersPanel() {
        const layersList = document.getElementById('layersList');
        layersList.innerHTML = '';

        // Обратный порядок для отображения (верхний слой в списке - самый верхний визуально)
        [...this.layers].reverse().forEach((layer, index) => {
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${this.activeLayerIndex === this.layers.length - 1 - index ? 'active' : ''}`;
            layerItem.dataset.layerId = layer.id;
            layerItem.draggable = true;

            layerItem.innerHTML = `
                <span class="layer-drag-handle">⋮</span>
                <span class="layer-icon">${index + 1}</span>
                <span class="layer-name">${layer.type}</span>
            `;

            layersList.appendChild(layerItem);
        });
    }

    setupLayerDragAndDrop() {
        // Реализация перетаскивания слоев для изменения порядка
        const layersList = document.getElementById('layersList');

        layersList.addEventListener('dragstart', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (layerItem) {
                e.dataTransfer.setData('text/plain', layerItem.dataset.layerId);
                layerItem.classList.add('dragging');
            }
        });

        layersList.addEventListener('dragend', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (layerItem) {
                layerItem.classList.remove('dragging');
            }
            // Сброс индикаторов вставки
            document.querySelectorAll('.layer-item.insert-above, .layer-item.insert-below').forEach(el => {
                el.classList.remove('insert-above', 'insert-below');
            });
        });

        layersList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const targetItem = e.target.closest('.layer-item');
            if (!targetItem) return;

            // Сброс всех индикаторов вставки
            document.querySelectorAll('.layer-item.insert-above, .layer-item.insert-below').forEach(el => {
                el.classList.remove('insert-above', 'insert-below');
            });

            const rect = targetItem.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;

            if (e.clientY < midpoint) {
                targetItem.classList.add('insert-above');
            } else {
                targetItem.classList.add('insert-below');
            }
        });

        layersList.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetItem = e.target.closest('.layer-item');
            if (!targetItem) return;

            const draggedLayerId = e.dataTransfer.getData('text/plain');
            const insertAbove = targetItem.classList.contains('insert-above');

            // Перемещение слоя в массиве
            this.moveLayer(draggedLayerId, targetItem.dataset.layerId, insertAbove);

            // Обновление панели слоев
            this.updateLayersPanel();

            // Перерисовка холста
            this.redrawCanvas();
        });

        layersList.addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (layerItem && !e.target.closest('.layer-drag-handle')) {
                const layerId = layerItem.dataset.layerId;
                this.setActiveLayer(layerId);
            }
        });
    }

    moveLayer(draggedLayerId, targetLayerId, insertAbove) {
        const draggedIndex = this.layers.findIndex(layer => layer.id === draggedLayerId);
        const targetIndex = this.layers.findIndex(layer => layer.id === targetLayerId);

        if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

        // Перемещение элемента в массиве
        const [movedLayer] = this.layers.splice(draggedIndex, 1);
        let newPosition = targetIndex;

        if (insertAbove) {
            // Если вставка выше целевого слоя
            if (draggedIndex > targetIndex) newPosition--;
        } else {
            // Если вставка ниже целевого слоя
            if (draggedIndex < targetIndex) newPosition++;
        }

        this.layers.splice(newPosition, 0, movedLayer);

        // Обновление индекса активного слоя
        if (this.activeLayerIndex === draggedIndex) {
            this.activeLayerIndex = newPosition;
        } else if (this.activeLayerIndex > draggedIndex && this.activeLayerIndex <= newPosition) {
            this.activeLayerIndex--;
        } else if (this.activeLayerIndex < draggedIndex && this.activeLayerIndex >= newPosition) {
            this.activeLayerIndex++;
        }
    }

    redrawCanvas() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Отрисовка всех видимых слоев
        this.layers.forEach((layer, index) => {
            if (layer.visible) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.canvas.width;
                tempCanvas.height = this.canvas.height;
                const tempCtx = tempCanvas.getContext('2d');

                // Восстановление данных слоя
                const imageData = layer.imageData;
                tempCtx.putImageData(imageData, 0, 0);

                // Отрисовка на основном холсте
                this.context.drawImage(tempCanvas, 0, 0);
            }
        });

        this.addHistoryState();
    }

    render() {
        if (!this.image) return;
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(this.image, 0, 0);

        this.layers.forEach(l => {
            if (l.type === 'blur' && l.rect) {
                this.context.save();
                this.context.filter = `blur(${l.params.radius}px)`;
                this.context.drawImage(this.image,
                    l.rect.x, l.rect.y, l.rect.width, l.rect.height,
                    l.rect.x, l.rect.y, l.rect.width, l.rect.height);
                this.context.restore();
            }
            if (l.type === 'highlight' && l.rect) {
                this.context.strokeStyle = l.params.color;
                this.context.lineWidth = this.LINE_WIDTH;
                this.context.strokeRect(l.rect.x, l.rect.y, l.rect.width, l.rect.height);
            }
            if (l.type === 'line' && l.points) {
                const { x1, y1, x2, y2, color } = l.points;
                this.context.strokeStyle = color;
                this.context.lineWidth = 2;
                this.context.beginPath();
                this.context.moveTo(x1, y1);
                this.context.lineTo(x2, y2);
                const ang = Math.atan2(y2 - y1, x2 - x1);
                const arr = 10;
                this.context.lineTo(x2 - arr * Math.cos(ang - Math.PI / 6), y2 - arr * Math.sin(ang - Math.PI / 6));
                this.context.moveTo(x2, y2);
                this.context.lineTo(x2 - arr * Math.cos(ang + Math.PI / 6), y2 - arr * Math.sin(ang + Math.PI / 6));
                this.context.stroke();
            }
            if (l.type === 'text' && l.rect) {
                this.context.save();
                this.context.fillStyle = l.params.color;
                this.context.font = `${l.params.fontSize}px Arial`;
                this.context.textBaseline = 'top';
                this.context.textAlign = 'left';
                this.wrapTextInRect(
                    this.context, l.params.text,
                    l.rect.x, l.rect.y,
                    l.rect.width, l.rect.height,
                    l.params.fontSize
                );
                this.context.restore();
            }
        });

        // Кроп-затемнение
        const cropLayer = this.layers.find(l => l.type === 'crop');
        if (cropLayer) {
            // Затемняем область вне кропа
            this.context.save();
            this.context.fillStyle = 'rgba(0, 0, 0, 0.5)';

            // Верхняя полоса
            this.context.fillRect(0, 0, this.canvas.width, cropLayer.rect.y);
            // Нижняя полоса
            this.context.fillRect(0, cropLayer.rect.y + cropLayer.rect.height,
                this.canvas.width, this.canvas.height - cropLayer.rect.y - cropLayer.rect.height);
            // Левая полоса
            this.context.fillRect(0, cropLayer.rect.y,
                cropLayer.rect.x, cropLayer.rect.height);
            // Правая полоса
            this.context.fillRect(cropLayer.rect.x + cropLayer.rect.width, cropLayer.rect.y,
                this.canvas.width - cropLayer.rect.x - cropLayer.rect.width, cropLayer.rect.height);

            this.context.restore();

            // Рисуем границу области кропа
            this.context.strokeStyle = '#ffffff';
            this.context.lineWidth = 2;
            this.context.strokeRect(cropLayer.rect.x, cropLayer.rect.y,
                cropLayer.rect.width, cropLayer.rect.height);

            // Отображаем размеры
            this.context.fillStyle = '#ffffff';
            this.context.font = '14px Arial';
            this.context.fillText(
                `${Helper.formatSize(cropLayer.rect.width)} × ${Helper.formatSize(cropLayer.rect.height)}`,
                cropLayer.rect.x - 10,
                cropLayer.rect.y - 10
            );
        }

        if (this.activeLayer?.rect) {
            this.drawHandles(this.context, this.activeLayer.rect);
        }
        if (this.activeLayer?.type === 'line' && this.activeLayer.points) {
            this.drawLinePoints(this.context, this.activeLayer.points);
        }

        // Ручки (drawHandles etc.) — по желанию
    }

    /**
     * Рисует ручки управления (handles) для прямоугольника, используя контекст 2D.
     * Каждая ручка представляет собой квадратный элемент с указанными координатами и направлением.
     * @param {CanvasRenderingContext2D} ctx - Контекст 2D канваса.
     * @param {Object} rect - Объект с координатами прямоугольника: { x, y, width, height }.
     * @returns {void} - Функция не возвращает значения.
     * @throws {Error} - Бросает ошибку, если ctx или rect равны null.
     */
    drawHandles(ctx, rect) {
        if (!ctx || !rect) return;
        ctx.save();
        ctx.fillStyle = '#0096ff';
        const size = 6;

        const handles = [
            { x: rect.x, y: rect.y, dx: -1, dy: -1 },           // nw
            { x: rect.x + rect.width / 2, y: rect.y, dx: 0, dy: -1 }, // n
            { x: rect.x + rect.width, y: rect.y, dx: 1, dy: -1 },     // ne
            { x: rect.x, y: rect.y + rect.height / 2, dx: -1, dy: 0 }, // w
            { x: rect.x + rect.width, y: rect.y + rect.height / 2, dx: 1, dy: 0 }, // e
            { x: rect.x, y: rect.y + rect.height, dx: -1, dy: 1 },    // sw
            { x: rect.x + rect.width / 2, y: rect.y + rect.height, dx: 0, dy: 1 }, // s
            { x: rect.x + rect.width, y: rect.y + rect.height, dx: 1, dy: 1 }      // se
        ];

        handles.forEach(h => {
            const cx = h.x + h.dx * 4;
            const cy = h.y + h.dy * 4;
            ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        });
        ctx.restore();
    }

    /**
     * Рисует точки на линии с указанными координатами.
     * @param {CanvasRenderingContext2D} ctx - Контекст 2D для рисования.
     * @param {Object} points - Объект с координатами точек: {x1, y1, x2, y2}.
     * @returns {void} - Функция не возвращает значение.
     * @throws {Error} - Если ctx или points равны null/undefined.
     */
    drawLinePoints(ctx, points) {
        if (!ctx || !points) return;
        ctx.save();
        ctx.fillStyle = '#0096ff';
        const r = 5;
        ctx.beginPath();
        ctx.arc(points.x1, points.y1, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(points.x2, points.y2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    onOverlayMouseDown(e) {
        const coords = this.getCanvasCoords(e);
        let hit = null;

        // 1. Поиск попадания в слой
        for (const l of this.layers) {
            if (l.rect && coords.x >= l.rect.x && coords.x <= l.rect.x + l.rect.width &&
                coords.y >= l.rect.y && coords.y <= l.rect.y + l.rect.height) {
                hit = l;
                break;
            }
            if (l.points) {
                const d1 = Math.hypot(coords.x - l.points.x1, coords.y - l.points.y1);
                const d2 = Math.hypot(coords.x - l.points.x2, coords.y - l.points.y2);
                if (d1 < 12 || d2 < 12) { hit = l; break; }
            }
        }

        // 2. Двойной клик → редактирование текста
        if (e.detail === 2 && hit?.type === 'text') {
            e.preventDefault();
            const newText = prompt('Введите текст:', hit.params.text || '');
            if (newText !== null) {
                this.addHistoryState();
                hit.params.text = newText;
                this.render();
                this.updateLayersPanel();
            }
            return;
        }

        // 3. Проверка попадания в ручки (только для прямоугольных слоёв)
        let handleHit = null;
        if (hit?.rect) {
            for (const h of this.HANDLES) {
                const [dx, dy] = {
                    nw: [-1, -1], n: [0, -1], ne: [1, -1],
                    w: [-1, 0], e: [1, 0],
                    sw: [-1, 1], s: [0, 1], se: [1, 1]
                }[h];

                const centerX = hit.rect.x + hit.rect.width * (dx + 1) / 2;
                const centerY = hit.rect.y + hit.rect.height * (dy + 1) / 2;

                const hitSize = 16;
                const hitX = centerX - hitSize / 2;
                const hitY = centerY - hitSize / 2;

                if (coords.x >= hitX && coords.x <= hitX + hitSize &&
                    coords.y >= hitY && coords.y <= hitY + hitSize) {
                    handleHit = h;
                    break;
                }
            }
        }

        // 4. Ручки → resize
        if (handleHit) {
            this.activeLayer = hit;
            this.dragState = {
                start: coords,
                layer: hit,
                handle: handleHit,
                orig: { ...hit.rect }
            };
            this.selectionOverlay.className = `resize-${handleHit}`;
            this.updateLayersPanel();
            return;
        }

        // 5. Точки линии
        if (hit?.type === 'line') {
            const d1 = Math.hypot(coords.x - hit.points.x1, coords.y - hit.points.y1);
            const d2 = Math.hypot(coords.x - hit.points.x2, coords.y - hit.points.y2);
            let ptHandle = null;
            if (d1 < 12) ptHandle = 'x1';
            else if (d2 < 12) ptHandle = 'x2';

            if (ptHandle) {
                this.activeLayer = hit;
                this.dragState = {
                    start: coords,
                    layer: hit,
                    handle: ptHandle,
                    orig: { ...hit.points }
                };
                this.selectionOverlay.style.cursor = 'move';
                this.updateLayersPanel();
                return;
            }
        }

        // 6. Попадание в слой → move
        if (hit) {
            this.activeLayer = hit;
            const isRect = !!hit.rect;
            this.dragState = {
                start: coords,
                layer: hit,
                handle: 'move',
                orig: isRect ? { ...hit.rect } : { ...hit.points }
            };
            this.selectionOverlay.className = 'move';
            this.selectionOverlay.style.cursor = 'move';
            this.updateLayersPanel();
            return;
        }

        // 7. Создание нового слоя — только если активен инструмент и он поддерживает прямоугольники/линии
        if (this.activeTool?.supportsCreation) {
            const type = this.activeTool.name;
            let newLayer;

            switch (type) {
                case 'crop':
                    if (this.layers.some(l => l.type === 'crop')) return;
                    newLayer = {
                        type: 'crop',
                        rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
                        params: {}
                    };
                    break;
                case 'blur':
                    newLayer = {
                        type: 'blur',
                        rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
                        params: { radius: 5 }
                    };
                    break;
                case 'highlight':
                    newLayer = {
                        type: 'highlight',
                        rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
                        params: { color: this.activeTool.color }
                    };
                    break;
                case 'line':
                    newLayer = {
                        type: 'line',
                        points: { x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y, color: '#ff0000' }
                    };
                    break;
                case 'text':
                    newLayer = {
                        type: 'text',
                        rect: { x: coords.x, y: coords.y, width: 200, height: 50 },
                        params: { text: 'Текст', color: '#000000', fontSize: 16 }
                    };
                    break;
                default:
                    return;
            }

            this.addLayer(newLayer);
            this.dragState = {
                start: coords,
                layer: newLayer,
                handle: type === 'line' ? 'x2' : 'create',
                orig: type === 'line'
                    ? { x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y }
                    : { x: coords.x, y: coords.y, width: 0, height: 0 }
            };
        }
    }

    onMouseMove(e) {
        if (!this.dragState) return;
        const coords = this.getCanvasCoords(e);
        const { handle, layer, start, orig } = this.dragState;

        if (handle === 'create') {
            const x1 = Math.min(start.x, coords.x);
            const y1 = Math.min(start.y, coords.y);
            const w = Math.abs(coords.x - start.x);
            const h = Math.abs(coords.y - start.y);

            layer.rect.x = Math.max(0, x1);
            layer.rect.y = Math.max(0, y1);
            layer.rect.width = Math.max(10, Math.min(this.canvas.width - layer.rect.x, w));
            layer.rect.height = Math.max(10, Math.min(this.canvas.height - layer.rect.y, h));
        }
        else if (handle === 'move') {
            const dx = coords.x - start.x;
            const dy = coords.y - start.y;
            if (layer.rect) {
                layer.rect.x = Math.max(0, Math.min(this.canvas.width - orig.width, orig.x + dx));
                layer.rect.y = Math.max(0, Math.min(this.canvas.height - orig.height, orig.y + dy));
            } else if (layer.points) {
                layer.points.x1 = Math.max(0, Math.min(this.canvas.width, orig.x1 + dx));
                layer.points.y1 = Math.max(0, Math.min(this.canvas.height, orig.y1 + dy));
                layer.points.x2 = Math.max(0, Math.min(this.canvas.width, orig.x2 + dx));
                layer.points.y2 = Math.max(0, Math.min(this.canvas.height, orig.y2 + dy));
            }
        }
        else if (layer.rect) {
            this.updateRectFromHandle(handle, layer, start, coords.x, coords.y);
        }
        else if (layer.points && (handle === 'x1' || handle === 'x2')) {
            layer.points[handle === 'x1' ? 'x1' : 'x2'] = Math.max(0, Math.min(this.canvas.width, coords.x));
            layer.points[handle === 'x1' ? 'y1' : 'y2'] = Math.max(0, Math.min(this.canvas.height, coords.y));
        }

        this.render();
    }

    onMouseUp(e) {
        if (this.dragState) {
            this.addHistoryState(); // после завершения
        }
        this.dragState = null;
        this.selectionOverlay.className = '';
        this.selectionOverlay.style.cursor = 'default';
        this.render();
    }

    onOverlayHover(e) {
        if (this.dragState) return; // не мешаем при drag

        const coords = this.getCanvasCoords(e);
        let cls = '';

        this.layers.forEach((l) => {
            if (!l.rect) return;
            this.HANDLES.forEach((h) => {
                const [dx, dy] = {
                    nw: [-1, -1], n: [0, -1], ne: [1, -1],
                    w: [-1, 0], e: [1, 0],
                    sw: [-1, 1], s: [0, 1], se: [1, 1]
                }[h];

                const centerX = l.rect.x + l.rect.width * (dx + 1) / 2;
                const centerY = l.rect.y + l.rect.height * (dy + 1) / 2;

                // Область попадания в ручку
                const hitSize = 16; // HANDLE_SIZE
                const hx = centerX - hitSize / 2;
                const hy = centerY - hitSize / 2;

                if (coords.x >= hx && coords.x <= hx + hitSize &&
                    coords.y >= hy && coords.y <= hy + hitSize) {
                    cls = `resize-${h}`;
                    return true;
                }
            });
            if (cls) return;
        });

        this.selectionOverlay.className = cls;
        this.selectionOverlay.style.cursor = cls ? 'pointer' : 'default';
    }

    updateRectFromHandle(handle, layer, start, x, y) {
        const orig = this.dragState.orig;
        const dx = x - start.x;
        const dy = y - start.y;
        const MIN = 10;

        let nx = orig.x, ny = orig.y, nw = orig.width, nh = orig.height;

        switch (handle) {
            case 'se': nw += dx; nh += dy; break;
            case 'sw': nw -= dx; nh += dy; nx += dx; break;
            case 'ne': nw += dx; nh -= dy; ny += dy; break;
            case 'nw': nw -= dx; nh -= dy; nx += dx; ny += dy; break;
            case 'n': nh -= dy; ny += dy; break;
            case 's': nh += dy; break;
            case 'w': nw -= dx; nx += dx; break;
            case 'e': nw += dx; break;
        }

        // Ограничения
        if (handle.includes('w')) {
            const maxX = orig.x + orig.width;
            nx = Math.min(maxX - MIN, nx);
            nx = Math.max(0, nx);
            nw = maxX - nx;
        } else if (handle.includes('e')) {
            nw = Math.max(MIN, Math.min(this.canvas.width - orig.x, nw));
        }

        if (handle.includes('n')) {
            const maxY = orig.y + orig.height;
            ny = Math.min(maxY - MIN, ny);
            ny = Math.max(0, ny);
            nh = maxY - ny;
        } else if (handle.includes('s')) {
            nh = Math.max(MIN, Math.min(this.canvas.height - orig.y, nh));
        }

        layer.rect.x = nx;
        layer.rect.y = ny;
        layer.rect.width = nw;
        layer.rect.height = nh;
    }

    resetSelection() {
        this.activeLayer = null;
        this.dragState = null;
        this.selectionOverlay.className = '';
        this.selectionOverlay.style.cursor = 'default';
        this.render();
        this.updateLayersPanel();
    }

    deleteActiveLayer() {
        if (!this.activeLayer) return;
        this.layers = this.layers.filter(l => l !== this.activeLayer);
        this.activeLayer = null;
        this.addHistoryState();
        this.render();
        this.updateLayersPanel();
    }

    wrapTextInRect(context, text, x, y, maxWidth, maxHeight, fontSize) {
        if (!text || maxWidth <= 0 || maxHeight <= 0) return; // Проверяем на валидность

        const words = text.split(' ');
        let line = '';
        let currentY = y;
        const lineHeight = fontSize * 1.2;

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = context.measureText(testLine);
            const testWidth = metrics.width;

            // Проверяем, помещается ли строка по ширине
            if (testWidth > maxWidth && i > 0) {
                // Проверяем, помещается ли строка по высоте
                if (currentY + lineHeight > y + maxHeight) {
                    // Если не помещается, рисуем многоточие в предыдущей строке
                    if (line.trim() !== '') {
                        // Обрезаем строку, добавляем ...
                        let truncatedLine = line.trim();
                        let lastSpaceIndex = truncatedLine.lastIndexOf(' ');
                        while (context.measureText(truncatedLine + '...').width > maxWidth && lastSpaceIndex > 0) {
                            truncatedLine = truncatedLine.substring(0, lastSpaceIndex);
                            lastSpaceIndex = truncatedLine.lastIndexOf(' ');
                        }
                        context.fillText(truncatedLine + '...', x, currentY);
                    }
                    return; // Выходим, если высота превышена
                }
                // Рисуем текущую строку
                context.fillText(line, x, currentY);
                // Начинаем новую строку
                line = words[i] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }

        // Проверяем, помещается ли последняя строка по высоте
        if (currentY + lineHeight <= y + maxHeight) {
            context.fillText(line, x, currentY);
        } else {
            // Если последняя строка не помещается, обрезаем её
            let truncatedLine = line.trim();
            let lastSpaceIndex = truncatedLine.lastIndexOf(' ');
            while (context.measureText(truncatedLine + '...').width > maxWidth && lastSpaceIndex > 0) {
                truncatedLine = truncatedLine.substring(0, lastSpaceIndex);
                lastSpaceIndex = truncatedLine.lastIndexOf(' ');
            }
            context.fillText(truncatedLine + '...', x, currentY);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatSize(value) {
        return Math.round(value * 10) / 10; // Округляем до 1 знака после запятой
    }

    getCanvasCoords(event) {
        const r = this.canvas.getBoundingClientRect();
        return {
            x: (event.clientX - r.left) * (this.canvas.width / r.width),
            y: (event.clientY - r.top) * (this.canvas.height / r.height)
        };
    }

    updateLayersFromCanvas() {
        // Обновление данных активного слоя из холста
        if (this.activeLayerIndex >= 0 && this.activeLayerIndex < this.layers.length) {
            this.layers[this.activeLayerIndex].imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    applyCrop(startPoint, endPoint) {
        // Логика кадрирования изображения
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);

        if (width <= 0 || height <= 0) return;

        // Создание нового холста для кадрированного изображения
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = width;
        tempCanvas.height = height;

        // Копирование кадрированной области
        tempCtx.drawImage(
            this.canvas,
            x, y, width, height,
            0, 0, width, height
        );

        // Обновление основного холста
        this.canvas.width = width;
        this.canvas.height = height;
        this.context.drawImage(tempCanvas, 0, 0);

        // Обновление данных слоев
        this.layers.forEach(layer => {
            const layerCanvas = document.createElement('canvas');
            layerCanvas.width = width;
            layerCanvas.height = height;
            const layerCtx = layerCanvas.getContext('2d');

            layerCtx.putImageData(layer.imageData, 0, 0);
            layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
            layerCtx.drawImage(tempCanvas, 0, 0);

            layer.imageData = layerCtx.getImageData(0, 0, width, height);
        });

        this.addHistoryState();
        this.updateCanvasDisplay();
    }

    async loadVersion() {
        // Загрузка номера версии из manifest.json в корне
        try {
            const response = await fetch(chrome.runtime.getURL('manifest.json'));
            const manifest = await response.json();
            document.getElementById('versionNumber').textContent = manifest.version || 'N/A';
        } catch (error) {
            console.error('Ошибка при загрузке версии из manifest.json:', error);
            document.getElementById('versionNumber').textContent = 'N/A';
        }
    }
}