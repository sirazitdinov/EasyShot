import ImageEditor from './EditorCore.js';

// Создаем экземпляр редактора при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new ImageEditor(); // можно сохранить в window для удобства отладки
    init();
});

function init() {
    window.editor.loadVersion();
}
