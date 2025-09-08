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
    this.sizeDisplay = null;
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

    // Создаем элемент для отображения размера
    this.sizeDisplay = document.createElement('div');
    this.sizeDisplay.id = 'pixel-ruler-size-display';
    this.sizeDisplay.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      font-weight: bold;
      pointer-events: none;
      z-index: 2147483647;
      white-space: nowrap;
    `;

    // Добавляем элементы в DOM
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.rulerElement);
    document.body.appendChild(this.sizeDisplay);
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

    this.startPoint = { x: e.clientX, y: e.clientY };
    this.endPoint = { x: e.clientX, y: e.clientY };

    this.updateRulerDisplay();
    this.rulerElement.style.display = 'block';
    this.sizeDisplay.style.display = 'block';
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
      if (this.rulerElement) {
        this.rulerElement.style.display = 'none';
      }
      if (this.sizeDisplay) {
        this.sizeDisplay.style.display = 'none';
      }
    }, 3000);

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
    const distance = Math.sqrt(width * width + height * height);

    // Позиционируем линейку
    const left = Math.min(this.startPoint.x, this.endPoint.x);
    const top = Math.min(this.startPoint.y, this.endPoint.y);

    this.rulerElement.style.left = `${left}px`;
    this.rulerElement.style.top = `${top}px`;
    this.rulerElement.style.width = `${width}px`;
    this.rulerElement.style.height = `${height}px`;

    // Позиционируем отображение размера
    const displayX = (this.startPoint.x + this.endPoint.x) / 2;
    const displayY = (this.startPoint.y + this.endPoint.y) / 2 - 30;

    this.sizeDisplay.style.left = `${Math.max(10, Math.min(displayX, window.innerWidth - 100))}px`;
    this.sizeDisplay.style.top = `${Math.max(10, Math.min(displayY, window.innerHeight - 40))}px`;
    this.sizeDisplay.textContent = `←→ ${width}px   ↕ ${height}px   ↖↘ ${Math.round(distance)}px`;
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
    this.sizeDisplay.style.display = 'none';
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
    if (this.sizeDisplay && this.sizeDisplay.parentNode) {
      this.sizeDisplay.parentNode.removeChild(this.sizeDisplay);
    }

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
      sendResponse({status: "success", active: pixelRuler.isActive});
    } catch (error) {
      console.error('Error toggling ruler:', error);
      sendResponse({status: "error", message: error.message});
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