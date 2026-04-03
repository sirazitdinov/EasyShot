import ImageEditor from './EditorCore.js';

// Создаем экземпляр редактора при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new ImageEditor(); // можно сохранить в window для удобства отладки
    init();
});

// Освобождаем ресурсы при закрытии страницы/popup
window.addEventListener('beforeunload', () => {
    if (window.editor) {
        window.editor.destroy();
    }
});

function init() {
    window.editor.loadVersion();
}
