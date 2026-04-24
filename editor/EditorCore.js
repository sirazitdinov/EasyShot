// EditorCore.js

import CropTool from './Tools/CropTool.js';
import BlurTool from './Tools/BlurTool.js';
import RectangleTool from './Tools/RectangleTool.js';
import HighlighterTool from './Tools/HighlighterTool.js';
import LineTool from './Tools/LineTool.js';
import TextTool from './Tools/TextTool.js';
import ToolSettingsUI from './Tools/ToolSettingsUI.js';
import LayerManager from './LayerManager.js';
import HistoryManager from './HistoryManager.js';
import Helper from './Helper.js';

import { wrapTextInRect } from './utils/canvas.js';

import { validateCropData, calculateCropCoordinates } from './crop/coordinates.js';
import { createCroppedCanvas } from './crop/canvas.js';
import { applyLayersToCroppedCanvas } from './crop/layerApplier.js';
import { updateLayersAfterCrop } from './crop/layerUpdater.js';

import CanvasManager from './core/CanvasManager.js';
import SelectionRenderer from './core/SelectionRenderer.js';
import EventManager from './core/EventManager.js';

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

    // Создание подмодулей ядра
    this.canvasManager = new CanvasManager(this);
    this.selectionRenderer = new SelectionRenderer(this);
    this.eventManager = new EventManager(this);

    // Обработчики для кнопок
    this.boundUndoClick = () => {
      if (this.historyManager) this.historyManager.undo();
    };
    this.boundRedoClick = () => {
      if (this.historyManager) this.historyManager.redo();
    };

    // Обработчики для загрузки/сохранения
    this.boundFileClick = () => this.fileInput.click();
    this.boundFileChange = (e) => this.loadImage(e.target.files[0]);
    this.boundSaveClick = async () => {
      await this.applyCrop();
      this.saveImage();
    };

    // Обработчики для инструментов
    this.boundCropClick = () => this.setActiveTool(this.tools.crop);
    this.boundBlurClick = () => this.setActiveTool(this.tools.blur);
    this.boundRectangleClick = () => this.setActiveTool(this.tools.rectangle);
    this.boundHighlighterClick = () => this.setActiveTool(this.tools.highlighter);
    this.boundLineClick = () => this.setActiveTool(this.tools.line);
    this.boundTextClick = () => this.setActiveTool(this.tools.text);

    // Инициализация
    this.init();
  }

  /**
     * Прокси для dragState, хранящегося в EventManager
     */
  get dragState() {
    return this.eventManager?.dragState ?? null;
  }

  set dragState(value) {
    if (this.eventManager) {
      this.eventManager.dragState = value;
    }
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
      highlight: { color: '#ff0000', thickness: 2 },
      crop: { aspectRatio: 'free' },
      line: { color: '#ff0000', thickness: 2 },
      blur: { radius: 5 }
    };

    // UI элементы для отображения настроек
    this.settingsElements = {
      highlight: {
        colorInput: document.getElementById('highlightColor'),
        colorLabel: document.getElementById('highlightColorLabel'),
        thicknessInput: document.getElementById('thickness'),
        thicknessLabel: document.getElementById('thicknessLabel')
      },
      highlighter: {
        colorInput: document.getElementById('highlighterColor'),
        colorLabel: document.getElementById('highlighterColorLabel'),
        opacityInput: document.getElementById('highlighterOpacity'),
        opacityLabel: document.getElementById('highlighterOpacityLabel')
      },
      crop: {},
      blur: {
        radiusInput: document.getElementById('blurRadius'),
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
    };
  }

  /**
     * Инициализирует инструменты редактора
     */
  initializeTools() {
    // Создание инструментов
    this.tools = {
      crop: new CropTool(this, this.settingsElements['crop']),
      blur: new BlurTool(this, this.settingsElements['blur']),
      rectangle: new RectangleTool(this, this.settingsElements['highlight']),
      highlighter: new HighlighterTool(this, this.settingsElements['highlighter']),
      line: new LineTool(this, this.settingsElements['line']),
      text: new TextTool(this, this.settingsElements['text'])
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
    // Состояние для троттлинга onMouseMove через requestAnimationFrame
    this._rafId = null;
    this._pendingDragState = null;

    // Throttle render() через requestAnimationFrame
    this._rafRenderId = null;
    this._pendingDirtyRegion = null;
  }

  /**
     * Инициализирует редактор изображений
     * Устанавливает начальный холст, инициализирует менеджер слоев,
     * добавляет обработчики событий и обновляет кнопки тулбара
     */
  init() {
    this.canvasManager.setupCanvas();
    this.layerManager.init(); // Инициализация менеджера слоев
    this.initEventListeners();
    this.updateToolbarButtons();
    this.loadVersion().catch(err => {
      console.error('Failed to load version:', err);
    });
  }

  /**
     * Устанавливает активный инструмент для редактора
     * @param {Object} tool - Инструмент, который нужно установить как активный
     */
  setActiveTool(tool) {
    if (this.activeTool === tool) return;

    // 1. Деактивируем предыдущий инструмент
    if (this.activeTool) {
      try {
        // Дадим инструменту убрать свои overlay/preview
        if (typeof this.activeTool.cleanupOverlay === 'function') {
          this.activeTool.cleanupOverlay();
        }
        if (typeof this.activeTool.deactivate === 'function') {
          this.activeTool.deactivate();
        }
      } catch (error) {
        console.error('Error deactivating tool', error);
      }
    }

    // 2. Назначаем новый инструмент
    this.activeTool = tool || null;

    // 3. Настраиваем overlay под новый инструмент
    if (this.selectionOverlay) {

      // ✅ Сначала полностью сбрасываем overlay
      this.selectionOverlay.style.cssText = '';
      this.selectionOverlay.className = '';

      // ✅ Очищаем все дочерние элементы от предыдущего инструмента
      while (this.selectionOverlay.firstChild) {
        this.selectionOverlay.removeChild(this.selectionOverlay.firstChild);
      }

      // ✅ Устанавливаем базовые размеры
      if (this.canvas) {
        this.selectionOverlay.style.width = `${this.canvas.clientWidth}px`;
        this.selectionOverlay.style.height = `${this.canvas.clientHeight}px`;
      }

      this.selectionOverlay.style.position = 'absolute';
      this.selectionOverlay.style.pointerEvents = 'auto';

      if (this.activeTool) {
        try {
          if (typeof this.activeTool.setupOverlay === 'function') {
            this.activeTool.setupOverlay(this.selectionOverlay);
          }
          if (typeof this.activeTool.activate === 'function') {
            this.activeTool.activate();
          }
          if (typeof this.activeTool.updateOverlay === 'function') {
            this.activeTool.updateOverlay();
          }
        } catch (error) {
          console.error('Error activating tool', error);
        }
      }
    }

    // 4. Обновляем UI настроек
    try {
      if (this.toolSettingsUI && typeof this.toolSettingsUI.renderSettings === 'function') {
        this.toolSettingsUI.renderSettings(tool);
      }
    } catch (error) {
      console.error('Error rendering tool settings', error);
    }

    // 5. Обновляем подсветку кнопок тулбара
    this.updateToolbarButtons();
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

    // Обновление состояния кнопок undo/redo
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) {
      undoBtn.disabled = !this.historyManager?.canUndo();
    }
    if (redoBtn) {
      redoBtn.disabled = !this.historyManager?.canRedo();
    }
  }

  /**
     * Инициализирует обработчики событий для различных действий в редакторе
     * Устанавливает слушатели для загрузки изображения, сохранения, отмены, инструментов, слоев и т.д.
     */
  initEventListeners() {
    // Загрузка изображения
    document.getElementById('fileBtn').addEventListener('click', this.boundFileClick);
    this.fileInput.addEventListener('change', this.boundFileChange);

    // Сохранение изображения
    document.getElementById('saveBtn').addEventListener('click', this.boundSaveClick);

    // Отмена действия
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.addEventListener('click', this.boundUndoClick);

    // Повторить действие
    const redoBtn = document.getElementById('redoBtn');
    if (redoBtn) {
      redoBtn.addEventListener('click', this.boundRedoClick);
    }

    // Кнопки инструментов
    document.getElementById('cropBtn').addEventListener('click', this.boundCropClick);
    document.getElementById('blurBtn').addEventListener('click', this.boundBlurClick);
    document.getElementById('rectangleBtn').addEventListener('click', this.boundRectangleClick);
    document.getElementById('highlighterBtn').addEventListener('click', this.boundHighlighterClick);
    document.getElementById('lineBtn').addEventListener('click', this.boundLineClick);
    document.getElementById('textBtn').addEventListener('click', this.boundTextClick);

    // Обработчики мыши, клавиатуры, оверлея, resize, paste
    this.eventManager.init();
  }

  /**
     * Сбрасывает состояние редактора к начальному состоянию
     * Вызывается при загрузке нового изображения
     */
  resetEditor() {
    // Сброс активного инструмента
    if (this.activeTool) {
      try {
        if (typeof this.activeTool.cleanupOverlay === 'function') {
          this.activeTool.cleanupOverlay();
        }
        if (typeof this.activeTool.deactivate === 'function') {
          this.activeTool.deactivate();
        }
      } catch (error) {
        console.error('Error deactivating tool during reset:', error);
      }
      this.activeTool = null;
    }

    // Сброс изображения
    this.image = null;
    this.originalImage = null;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Очистка холста
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.fillStyle = '#fff';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Сброс overlay
    if (this.selectionOverlay) {
      this.selectionOverlay.style.cssText = '';
      this.selectionOverlay.className = '';
      while (this.selectionOverlay.firstChild) {
        this.selectionOverlay.removeChild(this.selectionOverlay.firstChild);
      }
      this.selectionOverlay.style.width = `${this.canvas.clientWidth}px`;
      this.selectionOverlay.style.height = `${this.canvas.clientHeight}px`;
    }

    // Сброс менеджера слоев
    if (this.layerManager) {
      this.layerManager.layers = [];
      this.layerManager.activeLayerIndex = -1;
      this.layerManager.dragState = null;
    }

    // Сброс истории
    if (this.historyManager) {
      this.historyManager.clear();
    }

    // Обновление UI
    this.updateToolbarButtons();
    if (this.layerManager) {
      this.layerManager.updateLayersPanel();
    }
  }

  /**
     * Загружает изображение в редактор
     * @param {File} file - Файл изображения для загрузки
     */
  loadImage(file) {
    // Полный сброс редактора перед загрузкой нового изображения
    this.resetEditor();

    if (!file) return;

    // Проверка типа файла
    if (!file.type.match('image.*')) {
      alert('Пожалуйста, выберите файл изображения (JPEG, PNG, GIF, и т.д.)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        alert('Не удалось загрузить изображение. Возможно, файл повреждён или имеет неподдерживаемый формат.');
      };

      img.onload = () => {
        // Храним canvas в full-resolution (в пикселях источника)
        this.canvas.width = img.naturalWidth;
        this.canvas.height = img.naturalHeight;

        // Отображаем canvas на экране в CSS-пикселях (умножаем на 1/drp)
        this.canvas.style.width = `${img.naturalWidth / this.DPR}px`;
        this.canvas.style.height = `${img.naturalHeight / this.DPR}px`;

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
        if (this.layerManager.layers.length > 0) {
          const baseLayer = this.layerManager.layers[0];
          this.context.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
          baseLayer.imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
          this.layerManager.updateLayersPanel();
        }

        // Сброс истории
        if (this.historyManager) {
          this.historyManager.clear();
          this.historyManager.commit('Load image');
        }

      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
     * Обрабатывает вставку изображения из буфера обмена (Ctrl+V / Cmd+V)
     * @param {ClipboardEvent} e - Событие вставки
     */
  handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const imageItem = Array.from(items).find(item => item.type.startsWith('image/'));

    if (!imageItem) return;

    e.preventDefault();

    const blob = imageItem.getAsFile();
    const file = new File([blob], `pasted-image.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
    this.loadImage(file);
  }

  /**
     * Сохраняет текущее изображение в указанном формате
     * @param {string} format - Формат изображения ('png', 'jpeg', и т.д.)
     * @param {number} quality - Качество изображения (от 0 до 1)
     */
  saveImage(format = 'png', quality = 0.9) {

    try {
      // Временно снимаем выделение, чтобы ручки управления не попали на сохранённое изображение
      const savedActiveLayerIndex = this.layerManager.activeLayerIndex;
      this.layerManager.activeLayerIndex = -1;
      this.render();

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

      // Восстанавливаем выделение
      this.layerManager.activeLayerIndex = savedActiveLayerIndex;
      this.render();

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

    // Приблизительный размер файла после сохранения (с debounce)
    if (this._fileSizeDebounceTimer) {
      clearTimeout(this._fileSizeDebounceTimer);
    }
    this._fileSizeDebounceTimer = setTimeout(() => {
      if (!this.canvas || !this.fileSizeElement) return;
      this.canvas.toBlob((blob) => {
        if (blob && this.fileSizeElement) {
          this.fileSizeElement.textContent = `${Math.round(blob.size / 1024)} КБ`;
        }
      }, 'image/png');
    }, 300);
  }

  /**
     * Основной метод перерисовки (прокси на CanvasManager).
     * Throttle через requestAnimationFrame: если render вызывается несколько
     * раз за кадр, dirtyRegion'ы объединяются и отрисовка происходит один раз.
     * @param {Object|null} dirtyRegion - { x, y, width, height } для частичного рендера.
     */
  render(dirtyRegion = null) {
    if (this._rafRenderId) {
      // Уже запланирован кадр — объединяем регионы
      this._pendingDirtyRegion = Helper.mergeDirtyRegions(this._pendingDirtyRegion, dirtyRegion);
      return;
    }

    this._pendingDirtyRegion = dirtyRegion;

    this._rafRenderId = requestAnimationFrame(() => {
      this._rafRenderId = null;
      const region = this._pendingDirtyRegion;
      this._pendingDirtyRegion = null;
      this.canvasManager.render(region);
    });
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
     * Переключает активный инструмент на инструмент, соответствующий типу слоя
     * @param {string} layerType - Тип слоя ('blur', 'rectangle', 'highlighter', 'line', 'text', 'crop')
     */
  switchToLayerTool(layerType) {
    // Маппинг типов слоёв к инструментам
    const toolMap = {
      blur: 'blur',
      rectangle: 'rectangle',
      highlighter: 'highlighter',
      line: 'line',
      text: 'text',
      crop: 'crop'
    };

    const toolName = toolMap[layerType];
    if (toolName && this.tools[toolName]) {
      this.setActiveTool(this.tools[toolName]);
    }
  }

  /**
     * Возвращает активный слой
     * @returns {Object} - Активный слой
     */
  getActiveLayer() {
    return this.layerManager.activeLayer;
  }

  /**
     * Getter для активного слоя (делегирование в layerManager)
     */
  get activeLayer() {
    return this.layerManager?.activeLayer || null;
  }

  /**
     * Setter для активного слоя (делегирование в layerManager)
     */
  set activeLayer(layer) {
    if (this.layerManager) {
      this.layerManager.activeLayer = layer;
    }
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
     * Сбрасывает текущий выбор слоя и состояние перетаскивания
     */
  resetSelection() {
    try {
      this.activeLayer = null;
      this.dragState = null;
      this.selectionOverlay.className = '';
      this.selectionOverlay.style.cursor = 'default';
      this.setActiveTool(null);
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
      const deletedLayer = this.layerManager.activeLayer;
      const wasCrop = this.layerManager.activeLayer?.type === 'crop';

      this.layerManager.deleteActiveLayer();

      // Сбрасываем currentLayer у всех инструментов, которые могли ссылаться на удалённый слой
      Object.values(this.tools).forEach(tool => {
        if (tool.currentLayer?.id === deletedLayer?.id) {
          tool.currentLayer = null;
        }
        // Скрываем preview элементы всех инструментов
        if (typeof tool.removePreviewElement === 'function') {
          tool.removePreviewElement();
        }
      });

      if (wasCrop) {
        // Если активен crop-инструмент, очищаем его overlay
        if (this.activeTool?.name === 'crop') {
          // Даём инструменту убрать свои overlay/preview элементы
          if (typeof this.activeTool.cleanupOverlay === 'function') {
            this.activeTool.cleanupOverlay();
          }
        }

        // ✅ ВАЖНО: Сбрасываем стили selectionOverlay в любом случае
        if (this.selectionOverlay) {
          this.selectionOverlay.style.left = '';
          this.selectionOverlay.style.top = '';
          this.selectionOverlay.style.width = '';
          this.selectionOverlay.style.height = '';
          this.selectionOverlay.style.position = 'absolute';

          // ✅ Сбрасываем pointerEvents, чтобы overlay снова мог получать события
          this.selectionOverlay.style.pointerEvents = 'auto';

          // Сбрасываем display на случай, если он был изменён
          this.selectionOverlay.style.display = '';

          // Сбрасываем border и background
          this.selectionOverlay.style.border = '';
          this.selectionOverlay.style.backgroundColor = '';

          // ✅ Восстанавливаем исходные размеры overlay под размер canvas
          if (this.canvas) {
            this.selectionOverlay.style.width = `${this.canvas.clientWidth}px`;
            this.selectionOverlay.style.height = `${this.canvas.clientHeight}px`;
          }
        }

        // ✅ Дополнительно: если активен какой-то инструмент, обновляем его overlay
        if (this.activeTool && this.activeTool !== this.tools.crop) {
          this.activeTool.setupOverlay(this.selectionOverlay);
          this.activeTool.updateOverlay();
        }
      }

      // Сбрасываем активный слой после удаления
      this.activeLayer = null;
      this.render();
      this.updateLayersPanel();
    } catch (error) {
      console.error('Error in deleteActiveLayer:', error);
    }
  }

  /**
     * Применяет кроп к изображению, обрезая его до выбранной области
     */
  async applyCrop() {
    try {
      // 1. Валидация и подготовка
      const cropData = validateCropData(this.layerManager, this.canvas, this.selectionOverlay, this.originalImage);
      if (!cropData) return;

      // 2. Расчёт координат кропа в пространстве оригинального изображения
      const cropCoords = calculateCropCoordinates(cropData.cropLayer.rect, this.canvas, this.originalImage);
      if (!cropCoords) return;

      // 3. Создание временного canvas и отрисовка кропнутого изображения
      const { tempCanvas, tempCtx } = createCroppedCanvas(cropCoords, this.originalImage);
      if (!tempCanvas) return;

      // 4. Применение эффектов слоёв к кропнутому изображению
      applyLayersToCroppedCanvas(tempCtx, this.layerManager.layers, cropCoords, this.originalImage, wrapTextInRect, this.CONSTANTS?.LINE_WIDTH);

      // 5. Обновление основного canvas и данных изображения
      await this._updateCanvasWithCroppedImage(tempCanvas, cropCoords);

      // 6. Пересчёт координат слоёв и удаление crop-слоя
      updateLayersAfterCrop(this.layerManager, cropCoords, cropData.cropLayer, this.context);

      // 7. Финализация: история, UI, сброс инструмента
      await this._finalizeCrop();

    } catch (error) {
      console.error('Error during crop operation:', error);
    }
  }

  /**
     * Обновляет основной canvas и данные изображения после кропа
     * @param {HTMLCanvasElement} tempCanvas - Временный canvas с кропнутым изображением
     * @param {Object} cropCoords - Координаты кропа
     */
  async _updateCanvasWithCroppedImage(tempCanvas, cropCoords) {
    const { validWidth, validHeight } = cropCoords;

    if (this.historyManager) {
      this.historyManager.beginAtomicOperation('Apply crop');
    }

    this.canvas.width = validWidth;
    this.canvas.height = validHeight;
    this.canvas.style.width = `${validWidth / this.DPR}px`;
    this.canvas.style.height = `${validHeight / this.DPR}px`;

    this.selectionOverlay.style.width = `${this.canvas.clientWidth}px`;
    this.selectionOverlay.style.height = `${this.canvas.clientHeight}px`;

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(tempCanvas, 0, 0);

    const dataURL = tempCanvas.toDataURL();
    this.originalImage = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataURL;
    });
    this.image = this.originalImage;

    // Сохраняем координаты кропа для последующего пересчёта слоёв
    this._cropCoords = {
      x: cropCoords.validX,
      y: cropCoords.validY,
      width: validWidth,
      height: validHeight
    };
  }

  /**
     * Финализирует операцию кропа: история, UI, сброс инструмента
     */
  async _finalizeCrop() {
    try {
      // Обновляем панель слоев
      this.layerManager.updateLayersPanel();

      // Фиксируем состояние в истории
      if (this.historyManager) {
        this.historyManager.commit('Apply crop');
      }

      // Обновляем информацию об изображении
      const blob = await new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
      const newFile = new File([blob], 'cropped_image.png', { type: 'image/png' });
      this.updateImageInfo(newFile);

      // Очищаем временные данные
      this._cropCoords = null;

      // Сбрасываем активный инструмент
      this.setActiveTool(null);
    } catch (error) {
      console.error('Error finalizing crop:', error);
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
        if (Object.prototype.hasOwnProperty.call(source, key)) {
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
      document.getElementById('fileBtn')?.removeEventListener('click', this.boundFileClick);
      this.fileInput?.removeEventListener('change', this.boundFileChange);

      document.getElementById('saveBtn')?.removeEventListener('click', this.boundSaveClick);

      const undoBtn = document.getElementById('undoBtn');
      if (undoBtn) undoBtn.removeEventListener('click', this.boundUndoClick);

      const redoBtn = document.getElementById('redoBtn');
      if (redoBtn) redoBtn.removeEventListener('click', this.boundRedoClick);

      document.getElementById('cropBtn')?.removeEventListener('click', this.boundCropClick);
      document.getElementById('blurBtn')?.removeEventListener('click', this.boundBlurClick);
      document.getElementById('rectangleBtn')?.removeEventListener('click', this.boundRectangleClick);
      document.getElementById('highlighterBtn')?.removeEventListener('click', this.boundHighlighterClick);
      document.getElementById('lineBtn')?.removeEventListener('click', this.boundLineClick);
      document.getElementById('textBtn')?.removeEventListener('click', this.boundTextClick);

      // Уничтожаем EventManager (удаляет mouse/keyboard/overlay/resize/paste)
      this.eventManager?.destroy();

      // Удаляем обработчики с активного инструмента
      if (this.activeTool && typeof this.activeTool.deactivate === 'function') {
        this.activeTool.deactivate();
      }

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

      // Очищаем инструменты
      this.tools = null;
      this.activeTool = null;

      // Очищаем настройки
      this.toolSettings = null;
      this.settingsElements = null;

      // Очищаем подмодули
      this.canvasManager = null;
      this.selectionRenderer = null;
      this.eventManager = null;

      // Уничтожаем менеджер слоев
      this.layerManager?.destroy();
      this.layerManager = null;

      // Уничтожаем историю
      this.historyManager?.destroy();
      this.historyManager = null;

      console.log('ImageEditor destroyed successfully');
    } catch (error) {
      console.error('Error during destruction:', error);
    }
  }
}
