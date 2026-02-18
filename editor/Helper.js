export default class Helper {

    // Вспомогательный метод для глубокого слияния объектов
    static deepMerge(target, source) {
        const output = Object.assign({}, target);
        if (Object.isFrozen(output)) return output;

        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!(key in target)) {
                    output[key] = source[key];
                } else {
                    output[key] = this.deepMerge(target[key], source[key]);
                }
            } else {
                output[key] = source[key];
            }
        });
        return output;
    }

    static formatSize(value) {
        return Math.round(value * 10) / 10; // Округляем до 1 знака после запятой
    }

    /**
     * Получает коэффициент масштабирования для конвертации координат канваса в CSS-пиксели
     * @param {HTMLCanvasElement} canvas
     * @param {number} [dpr] — Device Pixel Ratio (опционально, не используется)
     * @returns {number}
     */
    static getScaleFactor(canvas, dpr = 1) {
        if (!canvas || !canvas.width || !canvas.clientWidth) return 1;
        // canvas.clientWidth уже учитывает DPR через style.width = width / DPR
        // Поэтому просто делим отображаемый размер на внутреннее разрешение
        return canvas.clientWidth / canvas.width;
    }

    /**
     * Конвертирует координаты канваса в CSS-пиксели для отображения
     * @param {number} canvasValue — значение в пикселях канваса
     * @param {HTMLCanvasElement} canvas
     * @param {number} [dpr] — Device Pixel Ratio (опционально, не используется)
     * @returns {number}
     */
    static toCssPixels(canvasValue, canvas, dpr = 1) {
        return canvasValue * Helper.getScaleFactor(canvas, dpr);
    }

    /**
     * Конвертирует CSS-пиксели в координаты канваса
     * @param {number} cssValue — значение в CSS-пикселях
     * @param {HTMLCanvasElement} canvas
     * @param {number} [dpr] — Device Pixel Ratio (опционально, не используется)
     * @returns {number}
     */
    static toCanvasPixels(cssValue, canvas, dpr = 1) {
        const scale = Helper.getScaleFactor(canvas, dpr);
        return scale === 0 ? 0 : cssValue / scale;
    }
}