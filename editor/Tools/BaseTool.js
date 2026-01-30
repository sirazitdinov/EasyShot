// Tools/BaseTool.js

/**
 * Базовый класс для всех инструментов редактора изображений
 * Определяет общий интерфейс и обеспечивает базовую функциональность
 */
export default class BaseTool {
    /**
     * @param {Object} editor - Ссылка на основной экземпляр редактора
     * @param {Object} options - Настройки инструмента
     * @param {string} options.name - Название инструмента
     * @param {string[]} options.settingsIds - Идентификаторы DOM-элементов с настройками инструмента
     */
    constructor(editor, options = {}) {
        this.editor = editor;
        this.name = options.name || 'base';
        this.settingsIds = options.settingsIds || [];
        this.isActive = false;
        this.isDrawing = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.overlay = this.editor.selectionOverlay;
        this.canvas = this.editor.canvas;
        this.ctx = this.editor.context;

        // Хранение состояния для функции отмены
        this.historyState = null;
    }

    // Абстрактный метод
    getUISettingsConfig() {
        throw new Error('Must be implemented by subclass');
    }

    // Применение кропа
    applyToCroppedCanvas() {
        throw new Error('Must be implemented by subclass');
    }

    /**
     * Активация инструмента
     * Устанавливает обработчики событий и показывает настройки
     */
    activate() {
        this.isActive = true;
        // this.showSettings();
        // this.editor.updateToolbarButtons(this.name);
        this.setupOverlay();

        // this.editor.showToolSettings(this);
    }

    /**
     * Деактивация инструмента
     * Удаляет обработчики событий и скрывает настройки
     */
    deactivate() {
        this.isActive = false;
        // this.hideSettings();
        // this.editor.updateToolbarButtons(this.name);
        this.cleanupOverlay();
        this.isDrawing = false;

        // Убираем настройки
        // this.editor.showToolSettings(null);
    }

    /**
     * Настраивает overlay для текущего инструмента
     */
    setupOverlay() {
        this.overlay.classList.remove('active', 'crop-mode', 'move', 'highlight-mode');
        this.overlay.className = '';
        this.overlay.style.display = 'block';
        this.overlay.innerHTML = '';
    }

    /**
     * Очищает overlay после использования инструмента
     */
    cleanupOverlay() {
        this.overlay.style.display = 'none';
        this.overlay.innerHTML = '';
        this.overlay.className = '';
    }

    /**
     * Обновляет UI настроек для конкретного инструмента
     * Предназначен для переопределения в дочерних классах
     */
    updateSetting() {
        // Базовая реализация для переопределения
    }

    getUISettings(){
        // По умолчанию — пусто
        return {
            visibleElements: [],        // массив id-элементов (например: ['blurRadius', 'blurRadiusLabel'])
            settingsValues: {}          // текущие значения (опционально, для инициализации полей)
        };
    }

    /**
     * Обработка нажатия клавиш
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        // ESC для отмены текущего действия
        if (event.key === 'Escape') {
            this.cancelOperation();
        }
    }

    /**
     * Отмена текущей операции
     * Предназначен для переопределения в дочерних классах
     */
    cancelOperation() {
        this.isDrawing = false;
        this.cleanupOverlay();
        this.setupOverlay();
        this.deactivate();
    }

    /**
     * Обновляет overlay во время рисования
     * Предназначен для переопределения в дочерних классах
     */
    updateOverlay() {
        // Базовая реализация для переопределения
    }

    /**
     * Применяет операцию к холсту
     * Предназначен для переопределения в дочерних классах
     */
    applyOperation() {
        // Базовая реализация для переопределения
    }

    /**
     * Сохраняет текущее состояние холста для функции отмены
     */
    saveHistoryState() {
        // Сохраняем текущее состояние холста
        this.editor.addHistoryState();
    }

    /**
     * Возвращает координаты относительно холста
     * @param {MouseEvent} event
     * @returns {Object} {x, y}
     */
    getCanvasCoords(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    /**
     * Конвертирует данные изображения в Blob
     * @param {string} format - формат изображения (png, jpeg, webp)
     * @param {number} quality - качество для форматов с потерями (jpeg, webp)
     * @returns {Promise<Blob>}
     */
    canvasToBlob(format = 'png', quality = 0.9) {
        return new Promise((resolve) => {
            this.canvas.toBlob(resolve, `image/${format}`, quality);
        });
    }
}