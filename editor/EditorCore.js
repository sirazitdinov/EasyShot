// EditorCore.js

import CropTool from './Tools/CropTool.js';
import BlurTool from './Tools/BlurTool.js';
import HighlightTool from './Tools/HighlightTool.js';
import LineTool from './Tools/LineTool.js';
import TextTool from './Tools/TextTool.js';
import ToolSettingsUI from './Tools/ToolSettingsUI.js';
import LayerManager from './LayerManager.js';
import HistoryManager from './HistoryManager.js';
import Helper from './Helper.js';

export default class ImageEditor {
    constructor() {
        this.initializeDOMElements();
        this.initializeImageData();
        this.initializeManagers();
        this.initializeHistory();
        this.initializeToolSettings();
        this.initializeTools();
        this.initializeConstants();
        this.initializeState();

        this.boundUndoClick = () => {
            if (this.historyManager) this.historyManager.undo();
        };

        // Инициализация
        this.init();
    }

    /**
     * Инициализирует DOM-элементы
     */
    initializeDOMElements() {
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
    }

    /**
     * Инициализирует данные изображения
     */
    initializeImageData() {
        // Данные изображения
        this.image = null;
        this.originalImage = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    /**
     * Инициализирует менеджеры (слоев и др.)
     */
    initializeManagers() {
        this.layerManager = new LayerManager(this);
        this.layerManager.init();
        this.layerManager.setupDragAndDrop();
    }

    /**
     * Инициализирует историю для отмены/повтора
     */
    initializeHistory() {
        // История для отмены/повтора
        this.historyManager = new HistoryManager(this, {
            maxHistory: 50,
            deduplicate: true,
        });
        // this.history = [];
        // this.historyPosition = -1;
        // this.MAX_HISTORY_SIZE = 50; // Максимальное количество состояний в истории
    }

    /**
     * Инициализирует настройки инструментов
     */
    initializeToolSettings() {
        // Контейнер для вывода настроек инструментов
        this.toolSettingsUI = new ToolSettingsUI(document.getElementById('toolSettings'));

        // Хранилище настроек инструментов
        this.toolSettings = {
            // Настройки по умолчанию для каждого инструмента
            highlight: {color:'#ff0000', thickness: 2},
            crop: {aspectRatio: 'free'},
            line: {color:'#ff0000', thickness: 2},
            blur: {radius: 5}
        }

        // UI элементы для отображения настроек
        this.settingsElements = {
            highlight: {
                colorInput: document.getElementById('highlightColor'),
                colorLabel: document.getElementById('highlightColorLabel'),
                thicknessInput: document.getElementById('thickness')
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
            },
            general: {
                formatSelect: document.getElementById('formatSelect'),
                qualityLabel: document.getElementById('qualityLabel'),
                qualityRange: document.getElementById('qualityRange'),
                qualityValue: document.getElementById('qualityValue')
            }
        }
    }

    /**
     * Инициализирует инструменты редактора
     */
    initializeTools() {
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
    }

    /**
     * Инициализирует константы для различных параметров
     */
    initializeConstants() {
        // Константы для различных параметров
        this.CONSTANTS = {
            LINE_WIDTH: 2,
            HANDLE_SIZE: 16,
            MIN_DIMENSION: 10,
            ARROW_LENGTH: 10,
            HANDLE_DISPLAY_SIZE: 6,
            HANDLE_HIT_TOLERANCE: 12,
            HANDLE_OFFSET: 4,
            CROP_TEXT_OFFSET: 10,
            TEXT_LINE_HEIGHT_RATIO: 1.2,
            BLUR_RADIUS_DEFAULT: 5,
            HIGHLIGHT_COLOR_DEFAULT: '#ff0000',
            LINE_COLOR_DEFAULT: '#ff0000',
            TEXT_COLOR_DEFAULT: '#000000',
            TEXT_FONT_SIZE_DEFAULT: 16,
            TEXT_MAX_WIDTH: 200,
            TEXT_MAX_HEIGHT: 50
        };

        this.DPR = window.devicePixelRatio || 1;
        this.HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    }

    /**
     * Инициализирует начальное состояние
     */
    initializeState() {
        // Инициализация других состояний
    }

    /**
     * Инициализирует редактор изображений
     * Устанавливает начальный холст, инициализирует менеджер слоев,
     * добавляет обработчики событий и обновляет кнопки тулбара
     */
    init() {
        this.setupCanvas();
        this.layerManager.init(); // Инициализация менеджера слоев
        this.initEventListeners();
        this.updateToolbarButtons();
        this.loadVersion();
    }

    /**
     * Устанавливает начальные параметры холста
     * Задает размеры холста и заливает его белым цветом
     */
    setupCanvas() {
        // Установка начального размера холста
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.context.fillStyle = '#fff';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.historyManager) {
            this.historyManager.clear();
            this.historyManager.commit('Initial canvas');
        }
    }

