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
        this.sizeDisplays = {}; // Объект для хранения элементов отображения размеров

        // Настройки расстояний (можно менять)
        this.distanceSettings = {
            fromHorizontalEdge: 15,  // Расстояние от горизонтальных границ (верх/низ)
            fromVerticalEdge: 35,    // Расстояние от вертикальных границ (лево/право)
            diagonalOffset: 10       // Смещение диагонального размера от центра
        };

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

        // Создаем элементы для отображения размеров по сторонам
        this.sizeDisplays = {
            top: this.createSizeDisplayElement('top'),
            right: this.createSizeDisplayElement('right'),
            bottom: this.createSizeDisplayElement('bottom'),
            left: this.createSizeDisplayElement('left'),
            diagonal: this.createSizeDisplayElement('diagonal')
        };

        // Добавляем элементы в DOM
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.rulerElement);
        Object.values(this.sizeDisplays).forEach(display => {
            document.body.appendChild(display);
        });
    }

    createSizeDisplayElement(position) {
        const element = document.createElement('div');
        element.className = `pixel-ruler-size pixel-ruler-size-${position}`;
        element.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      font-weight: bold;
      pointer-events: none;
      z-index: 2147483647;
      display: none;
      white-space: nowrap;
    `;
        return element;
    }

    bindEvents() {
        this.overlay.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.overlay.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.overlay.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Обработчик для закрытия по ESC
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleMouseDown(e) {
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        this.startPoint = { x: e.clientX, y: e.clientY };
        this.endPoint = { x: e.clientX, y: e.clientY };

        this.updateRulerDisplay();
        this.rulerElement.style.display = 'block';
        this.showSizeDisplays();
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

        // Автоматическое скрытие через 3 секунды
        setTimeout(() => {
            this.hideSizeDisplays();
            this.rulerElement.style.display = 'none';
        }, 300000);

        this.startPoint = null;
        this.endPoint = null;
    }

    handleKeyDown(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            this.deactivate();
        }
    }

    updateRulerDisplay() {
        if (!this.startPoint || !this.endPoint) return;

        const width = Math.abs(this.endPoint.x - this.startPoint.x);
        const height = Math.abs(this.endPoint.y - this.startPoint.y);
        const diagonal = Math.sqrt(width * width + height * height);

        const left = Math.min(this.startPoint.x, this.endPoint.x);
        const top = Math.min(this.startPoint.y, this.endPoint.y);
        const right = left + width;
        const bottom = top + height;
        const centerX = left + width / 2;
        const centerY = top + height / 2;

        // Обновляем позицию и размер линейки
        this.rulerElement.style.left = `${left}px`;
        this.rulerElement.style.top = `${top}px`;
        this.rulerElement.style.width = `${width}px`;
        this.rulerElement.style.height = `${height}px`;

        // Обновляем отображение размеров с учетом расстояний
        this.updateHorizontalDisplays(width, height, left, top, right, bottom, centerX, centerY);
        this.updateVerticalDisplays(width, height, left, top, right, bottom, centerX, centerY);
        this.updateDiagonalDisplay(diagonal, width, height, centerX, centerY);
    }

    updateHorizontalDisplays(width, height, left, top, right, bottom, centerX, centerY) {
        const fromEdge = this.distanceSettings.fromHorizontalEdge;

        // ВЕРХНИЙ размер - отступаем ВВЕРХ на заданное расстояние
        let topDisplayY = top - fromEdge; // От верхней границы ВВЕРХ
        let topDisplayX = centerX;

        // Если сверху нет места, показываем внутри элемента
        if (topDisplayY < 20) {
            topDisplayY = top + 10; // Внутри элемента, чуть ниже верхней границы
            this.sizeDisplays.top.style.background = 'rgba(0, 100, 255, 0.9)';
        } else {
            this.sizeDisplays.top.style.background = 'rgba(0, 0, 0, 0.8)';
        }

        // Проверяем границы экрана
        topDisplayX = Math.max(40, Math.min(topDisplayX, window.innerWidth - 40));
        topDisplayY = Math.max(20, Math.min(topDisplayY, window.innerHeight - 40));

        if (width > 10) {
            this.updateSizeDisplay('top', width, topDisplayX, topDisplayY, '↔');
        } else {
            this.sizeDisplays.top.style.display = 'none';
        }

        // НИЖНИЙ размер - отступаем ВНИЗ на заданное расстояние
        let bottomDisplayY = bottom + fromEdge; // От нижней границы ВНИЗ
        let bottomDisplayX = centerX;

        // Если снизу нет места, показываем внутри элемента
        if (bottomDisplayY > window.innerHeight - 30) {
            bottomDisplayY = bottom - 10; // Внутри элемента, чуть выше нижней границы
            this.sizeDisplays.bottom.style.background = 'rgba(0, 100, 255, 0.9)';
        } else {
            this.sizeDisplays.bottom.style.background = 'rgba(0, 0, 0, 0.8)';
        }

        // Проверяем границы экрана
        bottomDisplayX = Math.max(40, Math.min(bottomDisplayX, window.innerWidth - 40));
        bottomDisplayY = Math.max(20, Math.min(bottomDisplayY, window.innerHeight - 40));

        if (width > 10) {
            this.updateSizeDisplay('bottom', width, bottomDisplayX, bottomDisplayY, '↔');
        } else {
            this.sizeDisplays.bottom.style.display = 'none';
        }
    }

    updateVerticalDisplays(width, height, left, top, right, bottom, centerX, centerY) {
        const fromEdge = this.distanceSettings.fromVerticalEdge;

        // ЛЕВЫЙ размер - отступаем ВЛЕВО на заданное расстояние
        let leftDisplayX = left - fromEdge; // От левой границы ВЛЕВО
        let leftDisplayY = centerY;

        // Если слева нет места, показываем внутри элемента
        if (leftDisplayX < 30) {
            leftDisplayX = left + 15; // Внутри элемента, чуть правее левой границы
            this.sizeDisplays.left.style.background = 'rgba(0, 100, 255, 0.9)';
        } else {
            this.sizeDisplays.left.style.background = 'rgba(0, 0, 0, 0.8)';
        }

        // Проверяем границы экрана
        leftDisplayX = Math.max(20, Math.min(leftDisplayX, window.innerWidth - 60));
        leftDisplayY = Math.max(30, Math.min(leftDisplayY, window.innerHeight - 30));

        if (height > 15) {
            this.updateSizeDisplay('left', height, leftDisplayX, leftDisplayY, '↕');
            this.sizeDisplays.left.style.writingMode = 'sideways-lr';
            this.sizeDisplays.left.style.textOrientation = 'mixed';
        } else {
            this.sizeDisplays.left.style.display = 'none';
        }

        // ПРАВЫЙ размер - отступаем ВПРАВО на заданное расстояние
        let rightDisplayX = right + fromEdge; // От правой границы ВПРАВО
        let rightDisplayY = centerY;

        // Если справа нет места, показываем внутри элемента
        if (rightDisplayX > window.innerWidth - 30) {
            rightDisplayX = right - 15; // Внутри элемента, чуть левее правой границы
            this.sizeDisplays.right.style.background = 'rgba(0, 100, 255, 0.9)';
        } else {
            this.sizeDisplays.right.style.background = 'rgba(0, 0, 0, 0.8)';
        }

        // Проверяем границы экрана
        rightDisplayX = Math.max(20, Math.min(rightDisplayX, window.innerWidth - 60));
        rightDisplayY = Math.max(30, Math.min(rightDisplayY, window.innerHeight - 30));

        if (height > 15) {
            this.updateSizeDisplay('right', height, rightDisplayX, rightDisplayY, '↕');
            this.sizeDisplays.right.style.writingMode = 'vertical-lr';
            this.sizeDisplays.right.style.textOrientation = 'mixed';
        } else {
            this.sizeDisplays.right.style.display = 'none';
        }
    }

    updateDiagonalDisplay(diagonal, width, height, centerX, centerY) {
        const { diagonal: diagonalOffset } = this.distanceSettings;

        // Умное позиционирование диагонального размера
        let diagonalX = centerX;
        let diagonalY = centerY - diagonalOffset;

        // Определяем оптимальную позицию в зависимости от размера области
        if (width < 80 || height < 60) {
            // Для маленьких областей смещаем в сторону с большим пространством
            const rightSpace = window.innerWidth - (centerX + 50);
            const leftSpace = centerX - 50;
            const topSpace = centerY - 40;
            const bottomSpace = window.innerHeight - (centerY + 40);

            if (rightSpace > leftSpace && rightSpace > 60) {
                diagonalX = centerX + Math.min(40, rightSpace / 2);
            } else if (leftSpace > 60) {
                diagonalX = centerX - Math.min(40, leftSpace / 2);
            }

            if (bottomSpace > topSpace && bottomSpace > 40) {
                diagonalY = centerY + Math.min(30, bottomSpace / 2);
            } else if (topSpace > 40) {
                diagonalY = centerY - Math.min(30, topSpace / 2);
            }
        }

        // Дополнительная проверка чтобы не перекрывать другие размеры
        if (height < 100 && diagonalY < centerY - 10) {
            // Если область низкая, опускаем диагональный размер ниже
            diagonalY = centerY + 25;
        }

        // Гарантируем, что не выйдем за границы экрана
        diagonalX = Math.max(50, Math.min(diagonalX, window.innerWidth - 50));
        diagonalY = Math.max(30, Math.min(diagonalY, window.innerHeight - 30));

        // Показываем диагональный размер только для значительных размеров
        if (diagonal > 20 && width > 10 && height > 10) {
            this.updateSizeDisplay('diagonal', diagonal, diagonalX, diagonalY, '↗');
            this.sizeDisplays.diagonal.style.background = 'rgba(255, 100, 0, 0.9)';
            this.sizeDisplays.diagonal.style.zIndex = '2147483648';
        } else {
            this.sizeDisplays.diagonal.style.display = 'none';
        }
    }

    updateSizeDisplay(position, size, x, y, symbol) {
        const display = this.sizeDisplays[position];
        if (display && size > 5) { // Не показываем для очень маленьких размеров
            display.textContent = `${symbol} ${Math.round(size)}px`;
            display.style.left = `${x}px`;
            display.style.top = `${y}px`;
            display.style.display = 'block';

            // Центрирование в зависимости от позиции
            if (position === 'top' || position === 'bottom') {
                display.style.transform = 'translateX(-50%)';
                display.style.textAlign = 'center';
            } else if (position === 'left' || position === 'right') {
                display.style.transform = 'translateY(-50%)';
                display.style.textAlign = 'center';
            } else {
                display.style.transform = 'translate(-50%, -50%)';
                display.style.textAlign = 'center';
            }
        } else if (display) {
            display.style.display = 'none';
        }
    }

    // Метод для изменения настроек расстояний (можно вызывать извне)
    setDistanceSettings(settings) {
        this.distanceSettings = { ...this.distanceSettings, ...settings };
        if (this.isActive && this.startPoint && this.endPoint) {
            this.updateRulerDisplay();
        }
    }

    showSizeDisplays() {
        Object.values(this.sizeDisplays).forEach(display => {
            display.style.display = 'block';
        });
    }

    hideSizeDisplays() {
        Object.values(this.sizeDisplays).forEach(display => {
            display.style.display = 'none';
        });
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

        this.isActive = false;
        this.overlay.style.display = 'none';
        this.rulerElement.style.display = 'none';
        this.hideSizeDisplays();
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
        this.startPoint = null;
        this.endPoint = null;

        console.log('Pixel Ruler deactivated');
    }

    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    cleanup() {
        // Удаляем элементы из DOM
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.rulerElement && this.rulerElement.parentNode) {
            this.rulerElement.parentNode.removeChild(this.rulerElement);
        }

        Object.values(this.sizeDisplays).forEach(display => {
            if (display && display.parentNode) {
                display.parentNode.removeChild(display);
            }
        });

        // Восстанавливаем стили
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
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