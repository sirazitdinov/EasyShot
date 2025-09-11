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

        // Добавляем элементы в DOM
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.rulerElement);
    }

    bindEvents() {
        this.overlay.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.overlay.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.overlay.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Обработчик для закрытия по ESC
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
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

        this.updateRulerDisplay();
        this.rulerElement.style.display = 'block';
    }

    handleMouseMove(e) {
        if (!this.startPoint) return;

        e.preventDefault();
        e.stopPropagation();

        this.endPoint = { x: e.clientX, y: e.clientY };
        this.updateRulerDisplay();
    }

    handleMouseUp(e) {
        if (!this.startPoint) return;

        e.preventDefault();
        e.stopPropagation();

        // Автоматическое скрытие через 3 секунды только после отпускания кнопки
        this.hideTimeout = setTimeout(() => {
            const elementsToHide = [
                'pixel-ruler-element',
                'pixel-ruler-width-display',
                'pixel-ruler-height-display'
            ];

            elementsToHide.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.style.display = 'none';
                }
            });
        }, 300000);

        this.startPoint = null;
        this.endPoint = null;
    }

    handleKeyDown(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            // Очищаем таймаут при закрытии
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }
            this.deactivate();
        }
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

        // Определяем направление выделения
        const isRightDirection = this.endPoint.x >= this.startPoint.x;
        const isDownDirection = this.endPoint.y >= this.startPoint.y;

        // Позиционируем от внешней стороны с учетом направления
        this.updateSizeDisplays(this.startPoint.x, this.startPoint.y, left, top, width, height, isRightDirection, isDownDirection);
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
                widthX = (startX -5) + OFFSET;
            } else {
                // Выделение слева - ширина заканчивается у начальной точки
                widthX = (startX+5) - widthDisplayWidth - OFFSET;
            }

            // Размещаем ширину с внешней стороны выделения
            if (isDownDirection) {
                // Выделение вниз - ширина сверху
                widthY = rectTop  - widthDisplayHeight - OFFSET;
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
                heightX = (rectLeft+17) - heightDisplayWidth - OFFSET;
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

// Обработчик сообщений от popup и background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleRuler") {
        try {
            if (!pixelRuler) {
                pixelRuler = new PixelRuler();
            }
            pixelRuler.toggle();
            sendResponse({ status: "success", active: pixelRuler.isActive });
        } catch (error) {
            console.error('Error toggling ruler:', error);
            sendResponse({ status: "error", message: error.message });
        }
        return true; // Сообщаем, что ответ будет асинхронным
    }

    if (request.action === "getRulerStatus") {
        sendResponse({
            status: "success",
            active: pixelRuler ? pixelRuler.isActive : false
        });
    }

    return true;
});

// Инициализация при загрузке страницы
console.log('Pixel Ruler content script loaded');