    /**
     * Устанавливает активный инструмент для редактора
     * @param {Object} tool - Инструмент, который нужно установить как активный
     */
    setActiveTool(tool) {
        // Деактивируем предыдущий активный инструмент и прослущивание событий
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
            // Отрисовываем элементы настроек активного инстурмента
            this.toolSettingsUI.renderSettings(tool);
            this.updateToolbarButtons();
        } else {
            this.updateToolbarButtons();
        }
    }

    /**
     * Обновляет состояние кнопок тулбара в зависимости от активного инструмента
     */
    updateToolbarButtons() {
        const activeToolType = this.activeTool?.name;
        // Обновление состояния кнопок в тулбаре
        Object.keys(this.tools).forEach(toolType => {
            const button = document.getElementById(`${toolType}Btn`);
            if (button) {
                button.classList.toggle('active', toolType === activeToolType);
            }
        });
    }

    /**
     * Инициализирует обработчики событий для различных действий в редакторе
     * Устанавливает слушатели для загрузки изображения, сохранения, отмены, инструментов, слоев и т.д.
     */
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
            this.applyCrop();
            this.saveImage();
        });

        // Отмена действия
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) undoBtn.addEventListener('click', this.boundUndoClick);

        // Повторить действие
        const redoBtn = document.getElementById('redoBtn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                if (this.historyManager) {
                this.historyManager.redo();
                }
            });
        }

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

    /**
     * Загружает изображение в редактор
     * @param {File} file - Файл изображения для загрузки
     */
    loadImage(file) {

        // Сброс активного инструмента
        if (this.activeTool) {
            this.activeTool.deactivate();
            this.activeTool = null;
        }

        if (!file) return;

        // Проверка типа файла
        if (!file.type.match('image.*')) {
            alert('Пожалуйста, выберите файл изображения (JPEG, PNG, GIF, и т.д.)');
            return;
        }

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

                // Обновляем размеры selectionOverlay сразу после изменения canvas
                this.selectionOverlay.style.width = `${this.canvas.clientWidth}px`;
                this.selectionOverlay.style.height = `${this.canvas.clientHeight}px`;

                // Очистка и отрисовка изображения
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.context.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

                // Обновление информации об изображении
                this.updateImageInfo(file);

                // Обнволение базового слоя после загрузки избражения
                if(this.layerManager.layers.length > 0 ){
                    const baseLayer = this.layerManager.layers[0];
                    this.context.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                    baseLayer.imageData = this.context.getImageData(0,0, this.canvas.width, this.canvas.height);
                    this.layerManager.updateLayersPanel();
                }

                // Сброс истории
                if (this.historyManager) {
                    this.historyManager.clear();
                    this.historyManager.commit('Load image');
                }

                // Инициализация слоев
                // this.initLayers();

            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Сохраняет текущее изображение в указанном формате
     * @param {string} format - Формат изображения ('png', 'jpeg', и т.д.)
     * @param {number} quality - Качество изображения (от 0 до 1)
     */
    saveImage(format = 'png', quality = 0.9) {

        try{
            let canvasToSave = this.canvas;

            // Проверяем, что canvas существует
            if (!canvasToSave) {
                console.error('Canvas element not found');
                return;
            }

            const link = document.createElement('a');
            const ts = new Date().toISOString().slice(0, 19).replace(/[:T-]/g, '_');
            link.download = `image_${ts}.${format === 'jpeg' ? 'jpg' : format}`;

            let dataUrl;
            if (format === 'jpeg') {
                dataUrl = canvasToSave.toDataURL(`image/${format}`, quality);
            } else {
                dataUrl = canvasToSave.toDataURL(`image/${format}`);
            }

            if (!dataUrl || dataUrl === 'data:,') return;

            link.href = dataUrl;

            // Для надежности добавляем в DOM, кликаем, удаляем
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error('ERROR in saveImage:', err);
        }
    }

    /**
     * Обновляет информацию об изображении в интерфейсе
     * @param {File} file - Файл изображения для получения информации
     */
    updateImageInfo(file) {
        if (!this.image) return;

        // Проверяем, что DOM элементы существуют
        if (!this.imageSizeElement || !this.imageWidthElement || !this.imageHeightElement || !this.fileSizeElement) {
            console.warn('Some image info elements are missing');
            return;
        }

        this.imageSizeElement.textContent = `${Math.round(file.size / 1024)} КБ`;
        this.imageWidthElement.textContent = `${this.canvas.width}px`;
        this.imageHeightElement.textContent = `${this.canvas.height}px`;

        // Приблизительный размер файла после сохранения
        this.canvas.toBlob((blob) => {
            if (blob) {
                this.fileSizeElement.textContent = `${Math.round(blob.size / 1024)} КБ`;
            }
        }, 'image/png');
    }

    /**
     * Обновляет отображение холста при изменении размера окна
     */
    updateCanvasDisplay() {
        // Можно добавить логику для адаптации отображения холста под размер окна
    }

    /**
     * Добавляет новый слой в менеджер слоев
     * @param {Object} layer - Объект слоя для добавления
     * @returns {Object} - Добавленный слой
     */
    addLayer(layer) {
        return this.layerManager.addLayer(layer);
    }

    /**
     * Устанавливает активный слой по ID
     * @param {string} layerId - ID слоя для установки как активного
     */
    setActiveLayer(layerId) {
        this.layerManager.setActiveLayerById(layerId);
    }

    /**
     * Возвращает активный слой
     * @returns {Object} - Активный слой
     */
    getActiveLayer() {
        return this.layerManager.activeLayer;
    }

    // Сохранение настроек пользователя в localStorage TODO Сохранять в расширении
    saveUserSettings() {
        // try {
        //     localStorage.setItem('editorToolSettings', JSON.stringify(this.toolSettings));
        // } catch (e) {
        //     console.error('Failed to save user settings:', e);
        // }
    }

    // Загрузка сохраненных настроек TODO Восстанавливать из расширения
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

    /**
     * Обновляет панель слоев
     */
    updateLayersPanel() {
        try {
            this.layerManager.updateLayersPanel();
        } catch (error) {
            console.error('Error updating layers panel:', error);
        }
    }

    /**
     * Настраивает перетаскивание слоев
     */
    setupLayerDragAndDrop() {
        try {
            this.layerManager.setupDragAndDrop();
        } catch (error) {
            console.error('Error setting up layer drag and drop:', error);
        }
    }

    /**
     * Перемещает слой в списке слоев
     * @param {string} draggedLayerId - ID перемещаемого слоя
     * @param {string} targetLayerId - ID целевого слоя
     * @param {boolean} insertAbove - Вставлять ли слой выше целевого
     */
    moveLayer(draggedLayerId, targetLayerId, insertAbove) {
        try {
            this.layerManager.moveLayer(draggedLayerId, targetLayerId, insertAbove);
        } catch (error) {
            console.error('Error moving layer:', error);
        }
    }

    /**
     * Перерисовывает весь холст и добавляет состояние в историю
     */
    redrawCanvas() {
        try {
            this.layerManager.redrawAllLayers();
            // Или можно вообще убрать
            if (this.historyManager) {
                this.historyManager.commit('Redraw canvas');
            }
        } catch (error) {
            console.error('Error redrawing canvas:', error);
        }
    }

    /**
     * Основной метод рендеринга, отрисовывающий изображение и все слои
     * @param {Object|null} dirtyRegion - Область для частичной перерисовки (опционально)
     */
    render(dirtyRegion = null) {
        try {
            if (!this.image) return;

            // Проверяем, что контекст существует
            if (!this.context) {
                console.error('Canvas context is not available');
                return;
            }

            // Если задана область изменений, рисуем только её, иначе - весь холст
            if (dirtyRegion) {
                // Ограничиваем область рисования
                this.context.save();
                this.context.beginPath();
                this.context.rect(dirtyRegion.x, dirtyRegion.y, dirtyRegion.width, dirtyRegion.height);
                this.context.clip();

                // Рисуем только в указанной области
                this.context.drawImage(this.image,
                    dirtyRegion.x, dirtyRegion.y, dirtyRegion.width, dirtyRegion.height,
                    dirtyRegion.x, dirtyRegion.y, dirtyRegion.width, dirtyRegion.height);
            } else {
                // Очистка всего холста
                this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

                // 1. Сначала отрисовываем изображение
                if (this.image) {
                    this.context.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
                }
            }

            // 2. Отрисовка всех видимых слоёв (растровые и векторные)
            // Растровые слои
            this.layerManager.redrawAllLayers();

            // Векторные слои
            this.layerManager.layers.forEach(l => {
                // if(!l.visible) return;

                if(l.type === 'blur' && l.rect) {
                    this.context.save();
                    this.context.filter = `blur(${l.params.radius}px)`;
                    this.context.drawImage(this.image,
                        l.rect.x, l.rect.y, l.rect.width, l.rect.height,
                        l.rect.x, l.rect.y, l.rect.width, l.rect.height);
                    this.context.restore();
                }

                if (l.type === 'highlight' && l.rect) {
                    this.context.strokeStyle = l.params.color;
                    this.context.lineWidth = l.params.thickness || this.LINE_WIDTH;
                    this.context.strokeRect(l.rect.x, l.rect.y, l.rect.width, l.rect.height);
                }

                if (l.type === 'line' && l.points) {
                    const { x1, y1, x2, y2 } = l.points;
                    this.context.strokeStyle = l.params.color || '#ff0000';
                    this.context.lineWidth = l.params.thickness || 2;
                    this.context.beginPath();
                    this.context.moveTo(x1, y1);
                    this.context.lineTo(x2, y2);

                    // Отрисовка стрелки
                    const ang = Math.atan2(y2 - y1, x2 - x1);
                    const arr = 10;
                    this.context.lineTo(x2 - arr * Math.cos(ang - Math.PI / 6), y2 - arr * Math.sin(ang - Math.PI / 6));
                    this.context.moveTo(x2, y2);
                    this.context.lineTo(x2 - arr * Math.cos(ang + Math.PI / 6), y2 - arr * Math.sin(ang + Math.PI / 6));
                    this.context.stroke();
                }

                if (l.type === 'text' && l.rect) {
                    this.context.save();
                    this.context.fillStyle = l.params.color || '#000000';
                    this.context.font = `${l.params.fontSize || 16}px Arial`;
                    this.context.textBaseline = 'top';
                    this.context.textAlign = 'left';
                    this.wrapTextInRect(
                        this.context, l.params.text || 'Текст',
                        l.rect.x, l.rect.y,
                        l.rect.width, l.rect.height,
                        l.params.fontSize || 16
                    );
                    this.context.restore();
                }
            });

            // 3. Отрисовка кроп-затенения (если есть кроп-слой)
            const cropLayer = this.layerManager.layers.find(l => l.type === 'crop');
            if (cropLayer && cropLayer.rect) {
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

                // Рисуем границу кропа и размеры
                this.context.strokeStyle = '#ffffff';
                this.context.lineWidth = 2;
                this.context.strokeRect(cropLayer.rect.x, cropLayer.rect.y,
                    cropLayer.rect.width, cropLayer.rect.height);

                this.context.fillStyle = '#ffffff';
                this.context.font = '14px Arial';
                this.context.fillText(
                    `${Helper.formatSize(cropLayer.rect.width)} × ${Helper.formatSize(cropLayer.rect.height)}`,
                    cropLayer.rect.x - 10,
                    cropLayer.rect.y - 10
                );
            }

            // 4. Отрисовка поверх интерактивных элементов инструментов
            const activeLayer = this.layerManager.activeLayer;

            // Отрисовка handles для активного слоя
            if (activeLayer?.rect) {
                this.drawHandles(this.context, activeLayer.rect);
            }

            // 5. Отрисовка точек для инструмента линии
            if (activeLayer?.type === 'line' && activeLayer.points) {
                this.drawLinePoints(this.context, activeLayer.points);
            }

            // Восстанавливаем контекст, если использовали clipping
            if (dirtyRegion) {
                this.context.restore();
            }
        } catch (error) {
            console.error('Error during rendering:', error);
        }
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
        try {
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
        } catch (error) {
            console.error('Error drawing handles:', error);
            ctx.restore(); // Ensure context is restored even if drawing fails
        }
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
        try {
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
        } catch (error) {
            console.error('Error drawing line points:', error);
            ctx.restore(); // Ensure context is restored even if drawing fails
        }
    }

    /**
     * Обработчик события нажатия мыши на оверлее
     * @param {MouseEvent} e - Событие мыши
     */
    onOverlayMouseDown(e) {
        try {
            const coords = this.getCanvasCoords(e);
            let hit = null;

            // 1. Поиск попадания в слой
            for (const l of this.layerManager.layers) {
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
                    if (this.historyManager) {
                        this.historyManager.commit('Edit text');
                    }
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

                if (this.historyManager) {
                    this.historyManager.beginAtomicOperation('Resize layer');
                }
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

                    if (this.historyManager) {
                        this.historyManager.beginAtomicOperation('Resize layer');
                    }
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

                if (this.historyManager) {
                  this.historyManager.beginAtomicOperation('Resize layer');
                }
                return;
            }

            // 7. Создание нового слоя — только если активен инструмент и он поддерживает прямоугольники/линии
            if (this.activeTool?.supportsCreation) {
                const type = this.activeTool.name;
                let newLayer;

                switch (type) {
                    case 'crop':
                        if (this.layerManager.layers.some(l => l.type === 'crop')) return;
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
                            params: { color: this.activeTool.color, thickness: this.activeTool.thickness }
                        };
                        break;
                    case 'line':
                        newLayer = {
                            type: 'line',
                            points: { x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y, color: '#ff0000' },
                            params: { color: this.activeTool.color, thickness: this.activeTool.thickness }
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

                if (this.historyManager) {
                    this.historyManager.beginAtomicOperation('Resize layer');
                }
            }
        } catch (error) {
            console.error('Error in onOverlayMouseDown:', error);
        }
    }

    /**
     * Обработчик события движения мыши
     * @param {MouseEvent} e - Событие мыши
     */
    onMouseMove(e) {
        try {
            if (!this.dragState) return;

            // Проверяем, что e и canvas существуют
            if (!e || !this.canvas) {
                console.error('Invalid event or canvas element');
                return;
            }

            const coords = this.getCanvasCoords(e);
            const { handle, layer, start, orig } = this.dragState;

            // Проверяем, что все необходимые объекты существуют
            if (!layer || !start || !orig) {
                console.error('Missing layer, start, or orig data');
                return;
            }

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
                    if (!orig || typeof orig.width === 'undefined' || typeof orig.height === 'undefined') {
                        console.error('Invalid orig dimensions for rectangle movement');
                        return;
                    }
                    layer.rect.x = Math.max(0, Math.min(this.canvas.width - orig.width, orig.x + dx));
                    layer.rect.y = Math.max(0, Math.min(this.canvas.height - orig.height, orig.y + dy));
                } else if (layer.points) {
                    if (!orig || typeof orig.x1 === 'undefined' || typeof orig.y1 === 'undefined' ||
                        typeof orig.x2 === 'undefined' || typeof orig.y2 === 'undefined') {
                        console.error('Invalid orig coordinates for point movement');
                        return;
                    }
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
        } catch (error) {
            console.error('Error in onMouseMove:', error);
        }
    }

    /**
     * Обработчик события отпускания мыши
     * @param {MouseEvent} e - Событие мыши
     */
    onMouseUp(e) {
        try {
            if (this.dragState) {
                if (this.historyManager) {
                    this.historyManager.endAtomicOperation();
                }
                this.dragState = null;
            }

            this.selectionOverlay.className = '';
            this.selectionOverlay.style.cursor = 'default';

            this.render();
            this.updateLayersPanel();
        } catch (error) {
            console.error('Error in onMouseUp:', error);
        }
    }

    /**
     * Обработчик события наведения мыши на оверлей
     * @param {MouseEvent} e - Событие мыши
     */
    onOverlayHover(e) {
        try {
            if (this.dragState) return; // не мешаем при drag

            // Проверяем, что e и canvas существуют
            if (!e || !this.canvas || !this.layerManager || !this.layerManager.layers) {
                console.error('Invalid event or canvas element or layer manager');
                return;
            }

            const coords = this.getCanvasCoords(e);
            let cls = '';

            // Проверяем, что HANDLES и selectionOverlay существуют
            if (!this.HANDLES || !this.selectionOverlay) {
                console.error('HANDLES or selectionOverlay not initialized');
                return;
            }

            this.layerManager.layers.forEach((l) => {
                if (!l.rect) return;

                // Проверяем, что l.rect имеет правильные свойства
                if (typeof l.rect.x === 'undefined' || typeof l.rect.y === 'undefined' ||
                    typeof l.rect.width === 'undefined' || typeof l.rect.height === 'undefined') {
                    console.warn('Invalid rect properties for layer', l);
                    return;
                }

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
        } catch (error) {
            console.error('Error in onOverlayHover:', error);
        }
    }

    /**
     * Обновляет прямоугольник слоя на основе перемещения ручки
     * @param {string} handle - Тип ручки ('nw', 'n', 'ne', и т.д.)
     * @param {Object} layer - Слой, который обновляется
     * @param {Object} start - Начальные координаты
     * @param {number} x - Координата x
     * @param {number} y - Координата y
     */
    updateRectFromHandle(handle, layer, start, x, y) {
        try {
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
        } catch (error) {
            console.error('Error in updateRectFromHandle:', error);
        }
    }

    /**
     * Сбрасывает текущий выбор слоя и состояние перетаскивания
     */
    resetSelection() {
        try {
            this.activeLayer = null;
            this.dragState = null;
            this.selectionOverlay.className = '';
            this.selectionOverlay.style.cursor = 'default';
            this.render();
            this.updateLayersPanel();
        } catch (error) {
            console.error('Error in resetSelection:', error);
        }
    }

    /**
     * Удаляет активный слой
     */
    deleteActiveLayer() {
        try {
            this.layerManager.deleteActiveLayer();
            this.render();
        } catch (error) {
            console.error('Error in deleteActiveLayer:', error);
        }
    }

    /**
     * Обертывает текст в прямоугольник с учетом максимальной ширины и высоты
     * @param {CanvasRenderingContext2D} context - Контекст 2D для рисования
     * @param {string} text - Текст для обертывания
     * @param {number} x - Координата x начала текста
     * @param {number} y - Координата y начала текста
     * @param {number} maxWidth - Максимальная ширина текста
     * @param {number} maxHeight - Максимальная высота текста
     * @param {number} fontSize - Размер шрифта
     */
    wrapTextInRect(context, text, x, y, maxWidth, maxHeight, fontSize) {
        if (!text || maxWidth <= 0 || maxHeight <= 0) return; // Проверяем на валидность

        try {
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
        } catch (error) {
            console.error('Error in wrapTextInRect:', error);
        }
    }

    /**
     * Форматирует размер файла в удобочитаемый формат
     * @param {number} bytes - Размер файла в байтах
     * @returns {string} - Форматированный размер файла
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        try {
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        } catch (error) {
            console.error('Error in formatFileSize:', error);
            return 'Unknown Size';
        }
    }

    /**
     * Получает координаты холста для события мыши
     * @param {MouseEvent} event - Событие мыши
     * @returns {Object} - Объект с координатами x и y
     */
    getCanvasCoords(event) {
        try {
            const wrapper = this.canvas.parentElement; // .canvas-wrapper
            const r = wrapper.getBoundingClientRect();
            const canvasR = this.canvas.getBoundingClientRect();
            // Защита от деления на ноль
            // if (!r.width || !r.height) return { x: 0, y: 0 };

            return {
                x: (event.clientX - canvasR.left) * (this.canvas.width / this.canvas.clientWidth),
                y: (event.clientY - canvasR.top) * (this.canvas.height / this.canvas.clientHeight)
            };
        } catch (error) {
            console.error('Error in getCanvasCoords:', error);
            return { x: 0, y: 0 };
        }
    }

    /**
     * Применяет кроп к изображению, обрезая его до выбранной области
     */
    applyCrop() {
        try {
            // Проверяем, что все необходимые компоненты существуют
            if (!this.layerManager || !this.layerManager.layers) {
                console.error('Layer manager or layers not initialized');
                return;
            }

            const cropLayer = this.layerManager.layers.find(l => l.type === 'crop');

            if (!cropLayer || !cropLayer.rect) {
                console.warn('No crop layer found or crop rectangle is invalid');
                return;
            }

            // Проверяем, что canvas и selectionOverlay существуют
            if (!this.canvas || !this.selectionOverlay) {
                console.error('Canvas or selection overlay not found');
                return;
            }

            this.selectionOverlay.style.width = `${this.canvas.clientWidth}px`;
            this.selectionOverlay.style.height = `${this.canvas.clientHeight}px`;

            const { x, y, width, height } = cropLayer.rect;

            if (width <= 0 || height <= 0) {
                console.warn('Invalid crop dimensions');
                return;
            }

            // Ensure original image is loaded before proceeding
            if (!this.originalImage || !this.originalImage.complete) {
                console.error('Original image not loaded');
                return;
            }

            // Convert coordinates from canvas space to original image space
            // The canvas might be displayed at a different size than its internal resolution
            // So we need to map the crop coordinates properly
            // We need to determine the relationship between current canvas and original image
            // Since the canvas might have been modified by previous crops, we need to calculate
            // the current scale based on the ratio of current canvas to original image

            // Calculate the scale factors based on current canvas vs original image
            const currentCanvasScaleX = this.canvas.width / this.originalImage.naturalWidth;
            const currentCanvasScaleY = this.canvas.height / this.originalImage.naturalHeight;

            // Validate scale factors to prevent division by zero
            if (currentCanvasScaleX <= 0 || currentCanvasScaleY <= 0) {
                console.error('Invalid canvas scale factors');
                return;
            }

            // Convert the crop coordinates from current canvas space to original image space
            const origCropX = Math.round(x / currentCanvasScaleX);
            const origCropY = Math.round(y / currentCanvasScaleY);
            const origCropWidth = Math.round(width / currentCanvasScaleX);
            const origCropHeight = Math.round(height / currentCanvasScaleY);

            // Ensure the calculated crop area is within the bounds of the original image
            let validX = Math.max(0, Math.min(origCropX, this.originalImage.naturalWidth - origCropWidth));
            let validY = Math.max(0, Math.min(origCropY, this.originalImage.naturalHeight - origCropHeight));
            const validWidth = Math.min(origCropWidth, this.originalImage.width - validX);
            const validHeight = Math.min(origCropHeight, this.originalImage.height - validY);

            if (validWidth <= 0 || validHeight <= 0) {
                console.warn('Calculated crop area is invalid');
                return;
            }

            // Создание нового холста для кадрированного изображения
            const tempCanvas = document.createElement('canvas');
            if (!tempCanvas) {
                console.error('Could not create temporary canvas');
                return;
            }

            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
                console.error('Could not get 2D context for temporary canvas');
                return;
            }

            tempCanvas.width = validWidth;
            tempCanvas.height = validHeight;

            // 1. Рисуем оригинальное изображение в области кропа
            tempCtx.drawImage(
                this.originalImage,
                validX, validY, validWidth, validHeight,
                0, 0, validWidth, validHeight
            );

            // 2. Применяем эффекты (blur, highlight, line, text) только к видимым частям в области кропа
            // Фильтруем crop слой и применяем остальные
            if (this.layerManager.layers && Array.isArray(this.layerManager.layers)) {
                this.layerManager.layers.filter(l => l.type !== 'crop').forEach(layer => {
                    // Для прямоугольных слоев проверяем попадание в область кропа
                    if (layer.rect) {
                        // Convert layer coordinates to original image space before applying crop offset
                        const layerOrigX = Math.round(layer.rect.x / currentCanvasScaleX);
                        const layerOrigY = Math.round(layer.rect.y / currentCanvasScaleY);

                        const layerX = layerOrigX - validX; // смещение относительно кропа
                        const layerY = layerOrigY - validY;

                        // Calculate original dimensions
                        const layerOrigWidth = Math.round(layer.rect.width / currentCanvasScaleX);
                        const layerOrigHeight = Math.round(layer.rect.height / currentCanvasScaleY);

                        // Пропускаем слои полностью вне области кропа
                        if (layerX + layerOrigWidth < 0 || layerY + layerOrigHeight < 0 ||
                            layerX > validWidth || layerY > validHeight) return;

                        if (layer.type === 'blur') {
                            // смещённые координаты относительно кропа
                            const shiftedX = layerOrigX - validX;
                            const shiftedY = layerOrigY - validY;
                            const shiftedR = shiftedX + layerOrigWidth;
                            const shiftedB = shiftedY + layerOrigHeight;

                            // Границы кроп-области
                            const cropLeft = 0, cropTop = 0, cropRight = validWidth, cropBottom = validHeight;

                            // Находим пересечение (видимую часть)
                            const visibleLeft = Math.max(cropLeft, shiftedX);
                            const visibleTop = Math.max(cropTop, shiftedY);
                            const visibleRight = Math.min(cropRight, shiftedR);
                            const visibleBottom = Math.min(cropBottom, shiftedB);
                            const visibleWidth = visibleRight - visibleLeft;
                            const visibleHeight = visibleBottom - visibleTop;

                            // Пропускаем, если пересечения нет
                            if (visibleWidth <= 0 || visibleHeight <= 0) return;

                            tempCtx.save();
                            tempCtx.filter = `blur(${layer.params.radius}px)`;
                            tempCtx.beginPath();
                            tempCtx.rect(0, 0, validWidth, validHeight);
                            tempCtx.clip();

                            // Источник: смещённые координаты НА ИСХОДНОМ ИЗОБРАЖЕНИИ — layer.rect.x, layer.rect.y!
                            const srcX = layerOrigX + (visibleLeft - shiftedX); // = layer.rect.x + отступ от левого края пересечения
                            const srcY = layerOrigY + (visibleTop - shiftedY);
                            // Размеры источника = размерам пересечения (1:1, без масштаба)
                            const srcW = visibleWidth;
                            const srcH = visibleHeight;

                            // Назначение: видимая часть внутри кропа
                            const dstX = visibleLeft;
                            const dstY = visibleTop;

                            tempCtx.drawImage(
                                this.originalImage,
                                srcX, srcY, srcW, srcH,
                                dstX, dstY, srcW, srcH
                            );
                            tempCtx.restore();
                        }
                        else if (layer.type === 'highlight') {
                            // Задаем цвет и толщину линий
                            tempCtx.strokeStyle = layer.params.color;
                            tempCtx.lineWidth = layer.params.thickness || this.LINE_WIDTH;

                            // смещённые координаты относительно кропа
                            const shiftedX = layerOrigX - validX;
                            const shiftedY = layerOrigY - validY;
                            const shiftedR = shiftedX + layerOrigWidth;
                            const shiftedB = shiftedY + layerOrigHeight;

                            // Границы кроп-области
                            const cropLeft = 0, cropTop = 0, cropRight = validWidth, cropBottom = validHeight;

                            // Находим пересечение (видимую часть)
                            const visibleLeft = Math.max(cropLeft, shiftedX);
                            const visibleTop = Math.max(cropTop, shiftedY);
                            const visibleRight = Math.min(cropRight, shiftedR);
                            const visibleBottom = Math.min(cropBottom, shiftedB);

                            const visibleWidth = visibleRight - visibleLeft;
                            const visibleHeight = visibleBottom - visibleTop;

                            // Пропускаем, если пересечения нет
                            if (visibleWidth <= 0 || visibleHeight <= 0) return;

                            tempCtx.save();
                            tempCtx.beginPath();
                            tempCtx.rect(0, 0, validWidth, validHeight); // clip к области кропа
                            tempCtx.clip();

                            // Рисуем видимую часть контура внутри кропа
                            tempCtx.strokeRect(shiftedX, shiftedY, layerOrigWidth, layerOrigHeight);
                            tempCtx.restore();
                        }
                        else if (layer.type === 'text') {
                            tempCtx.save();
                            tempCtx.fillStyle = layer.params.color;
                            tempCtx.font = `${layer.params.fontSize || 16}px Arial`;
                            tempCtx.textAlign = 'left';
                            tempCtx.textBaseline = 'top';

                            // Корректируем координаты текста относительно кропа
                            const textX = layerOrigX - validX;
                            const textY = layerOrigY - validY;

                            // Calculate the available space within the crop area for the text
                            const availableWidth = Math.min(layerOrigWidth, validWidth - textX);
                            const availableHeight = Math.min(layerOrigHeight, validHeight - textY);

                            this.wrapTextInRect(tempCtx, layer.params.text || 'Текст', textX, textY,
                                               availableWidth, availableHeight, layer.params.fontSize || 16);
                            tempCtx.restore();
                        }
                    }
                    else if (layer.type === 'line' && layer.points) {
                        // Convert line coordinates to original image space
                        const x1_orig = Math.round(layer.points.x1 / currentCanvasScaleX);
                        const y1_orig = Math.round(layer.points.y1 / currentCanvasScaleY);
                        const x2_orig = Math.round(layer.points.x2 / currentCanvasScaleX);
                        const y2_orig = Math.round(layer.points.y2 / currentCanvasScaleY);

                        const x1 = x1_orig - validX;
                        const y1 = y1_orig - validY;
                        const x2 = x2_orig - validX;
                        const y2 = y2_orig - validY;

                        // Проверяем, пересекается ли линия с областью кропа
                        if ((x1 < 0 && x2 < 0) || (x1 > validWidth && x2 > validWidth) ||
                            (y1 < 0 && y2 < 0) || (y1 > validHeight && y2 > validHeight)) {
                            return;
                        }

                        tempCtx.strokeStyle = layer.points.color;
                        tempCtx.lineWidth = layer.params.thickness || 2;
                        tempCtx.beginPath();
                        tempCtx.moveTo(x1, y1);
                        tempCtx.lineTo(x2, y2);

                        // Рисуем стрелку на конце
                        const angle = Math.atan2(y2 - y1, x2 - x1);
                        const arrowLength = 10;
                        tempCtx.lineTo(
                            x2 - arrowLength * Math.cos(angle - Math.PI / 6),
                            y2 - arrowLength * Math.sin(angle - Math.PI / 6)
                        );
                        tempCtx.moveTo(x2, y2);
                        tempCtx.lineTo(
                            x2 - arrowLength * Math.cos(angle + Math.PI / 6),
                            y2 - arrowLength * Math.sin(angle + Math.PI / 6)
                        );

                        tempCtx.stroke();
                    }
                });
            }

            // Сохраняем состояние для отмены
            if (this.historyManager) {
                this.historyManager.beginAtomicOperation('Move/resize/create layer');
            }

            // 3. Обновляем основной canvas и оригинальное изображение
            this.canvas.width = validWidth;
            this.canvas.height = validHeight;
            this.canvas.style.width = `${validWidth / this.DPR}px`;
            this.canvas.style.height = `${validHeight / this.DPR}px`;

            // Обновляем размеры selectionOverlay
            this.selectionOverlay.style.width = `${this.canvas.clientWidth}px`;
            this.selectionOverlay.style.height = `${this.canvas.clientHeight}px`;

            // Очищаем и рисуем обрезанное изображение
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.context.drawImage(tempCanvas, 0, 0);

            // Обновляем исходное изображение
            this.originalImage = new Image();
            this.originalImage.src = tempCanvas.toDataURL();
            this.image = this.originalImage;

            // Сохраняем координаты кропа ДО его удаления из списка слоёв
            const cropRect = { x: validX, y: validY, width: validWidth, height: validHeight };

            // Пересчитываем координаты всех слоев
            if (this.layerManager.layers && Array.isArray(this.layerManager.layers)) {
                this.layerManager.layers.forEach(layer => {
                    // Пропускаем crop слой при пересчете остальных слоёв
                    if(layer.id === cropLayer.id) {return;}

                    if (layer.rect) {
                        // Convert original coordinates back to the new canvas coordinate system
                        const newCanvasScaleX = this.canvas.width / this.originalImage.width;
                        const newCanvasScaleY = this.canvas.height / this.originalImage.height;

                        // Validate scale factors
                        if (newCanvasScaleX <= 0 || newCanvasScaleY <= 0) {
                            console.error('Invalid new canvas scale factors');
                            return;
                        }

                        layer.rect.x = Math.round((Math.round(layer.rect.x / currentCanvasScaleX) - cropRect.x) * newCanvasScaleX);
                        layer.rect.y = Math.round((Math.round(layer.rect.y / currentCanvasScaleY) - cropRect.y) * newCanvasScaleY);

                        layer.rect.width = Math.round(layer.rect.width / currentCanvasScaleX * newCanvasScaleX);
                        layer.rect.height = Math.round(layer.rect.height / currentCanvasScaleY * newCanvasScaleY);

                        // Обрезаем слои, выходящие за границы нового изображения
                        if (layer.rect.x < 0) {
                            layer.rect.width += layer.rect.x;
                            layer.rect.x = 0;
                        }
                        if (layer.rect.y < 0) {
                            layer.rect.height += layer.rect.y;
                            layer.rect.y = 0;
                        }
                        if (layer.rect.x + layer.rect.width > this.canvas.width) {
                            layer.rect.width = this.canvas.width - layer.rect.x;
                        }
                        if (layer.rect.y + layer.rect.height > this.canvas.height) {
                            layer.rect.height = this.canvas.height - layer.rect.y;
                        }
                    }

                    if (layer.points) {
                        // Convert original coordinates back to the new canvas coordinate system
                        const newCanvasScaleX = this.canvas.width / this.originalImage.width;
                        const newCanvasScaleY = this.canvas.height / this.originalImage.height;

                        // Validate scale factors
                        if (newCanvasScaleX <= 0 || newCanvasScaleY <= 0) {
                            console.error('Invalid new canvas scale factors for points');
                            return;
                        }

                        layer.points.x1 = Math.round((Math.round(layer.points.x1 / currentCanvasScaleX) - cropRect.x) * newCanvasScaleX);
                        layer.points.y1 = Math.round((Math.round(layer.points.y1 / currentCanvasScaleY) - cropRect.y) * newCanvasScaleY);
                        layer.points.x2 = Math.round((Math.round(layer.points.x2 / currentCanvasScaleX) - cropRect.x) * newCanvasScaleX);
                        layer.points.y2 = Math.round((Math.round(layer.points.y2 / currentCanvasScaleY) - cropRect.y) * newCanvasScaleY);

                        layer.points.x1 = Math.max(0, Math.min(this.canvas.width, layer.points.x1));
                        layer.points.y1 = Math.max(0, Math.min(this.canvas.height, layer.points.y1));
                        layer.points.x2 = Math.max(0, Math.min(this.canvas.width, layer.points.x2));
                        layer.points.y2 = Math.max(0, Math.min(this.canvas.height, layer.points.y2));
                    }
                });
            }

            const cropIndex = this.layerManager.layers.findIndex(l => l.id === cropLayer.id)
            if(cropIndex !== -1) {
                this.layerManager.layers.splice(cropIndex,1);
                if(this.layerManager.activeLayerIndex === cropIndex) {
                    this.layerManager.activeLayerIndex = -1;
                } else if (this.layerManager.activeLayerIndex > cropIndex) {
                    this.layerManager.activeLayer--;
                }
            }

            // Обновляем базовый слой
            if (this.layerManager.layers.length > 0 && this.layerManager.layers[0].type === 'base') {
                const baseLayer = this.layerManager.layers[0];
                // Копируем данные с холста в базовый слой
                baseLayer.imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            }

            // Закомментировано так как с этим кодом не правильно работал кроп
            // this.render();

            // Обновляем панель слоев
            this.layerManager.updateLayersPanel();

            if (this.historyManager) {
                this.historyManager.commit('Apply crop');
            }

            // Обновляем информацию об изображении
            const newFile = new File([this.canvas.toDataURL()], "cropped_image.png");
            this.updateImageInfo(newFile);

            // Сбрасываем активный инструмент
            this.setActiveTool(null);
        } catch (error) {
            console.error('Error during crop operation:', error);
        }
    }

    /**
     * Глубокое слияние объектов
     * @param {Object} target - Целевой объект
     * @param {Object} source - Исходный объект для слияния
     * @returns {Object} - Результат глубокого слияния
     */
    deepMerge(target, source) {
        try {
            // Проверяем, что оба значения являются объектами
            if (typeof target !== 'object' || target === null || Array.isArray(target) ||
                typeof source !== 'object' || source === null || Array.isArray(source)) {
                return source;
            }

            // Создаем копию target, чтобы не изменять оригинальный объект
            const output = { ...target };

            // Проходим по всем ключам в source
            for (const key in source) {
                if (source.hasOwnProperty(key)) {
                    // Если ключ существует в обоих объектах и оба значения являются объектами,
                    // рекурсивно вызываем deepMerge
                    if (key in target && typeof target[key] === 'object' && typeof source[key] === 'object' &&
                        target[key] !== null && source[key] !== null &&
                        !Array.isArray(target[key]) && !Array.isArray(source[key])) {
                        output[key] = this.deepMerge(target[key], source[key]);
                    } else {
                        // В противном случае, просто присваиваем значение из source
                        output[key] = source[key];
                    }
                }
            }

            return output;
        } catch (error) {
            console.error('Error in deepMerge:', error);
            // Возвращаем target в случае ошибки, чтобы не потерять данные
            return { ...target };
        }
    }

    /**
     * Загружает номер версии из manifest.json в корне расширения
     */
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

    /**
     * Удаляет все обработчики событий и освобождает ресурсы
     */
    destroy() {
        try {
            // Удаляем обработчики событий с DOM-элементов
            document.getElementById('fileBtn')?.removeEventListener('click', this.fileInput.click);
            this.fileInput?.removeEventListener('change', this.loadImage);

            document.getElementById('saveBtn')?.removeEventListener('click', this.applyCropAndSave);

            const undoBtn = document.getElementById('undoBtn');
            if (undoBtn) undoBtn.removeEventListener('click', this.boundUndoClick);
            // document.getElementById('undoBtn')?.removeEventListener('click', this.undo);

            document.getElementById('cropBtn')?.removeEventListener('click', this.setActiveTool);
            document.getElementById('blurBtn')?.removeEventListener('click', this.setActiveTool);
            document.getElementById('highlightBtn')?.removeEventListener('click', this.setActiveTool);
            document.getElementById('lineBtn')?.removeEventListener('click', this.setActiveTool);
            document.getElementById('textBtn')?.removeEventListener('click', this.setActiveTool);

            window?.removeEventListener('resize', this.updateCanvasDisplay);

            document.getElementById('layersList')?.removeEventListener('click', this.setActiveLayer);
            document.removeEventListener('keydown', this.deleteActiveLayer);

            document.removeEventListener('mousemove', this.onMouseMove);
            document.removeEventListener('mouseup', this.onMouseUp);

            // Удаляем обработчики с selectionOverlay
            this.selectionOverlay?.removeEventListener('mousedown', this.onOverlayMouseDown);
            this.selectionOverlay?.removeEventListener('mousemove', this.onOverlayHover);

            // Удаляем обработчики с активного инструмента
            if (this.activeTool) {
                this.activeTool.deactivate();
            }

            // Удаляем обработчики с selectionOverlay для инструментов
            this.selectionOverlay?.removeEventListener('mousedown', this.boundToolMouseDown);
            this.selectionOverlay?.removeEventListener('mousemove', this.boundToolMouseMove);
            this.selectionOverlay?.removeEventListener('mouseup', this.boundToolMouseUp);

            // Очищаем ссылки на DOM-элементы
            this.canvas = null;
            this.context = null;
            this.selectionOverlay = null;
            this.fileInput = null;
            this.imageSizeElement = null;
            this.imageWidthElement = null;
            this.imageHeightElement = null;
            this.fileSizeElement = null;

            // Очищаем данные изображения
            this.image = null;
            this.originalImage = null;

            // Очищаем историю
            this.history = [];
            this.historyPosition = -1;

            // Уничтожаем менеджер слоев
            this.layerManager?.destroy();

            console.log('ImageEditor destroyed successfully');
        } catch (error) {
            console.error('Error during destruction:', error);
        }
    }
}