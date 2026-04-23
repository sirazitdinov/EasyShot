// LayerManager.js

/**
 * Менеджер слоёв для ImageEditor.
 * Отвечает за:
 * - хранение и управление списком слоёв
 * - активный слой
 * - drag-and-drop слоёв
 * - сохранение/восстановление состояния слоёв из/в холст
 * - перерисовку слоёв (через вызов render)
 * - взаимодействие с историей (по запросу EditorCore)
 */

/**
 * @typedef {Object} EditorLayer
 * @property {string} id
 * @property {string} type - 'base' | 'crop' | 'blur' | 'rectangle' | 'highlighter' | 'line' | 'text'
 * @property {boolean} visible
 * @property {{x:number,y:number,width:number,height:number}|null} rect
 * @property {{x1:number,y1:number,x2:number,y2:number}|null} points
 * @property {Object} params
 */
export default class LayerManager {
  constructor(editor) {
    this.editor = editor;
    this.layers = [];
    this.activeLayerIndex = -1;
    this.dragState = null; // для drag-and-drop
    this.HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    // Ссылки на DOM, если нужно (можно также передавать через editor.ui или отдельный UI-менеджер)
    this.layersListElement = document.getElementById('layersList');
  }

  init() {
    this.createBaseLayer();
    this.updateLayersPanel();
  }

  createBaseLayer() {
    const baseLayer = {
      id: 'layer-' + Date.now(),
      type: 'base',
      visible: true,
      imageData: this.editor.context.getImageData(
        0, 0, this.editor.canvas.width, this.editor.canvas.height
      )
    };
    this.layers = [baseLayer];
    this.activeLayerIndex = 0;
  }

  /**
     * @param {string} type
     * @param {Partial<EditorLayer>} options
     * @returns {EditorLayer}
     */
  createLayerObject(type, options = {}) {
    const id = options.id || 'layer-' + Date.now();

    const layer = {
      id,
      type,
      visible: options.visible !== undefined ? options.visible : true,
      rect: options.rect || null,
      points: options.points || null,
      params: options.params || {}
    };

    // Значения по умолчанию по типам
    switch (type) {
      case 'crop':
        if (!layer.rect) {
          layer.rect = { x: 0, y: 0, width: 0, height: 0 };
        }
        break;
      case 'blur':
        if (!layer.rect) {
          layer.rect = { x: 0, y: 0, width: 0, height: 0 };
        }
        layer.params.radius = layer.params.radius ?? 5;
        break;
      case 'rectangle':
        if (!layer.rect) {
          layer.rect = { x: 0, y: 0, width: 0, height: 0 };
        }
        layer.params.color = layer.params.color ?? '#ff0000';
        layer.params.thickness = layer.params.thickness ?? 2;
        break;
      case 'line':
        if (!layer.points) {
          layer.points = { x1: 0, y1: 0, x2: 0, y2: 0 };
        }
        layer.params.color = layer.params.color ?? '#ff0000';
        layer.params.thickness = layer.params.thickness ?? 2;
        break;
      case 'text':
        if (!layer.rect) {
          layer.rect = { x: 0, y: 0, width: 200, height: 50 };
        }
        layer.params.text = layer.params.text ?? '';
        layer.params.color = layer.params.color ?? '#000000';
        layer.params.fontSize = layer.params.fontSize ?? 16;
        break;
      default:
        // base/изображение и прочее — оставляем как есть
        break;
    }

    return layer;
  }

  /** @returns {EditorLayer|null} */
  get activeLayer() {
    return this.layers[this.activeLayerIndex] ?? null;
  }

  set activeLayer(layer) {
    if (!layer) {
      this.activeLayerIndex = -1;
      return;
    }
    const idx = this.layers.indexOf(layer);
    if (idx !== -1) {
      this.activeLayerIndex = idx;
    }
  }

  getLayerById(id) {
    return this.layers.find(l => l.id === id) || null;
  }

  /** @param {EditorLayer} layer */
  addLayer(layer) {
    // Позволяем передавать либо уже готовый layer, либо лишь { type, rect, params }
    const normalizedLayer = this.createLayerObject(layer.type, layer);

    this.layers.push(normalizedLayer);
    this.activeLayerIndex = this.layers.length - 1;
    this.updateLayersPanel();
    this.editor.render();

    return normalizedLayer;
  }

  removeLayer(layer) {

  }

