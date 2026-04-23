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

import * as geometry from './utils/geometry.js';
import { wrapTextInRect, formatFileSize } from './utils/canvas.js';

import * as blurRenderer from './renderers/blurRenderer.js';
import * as rectangleRenderer from './renderers/rectangleRenderer.js';
import * as highlightRenderer from './renderers/highlightRenderer.js';
import * as highlighterRenderer from './renderers/highlighterRenderer.js';
import * as lineRenderer from './renderers/lineRenderer.js';
import * as textRenderer from './renderers/textRenderer.js';

import { validateCropData, calculateCropCoordinates } from './crop/coordinates.js';
import { createCroppedCanvas } from './crop/canvas.js';
import {
  applyLayersToCroppedCanvas,
  applyRectLayerToCroppedCanvas,
  applyLineLayerToCroppedCanvas
} from './crop/layerApplier.js';
import {
  updateLayersAfterCrop,
  updateRectLayerCoordinates,
  updateLineLayerCoordinates
} from './crop/layerUpdater.js';

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

    // Обработчики для кнопок
    this.boundFileClick = () => this.fileInput.click();
    this.boundFileChange = (e) => this.loadImage(e.target.files[0]);
    this.boundSaveClick = async () => {
      await this.applyCrop();
      this.saveImage();
    };
    this.boundRedoClick = () => {
      if (this.historyManager) this.historyManager.redo();
    };

    // Обработчики для инструментов
    this.boundCropClick = () => this.setActiveTool(this.tools.crop);
    this.boundBlurClick = () => this.setActiveTool(this.tools.blur);
    this.boundRectangleClick = () => this.setActiveTool(this.tools.rectangle);
    this.boundHighlighterClick = () => this.setActiveTool(this.tools.highlighter);
    this.boundLineClick = () => this.setActiveTool(this.tools.line);
    this.boundTextClick = () => this.setActiveTool(this.tools.text);

    // Обработчики для событий окна и документа
    this.boundResize = () => this.updateCanvasDisplay();
    this.boundPaste = (e) => this.handlePaste(e);
    this.boundLayersListClick = (e) => {
      const layerItem = e.target.closest('.layer-item');
      if (layerItem) {
        this.setActiveLayer(layerItem.dataset.layerId);
      }
    };
    this.boundKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.resetSelection();
        return;
      }
      if (e.key === 'Delete' && this.layerManager.activeLayer) {
        e.preventDefault();
        this.deleteActiveLayer();
      }
    };

    // Обработчики для мыши
    this.boundMouseMove = (e) => this.onMouseMove(e);
    this.boundMouseUp = (e) => this.onMouseUp(e);
    this.boundOverlayMouseDown = (e) => this.onOverlayMouseDown(e);
    this.boundOverlayHover = (e) => this.onOverlayHover(e);

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
    this.loadVersion().catch(err => {
      console.error('Failed to load version:', err);
    });
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
      // pointerEvents должен быть 'auto' всегда, когда есть активный инструмент
      // или когда инструмент был деактивирован (чтобы другие обработчики работали)
      // this.selectionOverlay.style.pointerEvents = 'auto';
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

    // Обработка изменения размера окна
    window.addEventListener('resize', this.boundResize);

    // Вставка изображения из буфера обмена
    document.addEventListener('paste', this.boundPaste);

    // Удаление слоя по Delete
    document.addEventListener('keydown', this.boundKeyDown);

    // Обработчики для мыши
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);

    // Привязка обработчиков для selectionOverlay
    this.selectionOverlay.addEventListener('mousedown', this.boundOverlayMouseDown);
    this.selectionOverlay.addEventListener('mousemove', this.boundOverlayHover);
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

        // Инициализация слоев
        // this.initLayers();

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
     * Основной метод перерисовки
     * @param {Object|null} dirtyRegion - { x, y, width, height } для частичного рендера.
     */
  render(dirtyRegion = null) {
    if (!this.image || !this.context || !this.canvas) {
      return;
    }

    try {
      if (dirtyRegion) {
        this.context.save();
        this.context.beginPath();
        this.context.rect(
          dirtyRegion.x,
          dirtyRegion.y,
          dirtyRegion.width,
          dirtyRegion.height
        );
        this.context.clip();
      } else {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }

      this.renderBaseImage(dirtyRegion);
      this.renderRasterLayers(dirtyRegion);
      this.renderCropOverlay(dirtyRegion);
      this.renderSelectionHandles(dirtyRegion);
    } catch (error) {
      console.error('Error during rendering', error);
    } finally {
      if (dirtyRegion) {
        try {
          this.context.restore();
        } catch {
          // ignore restore errors
        }
      }
    }
  }

  /**
     * Рисует базовое изображение с учетом dirtyRegion.
     * @param {Object|null} dirtyRegion
     */
  renderBaseImage(dirtyRegion = null) {
    if (!this.image || !this.context || !this.canvas) return;

    if (dirtyRegion) {
      this.context.drawImage(
        this.image,
        dirtyRegion.x,
        dirtyRegion.y,
        dirtyRegion.width,
        dirtyRegion.height,
        dirtyRegion.x,
        dirtyRegion.y,
        dirtyRegion.width,
        dirtyRegion.height
      );
    } else {
      this.context.drawImage(
        this.image,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }
  }

  /**
     * Рендерит растер‑слои (blur, highlight, line, text).
     * @param {Object|null} dirtyRegion
     */
  renderRasterLayers(dirtyRegion = null) {
    if (!this.layerManager || !Array.isArray(this.layerManager.layers)) return;
    if (!this.context || !this.canvas) return;

    const rendererMap = {
      blur: blurRenderer,
      rectangle: rectangleRenderer,
      highlighter: highlighterRenderer,
      line: lineRenderer,
      text: textRenderer,
    };

    this.layerManager.layers.forEach(layer => {
      if (!layer || layer.type === 'crop' || layer.type === 'base') return;
      if (layer.visible === false) return;

      // Простейшая оптимизация по dirtyRegion — скипаем слой, если он точно вне области.
      if (dirtyRegion && layer.rect) {
        const intersects =
                    dirtyRegion.x < layer.rect.x + layer.rect.width &&
                    dirtyRegion.x + dirtyRegion.width > layer.rect.x &&
                    dirtyRegion.y < layer.rect.y + layer.rect.height &&
                    dirtyRegion.y + dirtyRegion.height > layer.rect.y;
        if (!intersects) {
          return;
        }
      }

      const renderer = rendererMap[layer.type];
      if (renderer) {
        this.context.save();
        renderer.render(this.context, layer, {
          image: this.image,
          lineWidth: this.CONSTANTS?.LINE_WIDTH,
        });
        this.context.restore();
      }
    });
  }

  /**
     * Рисует затемнение и рамку crop‑области.
     * @param {Object|null} dirtyRegion
     */
  renderCropOverlay(dirtyRegion = null) {
    if (!this.layerManager || !this.context || !this.canvas) return;
    const cropLayer = this.layerManager.layers?.find(l => l.type === 'crop');
    if (!cropLayer || !cropLayer.rect) return;

    const r = cropLayer.rect;

    // Если dirtyRegion не пересекается с cropRect и областями затемнения — можно скипнуть.
    if (dirtyRegion) {
      const intersects =
                dirtyRegion.x < this.canvas.width &&
                dirtyRegion.x + dirtyRegion.width > 0 &&
                dirtyRegion.y < this.canvas.height &&
                dirtyRegion.y + dirtyRegion.height > 0;
      if (!intersects) {
        return;
      }
    }

    this.context.save();
    this.context.fillStyle = 'rgba(0, 0, 0, 0.5)';

    // верх
    this.context.fillRect(0, 0, this.canvas.width, r.y);
    // низ
    this.context.fillRect(
      0,
      r.y + r.height,
      this.canvas.width,
      this.canvas.height - r.y - r.height
    );
    // слева
    this.context.fillRect(0, r.y, r.x, r.height);
    // справа
    this.context.fillRect(
      r.x + r.width,
      r.y,
      this.canvas.width - r.x - r.width,
      r.height
    );

    this.context.restore();

    // рамка и подпись размеров
    this.context.save();
    this.context.strokeStyle = '#ffffff';
    this.context.lineWidth = 2;
    this.context.strokeRect(r.x, r.y, r.width, r.height);

    this.context.fillStyle = '#ffffff';
    this.context.font = '14px Arial';
    const wText = Helper.formatSize(r.width);
    const hText = Helper.formatSize(r.height);
    this.context.fillText(
      `${wText} × ${hText}`,
      r.x - 10,
      r.y - 10
    );
    this.context.restore();
  }

  /**
     * Рисует хэндлы и точки выделения активного слоя.
     * @param {Object|null} dirtyRegion
     */
  renderSelectionHandles(dirtyRegion = null) {
    if (!this.layerManager || !this.context) return;
    const activeLayer = this.layerManager.activeLayer;
    if (!activeLayer) return;

    // Простая проверка: если есть dirtyRegion и есть rect — не рисуем вне dirtyRegion.
    if (dirtyRegion && activeLayer.rect) {
      const r = activeLayer.rect;
      const intersects =
                dirtyRegion.x < r.x + r.width &&
                dirtyRegion.x + dirtyRegion.width > r.x &&
                dirtyRegion.y < r.y + r.height &&
                dirtyRegion.y + dirtyRegion.height > r.y;
      if (!intersects) {
        return;
      }
    }

    if (activeLayer.rect) {
      this.drawHandles(this.context, activeLayer.rect);
    }

    if (activeLayer.type === 'line' && activeLayer.points) {
      this.drawLinePoints(this.context, activeLayer.points);
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
     * Вычисляет расстояние от точки до отрезка
     * @param {number} px - X координата точки
     * @param {number} py - Y координата точки
     * @param {number} x1 - X координата начала отрезка
     * @param {number} y1 - Y координата начала отрезка
     * @param {number} x2 - X координата конца отрезка
     * @param {number} y2 - Y координата конца отрезка
     * @returns {number} - Расстояние от точки до отрезка
     */
  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    return geometry.pointToSegmentDistance(px, py, x1, y1, x2, y2);
  }

  /**
     * Обработчик события нажатия мыши на оверлее
     * @param {MouseEvent} e - Событие мыши
     */
  onOverlayMouseDown(e) {
    // 1. Общая логика (хит-тест слоёв, создание/выбор, dragState)
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
                    
          // Проверка попадания в точки линии
          if (d1 < 12 || d2 < 12) { hit = l; break; }
                    
          // Проверка попадания в саму линию (расстояние от точки до отрезка)
          const distToSegment = this.pointToSegmentDistance(
            coords.x, coords.y,
            l.points.x1, l.points.y1,
            l.points.x2, l.points.y2
          );
          const hitTolerance = Math.max(10, (l.params?.thickness || 2) + 5);
          if (distToSegment < hitTolerance) { hit = l; break; }
        }
      }

      // 2. Двойной клик по текстовому слою → inline-редактирование через textarea
      if (e.detail === 2 && hit?.type === 'text') {
        e.preventDefault();
        this.activeLayer = hit;
        this.updateLayersPanel();
                
        // Переключаемся на инструмент Текст и запускаем редактирование
        this.switchToLayerTool('text');
                
        const textTool = this.tools.text;
        if (textTool) {
          textTool.currentLayer = hit;
          textTool.editText(hit);
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

      // 6. Попадание в слой → активация или move
      if (hit) {
        // Если слой уже активен ИЛИ это текстовый слой с активным инструментом Текст — начинаем перетаскивание
        const isAlreadyActive = this.activeLayer === hit;
        const isTextLayerWithTextTool = hit.type === 'text' && this.activeTool?.name === 'text';
                
        // Для текстового слоя с активным инструментом Текст — всегда начинаем перемещение (не редактирование)
        // Редактирование запускается двойным кликом
        if (isAlreadyActive || isTextLayerWithTextTool) {
          // Начинаем перетаскивание
          const isRect = !!hit.rect;
          this.dragState = {
            start: coords,
            layer: hit,
            handle: 'move',
            orig: isRect ? { ...hit.rect } : { ...hit.points }
          };
          this.selectionOverlay.className = 'move';
          this.selectionOverlay.style.cursor = 'move';

          if (this.historyManager) {
            this.historyManager.beginAtomicOperation('Resize layer');
          }
        } else {
          // Просто активируем слой
          this.activeLayer = hit;
          this.updateLayersPanel();
          this.render();

          // Переключаем инструмент на соответствующий типу слоя и обновляем параметры
          this.switchToLayerTool(hit.type);

          // Обновляем currentLayer у активного инструмента
          const activeTool = this.activeTool;
          if (activeTool) {
            // Устанавливаем currentLayer только если тип слоя совпадает с типом инструмента
            if (activeTool.name === hit.type) {
              activeTool.currentLayer = hit;
              // Обновляем настройки инструмента из параметров слоя
              if (activeTool.settings && hit.params) {
                Object.assign(activeTool.settings, hit.params);
                // Обновляем UI настроек с новыми значениями
                if (typeof activeTool.updateSettingsUI === 'function') {
                  activeTool.updateSettingsUI();
                }
              }
            } else {
              activeTool.currentLayer = null;
            }
            // Обновляем overlay активного инструмента
            activeTool.updateOverlay();
          }
        }
        return;
      }

      // 7. Создание нового слоя — только если активен инструмент и он поддерживает прямоугольники/линии
      if (this.activeTool?.supportsCreation) {
        const type = this.activeTool.name;
        let initialOptions = {};

        switch (type) {
          case 'crop':
            // Не даём создать второй crop-слой
            if (this.layerManager.layers.some(l => l.type === 'crop')) return;

            initialOptions = {
              type: 'crop',
              rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
              params: {}
            };
            break;

          case 'blur':
            initialOptions = {
              type: 'blur',
              rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
              params: { radius: this.tools.blur.settings?.radius ?? 5 }
            };
            break;

          case 'rectangle':
            initialOptions = {
              type: 'rectangle',
              rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
              params: {
                color: this.tools.rectangle?.settings?.color ?? '#ff0000',
                thickness: this.tools.rectangle?.settings?.thickness ?? 2
              }
            };
            break;

          case 'highlighter':
            initialOptions = {
              type: 'highlighter',
              rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
              params: {
                color: this.tools.highlighter?.settings?.color ?? '#FFA500',
                opacity: this.tools.highlighter?.settings?.opacity ?? 0.3
              }
            };
            break;

          case 'line':
            initialOptions = {
              type: 'line',
              points: {
                x1: coords.x, y1: coords.y,
                x2: coords.x, y2: coords.y
              },
              params: {
                color: this.tools.line.settings?.color ?? '#ff0000',
                thickness: this.tools.line.settings?.thickness ?? 2
              }
            };
            break;

          case 'text':
            initialOptions = {
              type: 'text',
              rect: {
                x: coords.x,
                y: coords.y,
                width: 200,
                height: (this.tools.text.settings?.fontSize ?? 16) * 1.5
              },
              params: {
                text: '',
                color: this.tools.text.settings?.color ?? '#000000',
                fontSize: this.tools.text.settings?.fontSize ?? 16
              }
            };
            break;

          default:
            return;
        }

        const newLayer = this.layerManager.createLayerObject(initialOptions.type, initialOptions);
        const created = this.addLayer(newLayer);

        // Синхронизируем currentLayer у инструментов после создания слоя
        if (this.activeTool) {
          if (type === 'crop' && this.activeTool.name === 'crop') {
            this.activeTool.currentLayer = created;
          } else if (type === 'text' && this.activeTool.name === 'text') {
            this.activeTool.currentLayer = created;
          } else if (type === 'blur' && this.activeTool.name === 'blur') {
            this.activeTool.currentLayer = created;
          } else if (type === 'rectangle' && this.activeTool.name === 'rectangle') {
            this.activeTool.currentLayer = created;
          } else if (type === 'line' && this.activeTool.name === 'line') {
            this.activeTool.currentLayer = created;
          }
        }

        // Для всех инструментов используем dragState
        this.dragState = {
          start: coords,
          layer: created,
          handle: type === 'line' ? 'x2' : 'create',
          orig: type === 'line'
            ? { ...created.points }
            : { ...created.rect }
        };

        if (this.historyManager) {
          this.historyManager.beginAtomicOperation('Resize layer');
        }

        return;
      }

    } catch (error) {
      console.error('Error in onOverlayMouseDown:', error);
    }

    // 2. Дать инструменту возможность дополнительно обработать
    try {
      if (this.activeTool && typeof this.activeTool.handleMouseDown === 'function') {
        this.activeTool.handleMouseDown(e);
      }
    } catch (error) {
      console.error('Error in tool.handleMouseDown', error);
    }
  }

  /**
     * Обработчик события движения мыши
     * @param {MouseEvent} e - Событие мыши
     */
  onMouseMove(e) {
    // Сохраняем данные для отложенной отрисовки через requestAnimationFrame
    // Только если есть активный dragState
    if (this.dragState) {
      this._pendingDragState = { e, dragState: { ...this.dragState } };

      // Отменяем предыдущий кадр, если он ещё не выполнен
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
      }

      // Запрашиваем следующий кадр анимации
      this._rafId = requestAnimationFrame(() => {
        this._processDragFrame();
      });
    }

    // Вызываем handleMouseMove у инструмента без троттлинга (для UI/превью)
    try {
      if (this.activeTool && typeof this.activeTool.handleMouseMove === 'function') {
        this.activeTool.handleMouseMove(e);
      }
    } catch (error) {
      console.error('Error in tool.handleMouseMove', error);
    }
  }

  /**
     * Обрабатывает один кадр перетаскивания/изменения размера
     * Вызывается внутри requestAnimationFrame
     */
  _processDragFrame() {
    this._rafId = null;
    const pending = this._pendingDragState;
    this._pendingDragState = null;

    if (!pending || !pending.dragState) return;

    const { e, dragState } = pending;

    try {
      if (!dragState || !dragState.layer || !dragState.start || !dragState.orig) {
        console.warn('Invalid dragState, skipping frame');
        return;
      }

      // Проверяем, что e и canvas существуют
      if (!e || !this.canvas) {
        console.error('Invalid event or canvas element');
        return;
      }

      const coords = this.getCanvasCoords(e);
      const { handle, layer, start, orig } = dragState;

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
            
      // Обновляем overlay активного инструмента для отображения превью
      if (this.activeTool && typeof this.activeTool.updateOverlay === 'function') {
        this.activeTool.updateOverlay();
      }
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
      // Сначала вызываем handleMouseUp у инструмента, пока dragState еще не сброшен
      try {
        if (this.activeTool && typeof this.activeTool.handleMouseUp === 'function') {
          this.activeTool.handleMouseUp(e);
        }
      } catch (error) {
        console.error('Error in tool.handleMouseUp', error);
      }

      // Затем сбрасываем dragState
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
            
      // Обновляем overlay активного инструмента
      if (this.activeTool && typeof this.activeTool.updateOverlay === 'function') {
        this.activeTool.updateOverlay();
      }
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
    wrapTextInRect(context, text, x, y, maxWidth, maxHeight, fontSize);
  }

  /**
     * Форматирует размер файла в удобочитаемый формат
     * @param {number} bytes - Размер файла в байтах
     * @returns {string} - Форматированный размер файла
     */
  formatFileSize(bytes) {
    return formatFileSize(bytes);
  }

  /**
     * Получает координаты холста для события мыши
     * @param {MouseEvent} event - Событие мыши
     * @returns {Object} - Объект с координатами x и y
     */
  getCanvasCoords(event) {
    try {
      const canvasR = this.canvas.getBoundingClientRect();
            
      // Защита от деления на ноль при нулевых размерах canvas
      if (!this.canvas.clientWidth || !this.canvas.clientHeight) {
        console.warn('getCanvasCoords: canvas has zero dimensions');
        return { x: 0, y: 0 };
      }
            
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
     * Валидирует данные для кропа
     * @returns {Object|null} Объект с cropLayer или null при ошибке
     */
  _validateCropData() {
    return validateCropData(this.layerManager, this.canvas, this.selectionOverlay, this.originalImage);
  }

  _calculateCropCoordinates(cropRect) {
    return calculateCropCoordinates(cropRect, this.canvas, this.originalImage);
  }

  _createCroppedCanvas(cropCoords) {
    return createCroppedCanvas(cropCoords, this.originalImage);
  }

  _applyLayersToCroppedCanvas(tempCtx, cropCoords) {
    applyLayersToCroppedCanvas(tempCtx, this.layerManager.layers, cropCoords, this.originalImage, wrapTextInRect, this.CONSTANTS?.LINE_WIDTH);
  }

  _applyRectLayerToCroppedCanvas(tempCtx, layer, cropCoords) {
    applyRectLayerToCroppedCanvas(tempCtx, layer, cropCoords, this.originalImage, wrapTextInRect, this.CONSTANTS?.LINE_WIDTH);
  }

  _applyLineLayerToCroppedCanvas(tempCtx, layer, cropCoords) {
    applyLineLayerToCroppedCanvas(tempCtx, layer, cropCoords);
  }

  _calculateVisibleArea(layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, cropCoords) {
    return geometry.calculateVisibleArea(layerOrigX, layerOrigY, layerOrigWidth, layerOrigHeight, cropCoords);
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
     * Пересчитывает координаты слоёв после кропа и удаляет crop-слой
     * @param {Object} cropCoords - Координаты кропа
     * @param {Object} cropLayer - Crop-слой для удаления
     */
  _updateLayersAfterCrop(cropCoords, cropLayer) {
    updateLayersAfterCrop(this.layerManager, cropCoords, cropLayer, this.context);
  }

  _updateRectLayerCoordinates(layer, cropRect, currentCanvasScaleX, currentCanvasScaleY) {
    updateRectLayerCoordinates(layer, cropRect, currentCanvasScaleX, currentCanvasScaleY, this.canvas, this.originalImage);
  }

  _updateLineLayerCoordinates(layer, cropRect, currentCanvasScaleX, currentCanvasScaleY) {
    updateLineLayerCoordinates(layer, cropRect, currentCanvasScaleX, currentCanvasScaleY, this.canvas, this.originalImage);
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

      window?.removeEventListener('resize', this.boundResize);

      document.getElementById('layersList')?.removeEventListener('click', this.boundLayersListClick);
      document.removeEventListener('keydown', this.boundKeyDown);

      document.removeEventListener('mousemove', this.boundMouseMove);
      document.removeEventListener('mouseup', this.boundMouseUp);

      // Удаляем обработчики с selectionOverlay
      this.selectionOverlay?.removeEventListener('mousedown', this.boundOverlayMouseDown);
      this.selectionOverlay?.removeEventListener('mousemove', this.boundOverlayHover);

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