// HistoryManager.js

/**
 * Менеджер истории операций редактора.
 * Отвечает за:
 * - сохранение/восстановление состояний
 * - отмену (undo) и повтор (redo)
 * - управление лимитом истории (по умолчанию 50)
 */

export default class HistoryManager {
    /**
     * @param {ImageEditor} editor — ссылка на экземпляр EditorCore
     * @param {Object} options
     * @param {number} [options.maxHistory=50] — максимальное количество шагов истории
     * @param {boolean} [options.deduplicate=true] — избегать повторяющихся состояний
     */
    constructor(editor, options = {}) {
        this.editor = editor;
        this.maxHistory = options.maxHistory ?? 50;
        this.deduplicate = options.deduplicate ?? true;

        this.history = [];
        this.position = -1;
        this.isInsideAtomicOperation = false;
        this.atomicSnapshot = null;
    }

    /**
     * Сохраняет текущее состояние как точку истории.
     * Автоматически обрезает "будущее", если есть отменённые шаги.
     * @param {string} [label=''] — название шага (для отладки или фичи "что отменилось")
     * @param {boolean} [force=false] — если true, сохранит даже при disabled deduplication или одинаковом состоянии
     */
    commit(label = '', force = false) {
        if (this.isInsideAtomicOperation) {
            // Если внутри атомарной операции — просто запоминаем последний снимок, не пушим
            this.atomicSnapshot = this.captureState(label);
            return;
        }

        const newState = this.captureState(label);

        // Дедупликация: не сохраняем, если состояние идентично предыдущему
        if (this.deduplicate && this.position >= 0 && this.isStateEqual(newState, this.history[this.position])) {
            if (!force) return;
        }

        // Обрезаем "вперёд", если были отмены
        if (this.position < this.history.length - 1) {
            this.history = this.history.slice(0, this.position + 1);
        }

        this.history.push(newState);
        this.position = this.history.length - 1;

        // Обрезка до макс. размера
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.position--;
        }

        this.editor.updateToolbarButtons(); // или вызов через callback — смотри ниже
    }

    /**
     * Начинает атомарную операцию: все вызовы commit() внутри не сохраняют шаги,
     * а лишь обновляют временное состояние; только при `endAtomicOperation()` — фиксируется один шаг.
     * Пример: drag → множество промежуточных render() → только onMouseUp() фиксируем результат.
     * @param {string} label — метка операции (например, 'Resize Rectangle')
     */
    beginAtomicOperation(label = 'Atomic Operation') {
        this.isInsideAtomicOperation = true;
        this.atomicSnapshot = this.captureState(label);
    }

    /**
     * Завершает атомарную операцию и фиксирует итоговое состояние как один шаг истории.
     */
    endAtomicOperation() {
        if (!this.isInsideAtomicOperation) return;

        this.isInsideAtomicOperation = false;

        if (this.atomicSnapshot) {
            // Сравниваем с текущим state — если изменилось, коммитим
            const currentState = this.captureState(this.atomicSnapshot.label);
            if (!this.isStateEqual(currentState, this.atomicSnapshot)) {
                this.history.push(currentState);
                this.position = this.history.length - 1;
                if (this.history.length > this.maxHistory) {
                    this.history.shift();
                    this.position--;
                }
            }
            this.atomicSnapshot = null;
        }

        this.editor.updateToolbarButtons();
    }

    /**
     * Фиксирует текущее состояние редактора.
     * Можно расширить для поддержки слоёв, инструментов, выделений и т.д.
     * @param {string} label
     * @returns {Object} — снимок состояния
     */
    captureState(label = '') {
        const canvas = this.editor.canvas;
        const ctx = this.editor.context;
        const layers = this.editor.layerManager?.layers || [];

        return {
        timestamp: Date.now(),
        label,
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        layers: layers.map(l => ({
            id: l.id,
            type: l.type,
            visible: l.visible,
            rect: l.rect ? { ...l.rect } : null,
            points: l.points ? { ...l.points } : null,
            params: l.params ? { ...l.params } : null
        })),
        activeLayerId: this.editor.layerManager?.activeLayer?.id || null,
        activeToolName: this.editor.activeTool?.name || null
        };
    }

    /**
     * Сравнивает два состояния по содержимому.
     * На данный момент сравнивает только imageData (байт-в-байт).
     * @param {Object} a
     * @param {Object} b
     * @returns {boolean}
     */
    isStateEqual(a, b) {
        if (!a?.imageData || !b?.imageData) return a === b;

        const d1 = a.imageData.data;
        const d2 = b.imageData.data;

        if (d1.length !== d2.length) return false;

        // Быстрое сравнение 32-битных пикселей через buffer
        const b1 = new Uint32Array(d1.buffer);
        const b2 = new Uint32Array(d2.buffer);

        // Можно добавить early break при первом отличии
        for (let i = 0; i < b1.length; i++) {
            if (b1[i] !== b2[i]) return false;
        }

        return true;
    }

    /**
     * Очищает историю (например, при открытии нового изображения)
     */
    clear() {
        this.history = [];
        this.position = -1;
        this.atomicSnapshot = null;
        this.editor.updateToolbarButtons();
    }

    // === Undo / Redo ===

    canUndo() {
        return this.position > 0;
    }

    canRedo() {
        return this.position < this.history.length - 1;
    }

    undo() {
        if (!this.canUndo()) return null;

        this.position--;
        this.restoreState(this.history[this.position]);
        this.editor.updateToolbarButtons();
        return this.history[this.position];
    }

    redo() {
        if (!this.canRedo()) return null;

        this.position++;
        this.restoreState(this.history[this.position]);
        this.editor.updateToolbarButtons();
        return this.history[this.position];
    }

    /**
     * Восстанавливает состояние на холст и в модель.
     * @param {Object} state — результат captureState()
     */
    restoreState(state) {
        if (!state?.imageData) return;

        const { imageData, layers, activeLayerId, activeToolName } = state;
        const layerManager = this.editor.layerManager;

        // 1. Восстанавливаем пиксели
        this.editor.context.putImageData(imageData, 0, 0);

        // 2. Восстанавливаем параметры слоёв (rect/points/params), но НЕ imageData — они уже на холсте
        if (layerManager && Array.isArray(layers) && layers.length === layerManager.layers.length) {
        layerManager.layers.forEach((layer, i) => {
            const saved = layers[i];
            if (saved) {
            layer.rect = saved.rect ? { ...saved.rect } : null;
            layer.points = saved.points ? { ...saved.points } : null;
            layer.params = saved.params ? { ...saved.params } : null;
            layer.visible = saved.visible;
            }
        });
        }

        // 3. Активный слой
        if (layerManager) {
        if (activeLayerId) {
            layerManager.setActiveLayerById(activeLayerId);
        } else {
            layerManager.activeLayerIndex = -1;
        }
        }

        // 4. Активный инструмент (опционально — можно оставить на усмотрение EditorCore)
        // Например: при undo не менять активный инструмент — оставить как есть.

        // 5. Обновление UI
        this.editor.render(); // или editor.redrawCanvas(), если слои растровые
        this.editor.updateLayersPanel();
    }

    // === Интеграция с UI ===

    /**
     * Возвращает строку с описанием текущего шага (для отладки или tooltip'ов)
     * @returns {string}
     */
    getCurrentStepDescription() {
        if (this.position < 0 || this.position >= this.history.length) {
            return 'Начальное состояние';
        }
        return this.history[this.position].label || `Шаг ${this.position}`;
    }
}