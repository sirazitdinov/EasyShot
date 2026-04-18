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
    constructor(editor, settings, name, options = {}) {
        this.editor = editor;       // ссылка на EditorCore
        this.settings = settings;   // объект настроек для инструмента
        this.name = name;           // 'crop' | 'blur' | 'highlight' | 'line' | 'text'
        this.supportsCreation = !!options.supportsCreation;

        this.overlay = null;        // DOM-элемент selectionOverlay (назначается в setupOverlay)
        this.previewElement = null; // опциональный DOM для превью
    }

    // Жизненный цикл инструмента
    /**
     * Активация инструмента
     * Предназначен для переопределения в дочерних классах
     */
    activate() { }

    /**
     * Деактивация инструмента
     * Предназначен для переопределения в дочерних классах
     */
    deactivate() { }

    /**
     * Настраивает overlay для текущего инструмента
     *  @param {HTMLElement} overlayElement
     */
    setupOverlay(overlayElement) {
        this.overlay = overlayElement;
    }

    /**
     * Очищает overlay после использования инструмента
     */
    cleanupOverlay() {
        this.overlay = null;
        this.removePreviewElement?.();
    }

    // Работа с мышью — инструменты могут переопределять
    handleMouseDown(e) { }
    handleMouseMove(e) { }
    handleMouseUp(e) { }

    // Обновление overlay (e.g. при изменении активного слоя, спустя drag-n-drop и т.п.)
    updateOverlay() { }

    /**
     * Обновляет настройки инструмента (внутреннее состояние) при изменении UI
     * @param {string} key
     * @param {string|number|boolean} value
     */
    updateSetting(key, value) {
        if (!this.settings) return;
        this.settings[key] = value;
    }

    // Общий механизм для DOM-превью

    /**
   * Создаёт DOM-элемент превью внутри overlay
   * @param {string} id
   * @param {string} className
   * @returns {HTMLElement|null}
   */
    createPreviewElement(id, className) {
        if (!this.overlay) return null;
        const el = document.createElement('div');
        el.id = id;
        el.className = className;
        this.overlay.appendChild(el);
        this.previewElement = el;
        return el;
    }

    /**
     * Обновление позиции/размера превью
     * Предназначен для переопределения в дочерних классах
     * @param {Object} rectOrPoints - Объект с координатами и размерами ({x, y, width, height}) или точками
     */
    updatePreviewPosition(rectOrPoints) { }

    /**
     * Удаляет DOM-элемент превью, если он существует
     */
    removePreviewElement() {
        if (this.previewElement && this.previewElement.parentNode) {
            this.previewElement.parentNode.removeChild(this.previewElement);
        }
        this.previewElement = null;
    }

    /**
     * Обновляет UI элементы настроек из текущего состояния this.settings
     * Вызывается при выборе слоя для синхронизации UI с параметрами слоя
     */
    updateSettingsUI() {
        if (!this.settings || !this.editor.toolSettingsUI) return;

        this.editor.toolSettingsUI.renderSettings(this);
    }
}