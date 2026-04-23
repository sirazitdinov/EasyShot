// EventManager.js

export default class EventManager {
  constructor(editor) {
    this.editor = editor;
    this.dragState = null;
    this._rafId = null;
    this._pendingDragState = null;

    // Обработчики для событий окна, документа и оверлея
    this.boundMouseMove = (e) => this.onMouseMove(e);
    this.boundMouseUp = (e) => this.onMouseUp(e);
    this.boundOverlayMouseDown = (e) => this.onOverlayMouseDown(e);
    this.boundOverlayHover = (e) => this.onOverlayHover(e);
    this.boundKeyDown = (e) => this.onKeyDown(e);
    this.boundResize = () => this.editor.canvasManager?.updateCanvasDisplay();
    this.boundPaste = (e) => this.editor.handlePaste(e);
  }

  init() {
    const { selectionOverlay } = this.editor;

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    document.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('resize', this.boundResize);
    document.addEventListener('paste', this.boundPaste);

    if (selectionOverlay) {
      selectionOverlay.addEventListener('mousedown', this.boundOverlayMouseDown);
      selectionOverlay.addEventListener('mousemove', this.boundOverlayHover);
    }
  }

  destroy() {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('resize', this.boundResize);
    document.removeEventListener('paste', this.boundPaste);

    if (this.editor.selectionOverlay) {
      this.editor.selectionOverlay.removeEventListener('mousedown', this.boundOverlayMouseDown);
      this.editor.selectionOverlay.removeEventListener('mousemove', this.boundOverlayHover);
    }

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._pendingDragState = null;
    this.dragState = null;
  }

  onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.editor.resetSelection();
      return;
    }
    if (e.key === 'Delete' && this.editor.layerManager.activeLayer) {
      e.preventDefault();
      this.editor.deleteActiveLayer();
    }
  }

  /**
   * Получает координаты холста для события мыши
   * @param {MouseEvent} event - Событие мыши
   * @returns {Object} - Объект с координатами x и y
   */
  getCanvasCoords(event) {
    try {
      const canvas = this.editor.canvas;
      const canvasR = canvas.getBoundingClientRect();

      // Защита от деления на ноль при нулевых размерах canvas
      if (!canvas.clientWidth || !canvas.clientHeight) {
        console.warn('getCanvasCoords: canvas has zero dimensions');
        return { x: 0, y: 0 };
      }

      return {
        x: (event.clientX - canvasR.left) * (canvas.width / canvas.clientWidth),
        y: (event.clientY - canvasR.top) * (canvas.height / canvas.clientHeight)
      };
    } catch (error) {
      console.error('Error in getCanvasCoords:', error);
      return { x: 0, y: 0 };
    }
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

      // 1. Поиск попадания в слой (делегируем инструментам)
      for (const l of this.editor.layerManager.layers) {
        const tool = this.editor.tools[l.type];
        if (tool?.hitTest?.(coords, l)) {
          hit = l;
          break;
        }
      }

      // 2. Двойной клик по текстовому слою → inline-редактирование через textarea
      if (e.detail === 2 && hit?.type === 'text') {
        e.preventDefault();
        this.editor.activeLayer = hit;
        this.editor.updateLayersPanel();

        // Переключаемся на инструмент Текст и запускаем редактирование
        this.editor.switchToLayerTool('text');

        const textTool = this.editor.tools.text;
        if (textTool) {
          textTool.currentLayer = hit;
          textTool.editText(hit);
        }
        return;
      }

      // 3. Проверка попадания в ручки (только для прямоугольных слоёв)
      let handleHit = null;
      if (hit?.rect) {
        for (const h of this.editor.HANDLES) {
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
        this.editor.activeLayer = hit;
        this.dragState = {
          start: coords,
          layer: hit,
          handle: handleHit,
          orig: { ...hit.rect }
        };
        this.editor.selectionOverlay.className = `resize-${handleHit}`;
        this.editor.updateLayersPanel();

        if (this.editor.historyManager) {
          this.editor.historyManager.beginAtomicOperation('Resize layer');
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
          this.editor.activeLayer = hit;
          this.dragState = {
            start: coords,
            layer: hit,
            handle: ptHandle,
            orig: { ...hit.points }
          };
          this.editor.selectionOverlay.style.cursor = 'move';
          this.editor.updateLayersPanel();

          if (this.editor.historyManager) {
            this.editor.historyManager.beginAtomicOperation('Resize layer');
          }
          return;
        }
      }

      // 6. Попадание в слой → активация или move
      if (hit) {
        // Если слой уже активен ИЛИ это текстовый слой с активным инструментом Текст — начинаем перетаскивание
        const isAlreadyActive = this.editor.activeLayer === hit;
        const isTextLayerWithTextTool = hit.type === 'text' && this.editor.activeTool?.name === 'text';

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
          this.editor.selectionOverlay.className = 'move';
          this.editor.selectionOverlay.style.cursor = 'move';

          if (this.editor.historyManager) {
            this.editor.historyManager.beginAtomicOperation('Resize layer');
          }
        } else {
          // Просто активируем слой
          this.editor.activeLayer = hit;
          this.editor.updateLayersPanel();
          this.editor.render();

          // Переключаем инструмент на соответствующий типу слоя и обновляем параметры
          this.editor.switchToLayerTool(hit.type);

          // Обновляем currentLayer у активного инструмента
          const activeTool = this.editor.activeTool;
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
      if (this.editor.activeTool?.supportsCreation) {
        const type = this.editor.activeTool.name;
        let initialOptions = {};

        switch (type) {
          case 'crop':
            // Не даём создать второй crop-слой
            if (this.editor.layerManager.layers.some(l => l.type === 'crop')) return;

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
              params: { radius: this.editor.tools.blur.settings?.radius ?? 5 }
            };
            break;

          case 'rectangle':
            initialOptions = {
              type: 'rectangle',
              rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
              params: {
                color: this.editor.tools.rectangle?.settings?.color ?? '#ff0000',
                thickness: this.editor.tools.rectangle?.settings?.thickness ?? 2
              }
            };
            break;

          case 'highlighter':
            initialOptions = {
              type: 'highlighter',
              rect: { x: coords.x, y: coords.y, width: 0, height: 0 },
              params: {
                color: this.editor.tools.highlighter?.settings?.color ?? '#FFA500',
                opacity: this.editor.tools.highlighter?.settings?.opacity ?? 0.3
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
                color: this.editor.tools.line.settings?.color ?? '#ff0000',
                thickness: this.editor.tools.line.settings?.thickness ?? 2
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
                height: (this.editor.tools.text.settings?.fontSize ?? 16) * 1.5
              },
              params: {
                text: '',
                color: this.editor.tools.text.settings?.color ?? '#000000',
                fontSize: this.editor.tools.text.settings?.fontSize ?? 16
              }
            };
            break;

          default:
            return;
        }

        const newLayer = this.editor.layerManager.createLayerObject(initialOptions.type, initialOptions);
        const created = this.editor.addLayer(newLayer);

        // Синхронизируем currentLayer у инструментов после создания слоя
        if (this.editor.activeTool) {
          if (type === 'crop' && this.editor.activeTool.name === 'crop') {
            this.editor.activeTool.currentLayer = created;
          } else if (type === 'text' && this.editor.activeTool.name === 'text') {
            this.editor.activeTool.currentLayer = created;
          } else if (type === 'blur' && this.editor.activeTool.name === 'blur') {
            this.editor.activeTool.currentLayer = created;
          } else if (type === 'rectangle' && this.editor.activeTool.name === 'rectangle') {
            this.editor.activeTool.currentLayer = created;
          } else if (type === 'line' && this.editor.activeTool.name === 'line') {
            this.editor.activeTool.currentLayer = created;
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

        if (this.editor.historyManager) {
          this.editor.historyManager.beginAtomicOperation('Resize layer');
        }

        return;
      }

    } catch (error) {
      console.error('Error in onOverlayMouseDown:', error);
    }

    // 2. Дать инструменту возможность дополнительно обработать
    try {
      if (this.editor.activeTool && typeof this.editor.activeTool.handleMouseDown === 'function') {
        this.editor.activeTool.handleMouseDown(e);
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
      if (this.editor.activeTool && typeof this.editor.activeTool.handleMouseMove === 'function') {
        this.editor.activeTool.handleMouseMove(e);
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
      if (!e || !this.editor.canvas) {
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
        layer.rect.width = Math.max(10, Math.min(this.editor.canvas.width - layer.rect.x, w));
        layer.rect.height = Math.max(10, Math.min(this.editor.canvas.height - layer.rect.y, h));
      }
      else if (handle === 'move') {
        const dx = coords.x - start.x;
        const dy = coords.y - start.y;
        if (layer.rect) {
          if (!orig || typeof orig.width === 'undefined' || typeof orig.height === 'undefined') {
            console.error('Invalid orig dimensions for rectangle movement');
            return;
          }
          layer.rect.x = Math.max(0, Math.min(this.editor.canvas.width - orig.width, orig.x + dx));
          layer.rect.y = Math.max(0, Math.min(this.editor.canvas.height - orig.height, orig.y + dy));
        } else if (layer.points) {
          if (!orig || typeof orig.x1 === 'undefined' || typeof orig.y1 === 'undefined' ||
            typeof orig.x2 === 'undefined' || typeof orig.y2 === 'undefined') {
            console.error('Invalid orig coordinates for point movement');
            return;
          }
          layer.points.x1 = Math.max(0, Math.min(this.editor.canvas.width, orig.x1 + dx));
          layer.points.y1 = Math.max(0, Math.min(this.editor.canvas.height, orig.y1 + dy));
          layer.points.x2 = Math.max(0, Math.min(this.editor.canvas.width, orig.x2 + dx));
          layer.points.y2 = Math.max(0, Math.min(this.editor.canvas.height, orig.y2 + dy));
        }
      }
      else if (layer.rect) {
        this.updateRectFromHandle(handle, layer, start, coords.x, coords.y);
      }
      else if (layer.points && (handle === 'x1' || handle === 'x2')) {
        layer.points[handle === 'x1' ? 'x1' : 'x2'] = Math.max(0, Math.min(this.editor.canvas.width, coords.x));
        layer.points[handle === 'x1' ? 'y1' : 'y2'] = Math.max(0, Math.min(this.editor.canvas.height, coords.y));
      }

      this.editor.render();

      // Обновляем overlay активного инструмента для отображения превью
      if (this.editor.activeTool && typeof this.editor.activeTool.updateOverlay === 'function') {
        this.editor.activeTool.updateOverlay();
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
        if (this.editor.activeTool && typeof this.editor.activeTool.handleMouseUp === 'function') {
          this.editor.activeTool.handleMouseUp(e);
        }
      } catch (error) {
        console.error('Error in tool.handleMouseUp', error);
      }

      // Затем сбрасываем dragState
      if (this.dragState) {
        if (this.editor.historyManager) {
          this.editor.historyManager.endAtomicOperation();
        }
        this.dragState = null;
      }

      this.editor.selectionOverlay.className = '';
      this.editor.selectionOverlay.style.cursor = 'default';

      this.editor.render();
      this.editor.updateLayersPanel();

      // Обновляем overlay активного инструмента
      if (this.editor.activeTool && typeof this.editor.activeTool.updateOverlay === 'function') {
        this.editor.activeTool.updateOverlay();
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
      if (!e || !this.editor.canvas || !this.editor.layerManager || !this.editor.layerManager.layers) {
        console.error('Invalid event or canvas element or layer manager');
        return;
      }

      const coords = this.getCanvasCoords(e);
      let cls = '';

      // Проверяем, что HANDLES и selectionOverlay существуют
      if (!this.editor.HANDLES || !this.editor.selectionOverlay) {
        console.error('HANDLES or selectionOverlay not initialized');
        return;
      }

      this.editor.layerManager.layers.forEach((l) => {
        if (!l.rect) return;

        // Проверяем, что l.rect имеет правильные свойства
        if (typeof l.rect.x === 'undefined' || typeof l.rect.y === 'undefined' ||
          typeof l.rect.width === 'undefined' || typeof l.rect.height === 'undefined') {
          console.warn('Invalid rect properties for layer', l);
          return;
        }

        this.editor.HANDLES.forEach((h) => {
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

      this.editor.selectionOverlay.className = cls;
      this.editor.selectionOverlay.style.cursor = cls ? 'pointer' : 'default';
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
        nw = Math.max(MIN, Math.min(this.editor.canvas.width - orig.x, nw));
      }

      if (handle.includes('n')) {
        const maxY = orig.y + orig.height;
        ny = Math.min(maxY - MIN, ny);
        ny = Math.max(0, ny);
        nh = maxY - ny;
      } else if (handle.includes('s')) {
        nh = Math.max(MIN, Math.min(this.editor.canvas.height - orig.y, nh));
      }

      layer.rect.x = nx;
      layer.rect.y = ny;
      layer.rect.width = nw;
      layer.rect.height = nh;
    } catch (error) {
      console.error('Error in updateRectFromHandle:', error);
    }
  }
}
