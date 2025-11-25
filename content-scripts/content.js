// Глобальная переменная для хранения экземпляра линейки
let pixelRuler = null;

// Основной класс пиксельной линейки
class PixelRuler {
    constructor() {
        this.isActive = false;
        this.startPoint = null;
        this.endPoint = null;
        this.rulerElement = null;
        this.overlay = null;
        this.hideTimeout = null;
        this.isDragging = false;
        this.isResizing = false;
        this.isSpacePressed = false;
        this.dragStartPoint = null;
        this.originalStartPoint = null;
        this.originalEndPoint = null;
        this.resizeHandle = null;
        this.resizeHandles = {};
        this.init();
    }

    init() {
        this.createRulerElements();
        this.bindEvents();
        console.log('Pixel Ruler initialized');
    }

    createRulerElements() {
        // Создаем оверлей
        this.overlay = document.createElement('div');
        this.overlay.id = 'pixel-ruler-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: transparent;
            cursor: crosshair;
            z-index: 2147483647;
            display: none;
        `;

        // Создаем элемент линейки
        this.rulerElement = document.createElement('div');
        this.rulerElement.id = 'pixel-ruler-element';
        this.rulerElement.style.cssText = `
            position: absolute;
            background: rgba(255, 0, 0, 0.3);
            border: 1px dashed #ff0000;
            pointer-events: none;
            display: none;
            z-index: 2147483646;
        `;

        // Создаем элементы для изменения размера (ручки)
        this.createResizeHandles();

        // Добавляем элементы в DOM
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.rulerElement);
    }

    bindEvents() {
        this.overlay.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.overlay.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.overlay.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Добавляем обработчик на оверлей И на document
        this.overlay.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // Делаем оверлей фокусируемым для событий клавиатуры
        this.overlay.setAttribute('tabindex', '-1');
    }

    handleMouseDown(e) {
        if (e.button !== 0) return; // Только левая кнопка мыши

        e.preventDefault();
        e.stopPropagation();

        // Очищаем предыдущий таймаут, если есть
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        this.startPoint = { x: e.clientX, y: e.clientY };
        this.endPoint = { x: e.clientX, y: e.clientY };
        this.isDragging = true;

        // Сохраняем оригинальные точки для перемещения
        this.originalStartPoint = {...this.startPoint};
        this.originalEndPoint = {...this.endPoint};

        this.updateRulerDisplay();
        this.rulerElement.style.display = 'block';
    }

    handleMouseMove(e) {
        if (!this.startPoint) return;

        e.preventDefault();
        e.stopPropagation();

        // Если зажат пробел - перемещаем начальную точку
        if (this.isSpacePressed && this.isDragging) {
            const deltaX = e.clientX - this.endPoint.x;
            const deltaY = e.clientY - this.endPoint.y;

            // Перемещаем обе точки (начальную и конечную)
            this.startPoint.x = this.originalStartPoint.x + deltaX;
            this.startPoint.y = this.originalStartPoint.y + deltaY;
            this.endPoint.x = this.originalEndPoint.x + deltaX;
            this.endPoint.y = this.originalEndPoint.y + deltaY;

            this.overlay.style.cursor = 'move';
        } else if (this.isDragging) {
            // Обычное изменение размера
            this.endPoint = { x: e.clientX, y: e.clientY };
            this.overlay.style.cursor = 'crosshair';
        }

        this.updateRulerDisplay();
    }

    handleMouseUp(e) {
        if (!this.startPoint) return;

        e.preventDefault();
        e.stopPropagation();

        this.isDragging = false;
        this.overlay.style.cursor = 'crosshair';

        // Автоматическое скрытие через 30 секунды только после отпускания кнопки
        this.hideTimeout = setTimeout(() => {
            this.deactivate();
        }, 30000);
    }

    handleKeyDown(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            // Очищаем таймаут при закрытии
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
            this.deactivate();

            // Предотвращаем всплытие события
            e.preventDefault();
            e.stopPropagation();
        }

        // Обработка пробела для перемещения начальной точки
        if (e.key === ' ' || e.keyCode === 32) {
            if (this.startPoint && !this.isSpacePressed) {
                this.isSpacePressed = true;
                this.originalStartPoint = {...this.startPoint};
                this.originalEndPoint = {...this.endPoint};
                this.overlay.style.cursor = 'move';
                e.preventDefault(); // Предотвращаем прокрутку страницы
            }
        }
    }


    handleKeyUp(e) {
        // Отпускание пробела
        if (e.key === ' ' || e.keyCode === 32) {
            if (this.isSpacePressed) {
                this.isSpacePressed = false;
                if(this.isDragging){
                    this.overlay.style.cursor = 'crosshair';
                }
                e.preventDefault();
            }
        }
    }



    createResizeHandles() {
        const handleSize = 8;
        const handleStyle = `
            position: absolute;
            width: ${handleSize}px;
            height: ${handleSize}px;
            background: #ff0000;
            border: 1px solid #ffffff;
            border-radius: 1px;
            pointer-events: auto;
            cursor: pointer;
            z-index: 2147483647;
            display: none;
        `;

        // Создаем 8 ручек для изменения размера (по углам и сторонам)
        const handlePositions = [
            { id: 'nw', cursor: 'nw-resize', left: 0, top: 0 },
            { id: 'n', cursor: 'n-resize', left: '50%', top: 0 },
            { id: 'ne', cursor: 'ne-resize', left: '100%', top: 0 },
            { id: 'e', cursor: 'e-resize', left: '100%', top: '50%' },
            { id: 'se', cursor: 'se-resize', left: '100%', top: '100%' },
            { id: 's', cursor: 's-resize', left: '50%', top: '100%' },
            { id: 'sw', cursor: 'sw-resize', left: 0, top: '100%' },
            { id: 'w', cursor: 'w-resize', left: 0, top: '50%' }
        ];

        this.resizeHandles = {};

        handlePositions.forEach(pos => {
            const handle = document.createElement('div');
            handle.id = `pixel-ruler-handle-${pos.id}`;
            handle.style.cssText = handleStyle;
            handle.style.cursor = pos.cursor;
            handle.style.transform = 'translate(-50%, -50%)'; // Центрируем ручки

            // Для процентного позиционирования
            handle.style.left = pos.left;
            handle.style.top = pos.top;

            handle.addEventListener('mousedown', (e) => this.handleResizeStart(e, pos.id));

            document.body.appendChild(handle);
            this.resizeHandles[pos.id] = handle;
        });
    }

    handleResizeStart(e, handleId) {
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.resizeHandle = handleId;
        this.resizeStartPoint = { x: e.clientX, y: e.clientY };
        this.resizeOriginalStart = {...this.startPoint};
        this.resizeOriginalEnd = {...this.endPoint};

        document.addEventListener('mousemove', this.handleResizeMove.bind(this));
        document.addEventListener('mouseup', this.handleResizeEnd.bind(this));
    }

    handleResizeMove(e) {
        if (!this.isResizing) return;

        const deltaX = e.clientX - this.resizeStartPoint.x;
        const deltaY = e.clientY - this.resizeStartPoint.y;

        // В зависимости от активной ручки изменяем соответствующие границы
        switch (this.resizeHandle) {
            case 'nw':
                this.startPoint.x = this.resizeOriginalStart.x + deltaX;
                this.startPoint.y = this.resizeOriginalStart.y + deltaY;
                break;
            case 'n':
                this.startPoint.y = this.resizeOriginalStart.y + deltaY;
                break;
            case 'ne':
                this.endPoint.x = this.resizeOriginalEnd.x + deltaX;
                this.startPoint.y = this.resizeOriginalStart.y + deltaY;
                break;
            case 'e':
                this.endPoint.x = this.resizeOriginalEnd.x + deltaX;
                break;
            case 'se':
                this.endPoint.x = this.resizeOriginalEnd.x + deltaX;
                this.endPoint.y = this.resizeOriginalEnd.y + deltaY;
                break;
            case 's':
                this.endPoint.y = this.resizeOriginalEnd.y + deltaY;
                break;
            case 'sw':
                this.startPoint.x = this.resizeOriginalStart.x + deltaX;
                this.endPoint.y = this.resizeOriginalEnd.y + deltaY;
                break;
            case 'w':
                this.startPoint.x = this.resizeOriginalStart.x + deltaX;
                break;
        }

        this.updateRulerDisplay();
    }

    handleResizeEnd() {
        this.isResizing = false;
        this.resizeHandle = null;

        document.removeEventListener('mousemove', this.handleResizeMove.bind(this));
        document.removeEventListener('mouseup', this.handleResizeEnd.bind(this));
    }

    updateRulerDisplay() {
        if (!this.startPoint || !this.endPoint) return;

        const width = Math.abs(this.endPoint.x - this.startPoint.x);
        const height = Math.abs(this.endPoint.y - this.startPoint.y);

        // Позиционируем линейку
        const left = Math.min(this.startPoint.x, this.endPoint.x);
        const top = Math.min(this.startPoint.y, this.endPoint.y);

        this.rulerElement.style.left = `${left}px`;
        this.rulerElement.style.top = `${top}px`;
        this.rulerElement.style.width = `${width}px`;
        this.rulerElement.style.height = `${height}px`;

        this.updateResizeHandles(left, top, width, height);

        // Определяем направление выделения
        const isRightDirection = this.endPoint.x >= this.startPoint.x;
        const isDownDirection = this.endPoint.y >= this.startPoint.y;

        // Позиционируем от внешней стороны с учетом направления
        this.updateSizeDisplays(this.startPoint.x, this.startPoint.y, left, top, width, height, isRightDirection, isDownDirection);
    }

    updateResizeHandles(left, top, width, height) {
        if (width > 20 && height > 20 && !this.isDragging) {
            // Показываем и позиционируем все ручки
            Object.keys(this.resizeHandles).forEach(handleId => {
                const handle = this.resizeHandles[handleId];
                handle.style.display = 'block';

                // Обновляем абсолютные позиции ручек
                handle.style.left = `${left + this.getHandleX(handleId, width)}px`;
                handle.style.top = `${top + this.getHandleY(handleId, height)}px`;
            });
        } else {
            // Скрываем все ручки
            Object.values(this.resizeHandles).forEach(handle => {
                handle.style.display = 'none';
            });
        }
    }

    getHandleX(handleId, width) {
        switch (handleId) {
            case 'nw': case 'w': case 'sw': return 0;
            case 'n': case 's': return width / 2;
            case 'ne': case 'e': case 'se': return width;
            default: return 0;
        }
    }

    getHandleY(handleId, height) {
        switch (handleId) {
            case 'nw': case 'n': case 'ne': return 0;
            case 'w': case 'e': return height / 2;
            case 'sw': case 's': case 'se': return height;
            default: return 0;
        }
    }

    updateSizeDisplays(startX, startY, rectLeft, rectTop, width, height, isRightDirection, isDownDirection) {
        // Удаляем старые элементы отображения, если они есть
        const oldWidthDisplay = document.getElementById('pixel-ruler-width-display');
        const oldHeightDisplay = document.getElementById('pixel-ruler-height-display');

        if (oldWidthDisplay) oldWidthDisplay.remove();
        if (oldHeightDisplay) oldHeightDisplay.remove();

        // Создаем элемент для отображения ширины
        const widthDisplay = document.createElement('div');
        widthDisplay.id = 'pixel-ruler-width-display';
        widthDisplay.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Arial', sans-serif;
        font-size: 11px;
        font-weight: bold;
        pointer-events: none;
        z-index: 2147483647;
        white-space: nowrap;
    `;

        // Создаем элемент для отображения высоты (вертикальный)
        const heightDisplay = document.createElement('div');
        heightDisplay.id = 'pixel-ruler-height-display';
        heightDisplay.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 2px;
        border-radius: 3px;
        font-family: 'Arial', sans-serif;
        font-size: 11px;
        font-weight: bold;
        pointer-events: none;
        z-index: 2147483647;
        writing-mode: vertical-lr;
        text-orientation: mixed;
        transform: rotate(180deg);
    `;

        // Добавляем элементы для расчета их размеров
        widthDisplay.textContent = `←→ ${width}px`;
        heightDisplay.textContent = `←→ ${height}px`;
        document.body.appendChild(widthDisplay);
        document.body.appendChild(heightDisplay);

        const OFFSET = 5; // Отступ от границы
        const widthDisplayWidth = widthDisplay.offsetWidth;
        const widthDisplayHeight = widthDisplay.offsetHeight;
        const heightDisplayWidth = heightDisplay.offsetWidth;
        const heightDisplayHeight = heightDisplay.offsetHeight;

        // Позиционирование ширины - всегда вдоль верхней или нижней границы
        if (width > 10) {
            let widthX, widthY;

            if (isRightDirection) {
                // Выделение справа - ширина начинается от начальной точки
                widthX = (startX - 5) + OFFSET;
            } else {
                // Выделение слева - ширина заканчивается у начальной точки
                widthX = (startX + 5) - widthDisplayWidth - OFFSET;
            }

            // Размещаем ширину с внешней стороны выделения
            if (isDownDirection) {
                // Выделение вниз - ширина сверху
                widthY = rectTop - widthDisplayHeight - OFFSET;
            } else {
                // Выделение вверх - ширина снизу
                widthY = rectTop + height + OFFSET;
            }

            // Ограничиваем позиционирование в пределах окна
            widthX = Math.max(OFFSET, Math.min(widthX, window.innerWidth - widthDisplayWidth - OFFSET));
            widthY = Math.max(OFFSET, Math.min(widthY, window.innerHeight - widthDisplayHeight - OFFSET));

            widthDisplay.style.left = `${widthX}px`;
            widthDisplay.style.top = `${widthY}px`;
        }

        // Позиционирование высоты - всегда вдоль левой или правой границы
        if (height > 10) {
            let heightX, heightY;

            // Размещаем высоту с внешней стороны выделения
            if (isRightDirection) {
                // Выделение справа - высота слева
                heightX = (rectLeft + 17) - heightDisplayWidth - OFFSET;
            } else {
                // Выделение слева - высота справа
                heightX = rectLeft + width + OFFSET;
            }

            if (isDownDirection) {
                // Выделение вниз - высота начинается от начальной точки
                heightY = (startY - 5) + OFFSET;
            } else {
                // Выделение вверх - высота заканчивается у начальной точки
                heightY = (startY - 20) - heightDisplayHeight - OFFSET;
            }

            // Ограничиваем позиционирование в пределах окна
            heightX = Math.max(OFFSET, Math.min(heightX, window.innerWidth - heightDisplayWidth - OFFSET));
            heightY = Math.max(OFFSET, Math.min(heightY, window.innerHeight - heightDisplayHeight - OFFSET));

            heightDisplay.style.left = `${heightX}px`;
            heightDisplay.style.top = `${heightY}px`;
        }
    }

    activate() {
        if (this.isActive) return;

        this.isActive = true;
        this.overlay.style.display = 'block';
        this.overlay.focus();
        document.body.style.cursor = 'crosshair';
        document.body.style.userSelect = 'none';

        console.log('Pixel Ruler activated');
    }

    deactivate() {
        if (!this.isActive) return;

        // Очищаем таймаут
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        this.isActive = false;
        this.overlay.style.display = 'none';
        this.rulerElement.style.display = 'none';
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
        this.startPoint = null;
        this.endPoint = null;

        // Скрываем ручки изменения размера
        if (this.resizeHandles) {
            Object.values(this.resizeHandles).forEach(handle => {
                handle.style.display = 'none';
            });
        }

        // Удаляем все элементы отображения размеров
        const elementsToRemove = [
            'pixel-ruler-width-display',
            'pixel-ruler-height-display'
        ];

        elementsToRemove.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });

        console.log('Pixel Ruler deactivated');
    }

    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }
}

// Инициализация при загрузке страницы
console.log('Pixel Ruler content script loaded');

// Автоматическая инициализация
pixelRuler = new PixelRuler();

// Уведомляем background script
chrome.runtime.sendMessage({ status: 'RULER_INITIALIZED' });

// Обработчик сообщений от popup и background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleRuler") {
        pixelRuler.toggle();
        sendResponse({ status: "success", active: pixelRuler.isActive });
        return true
    }

    return true;
});