  deleteActiveLayer() {
    if (!this.activeLayer) return false;
    const removed = this.layers.splice(this.activeLayerIndex, 1)[0];
    // После удаления: либо предыдущий слой, либо базовый
    // Если удалили последний слой или индекс вышел за границы
    if (this.activeLayerIndex >= this.layers.length) {
      this.activeLayerIndex = this.layers.length - 1;
    }
    // Если слоёв не осталось совсем (кроме base), сбрасываем в -1
    if (this.activeLayerIndex < 0) {
      this.activeLayerIndex = -1;
    }
    this.updateLayersPanel();
    this.editor.render();
    return removed;
  }

  setActiveLayerById(id) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx === -1) return false;
    this.activeLayerIndex = idx;
    this.updateLayersPanel();
    this.editor.render();

    const activeLayer = this.activeLayer;
    if (activeLayer) {
      // Переключаем инструмент на соответствующий типу слоя
      this.editor.switchToLayerTool(activeLayer.type);

      // Обновляем currentLayer у активного инструмента
      const activeTool = this.editor.activeTool;
      if (activeTool) {
        // Устанавливаем currentLayer только если тип слоя совпадает с типом инструмента
        if (activeTool.name === activeLayer.type) {
          activeTool.currentLayer = activeLayer;
          // Обновляем настройки инструмента из параметров слоя
          if (activeTool.settings && activeLayer.params) {
            Object.assign(activeTool.settings, activeLayer.params);
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

    return true;
  }

  moveLayer(draggedLayerId, targetLayerId, insertAbove) {
    const draggedIndex = this.layers.findIndex(l => l.id === draggedLayerId);
    const targetIndex = this.layers.findIndex(l => l.id === targetLayerId);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

    // Извлекаем слой
    const [movedLayer] = this.layers.splice(draggedIndex, 1);

    // Вычисляем новое положение
    let newPosition = targetIndex;
    if (insertAbove) {
      if (draggedIndex > targetIndex) newPosition--;
    } else {
      if (draggedIndex < targetIndex) newPosition++;
    }

    // Вставляем
    this.layers.splice(newPosition, 0, movedLayer);

    // Обновляем индекс активного слоя
    if (this.activeLayerIndex === draggedIndex) {
      this.activeLayerIndex = newPosition;
    } else if (this.activeLayerIndex > draggedIndex && this.activeLayerIndex <= newPosition) {
      this.activeLayerIndex--;
    } else if (this.activeLayerIndex < draggedIndex && this.activeLayerIndex >= newPosition) {
      this.activeLayerIndex++;
    }

    this.updateLayersPanel();
    this.editor.render();
  }

  /**
     * Перерисовка всех видимых слоёв на холсте.
     * Обычно вызывается из EditorCore.render()
     */
  redrawAllLayers() {
    const ctx = this.editor.context;

    // Отрисовка всех видимых слоёв
    for (const layer of this.layers) {

      if (layer.imageData) {
        // Растровый слой
        ctx.putImageData(layer.imageData, 0, 0);
      }
    }
  }

  /**
     * Синхронизирует данные активного слоя с холстом (копирует текущий холст → imageData)
     */
  captureActiveLayerFromCanvas() {
    if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) return;
    const layer = this.layers[this.activeLayerIndex];
    layer.imageData = this.editor.context.getImageData(0, 0, this.editor.canvas.width, this.editor.canvas.height);
  }

  /**
     * Восстанавливает холст из активного слоя (imageData → холст)
     * Возвращает true, если восстановление прошло успешно.
     */
  restoreActiveLayerToCanvas() {
    const layer = this.activeLayer;
    if (!layer?.imageData) return false;
    this.editor.context.putImageData(layer.imageData, 0, 0);
    return true;
  }

  // ========= UI-обновления =========

  /**
     * Возвращает путь к иконке и отображаемое имя для типа слоя.
     * Использует те же SVG-иконки, что и кнопки инструментов.
     * @param {string} type
     * @returns {{iconPath: string, name: string}}
     */
  getLayerTypeDisplay(type) {
    const layerTypeMap = {
      base: { iconPath: 'icons/Image.svg', name: 'Изображение' },
      crop: { iconPath: 'icons/crop.svg', name: 'Кадрирование' },
      blur: { iconPath: 'icons/droplet.svg', name: 'Размытие' },
      rectangle: { iconPath: 'icons/rectangle.svg', name: 'Прямоугольник' },
      highlighter: { iconPath: 'icons/highlight.svg', name: 'Маркер' },
      line: { iconPath: 'icons/ArrowUpRight.svg', name: 'Стрелка' },
      text: { iconPath: 'icons/TextCreation.svg', name: 'Текст' }
    };
    return layerTypeMap[type] || { iconPath: 'icons/Image.svg', name: type };
  }

  updateLayersPanel() {
    if (!this.layersListElement) return;

    this.layersListElement.innerHTML = '';

    // Отображаем в обратном порядке: верхний слой — вверху списка
    [...this.layers].reverse().forEach((layer, uiIndex) => {
      const logicalIndex = this.layers.length - 1 - uiIndex;
      const isActive = logicalIndex === this.activeLayerIndex;
      const display = this.getLayerTypeDisplay(layer.type);

      const layerItem = document.createElement('div');
      layerItem.className = `layer-item ${isActive ? 'active' : ''}`;
      layerItem.dataset.layerId = layer.id;
      layerItem.draggable = true;

      layerItem.innerHTML = `
                <span class="layer-drag-handle">⋮</span>
                <img src="${display.iconPath}" alt="${display.name}" class="layer-icon-svg">
                <span class="layer-name">${display.name}</span>
            `;
      this.layersListElement.appendChild(layerItem);
    });
  }

  setupDragAndDrop() {
    const el = this.layersListElement;
    if (!el) {
      console.warn('layersListElement not found, skipping setupDragAndDrop');
      return;
    }

    const prevent = (e) => e.preventDefault();
    let currentDragOverItem = null;

    el.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.layer-item');
      if (!item) return;
      e.dataTransfer.setData('text/plain', item.dataset.layerId);
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // Устанавливаем прозрачный drag image, чтобы не было "призрака"
      const dragImage = document.createElement('div');
      dragImage.style.opacity = '0';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    });

    el.addEventListener('dragend', (e) => {
      const item = e.target.closest('.layer-item');
      if (item) item.classList.remove('dragging');
      el.querySelectorAll('.insert-above, .insert-below').forEach(el => {
        el.classList.remove('insert-above', 'insert-below');
      });
      currentDragOverItem = null;
    });

    el.addEventListener('dragover', (e) => {
      prevent(e);
      const target = e.target.closest('.layer-item');

      // Если цель не изменилась, не обновляем классы (убираем подёргивания)
      if (target === currentDragOverItem) {
        return;
      }

      // Очищаем предыдущие классы
      if (currentDragOverItem) {
        currentDragOverItem.classList.remove('insert-above', 'insert-below');
      }

      if (!target) {
        currentDragOverItem = null;
        return;
      }

      const rect = target.getBoundingClientRect();
      const isAbove = e.clientY < rect.top + rect.height / 2;
            
      // Слои отображаются в обратном порядке (верхний внизу списка),
      // поэтому инвертируем логику: isAbove = true → insert-below (визуально сверху)
      target.classList.add(isAbove ? 'insert-below' : 'insert-above');
      currentDragOverItem = target;
    });

    el.addEventListener('drop', (e) => {
      prevent(e);
      const target = e.target.closest('.layer-item');
      if (!target) return;

      const draggedId = e.dataTransfer.getData('text/plain');
      // Инвертируем: insert-below визуально = insertAbove логически
      const insertAbove = target.classList.contains('insert-below');
      this.moveLayer(draggedId, target.dataset.layerId, insertAbove);

      // Очищаем классы
      if (currentDragOverItem) {
        currentDragOverItem.classList.remove('insert-above', 'insert-below');
        currentDragOverItem = null;
      }
    });

    // Используем mousedown вместо click для более надежного срабатывания
    el.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.layer-item');
      if (item && !e.target.closest('.layer-drag-handle')) {
        this.setActiveLayerById(item.dataset.layerId);
      }
    }, true); // Используем capture phase
  }

  destroy() {
    try {
      // Очищаем drag-and-drop состояние
      this.dragState = null;

      // Очищаем список слоёв
      this.layers = [];
      this.activeLayerIndex = -1;

      // Очищаем ссылку на DOM-элемент
      this.layersListElement = null;

      // Очищаем ссылку на редактор
      this.editor = null;

      console.log('LayerManager destroyed successfully');
    } catch (error) {
      console.error('Error during LayerManager destruction:', error);
    }
  }
}