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
}