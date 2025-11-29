const blurBtn = document.getElementById('blurBtn');
const blurRadiusInput = document.getElementById('blurRadius');
const blurRadiusLabel = document.getElementById('blurRadiusLabel');
const canvas = document.getElementById('canvas');
const cropBtn = document.getElementById('cropBtn');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const dpr = window.devicePixelRatio || 1;
const fileInput = document.getElementById('fileInput');
const formatSelect = document.getElementById('formatSelect');
const HANDLE_SIZE = 8;        // размер ручек изменения размера областей
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const highlightBtn = document.getElementById('highlightBtn');
const highlightColorInput = document.getElementById('highlightColor');
const highlightColorLabel = document.getElementById('highlightColorLabel');
const lineBtn = document.getElementById('lineBtn');
const qualityLabel = document.getElementById('qualityLabel');
const qualityRange = document.getElementById('qualityRange');
const qualityValue = document.getElementById('qualityValue');
const saveBtn = document.getElementById('saveBtn');
const selectionOverlay = document.getElementById('selectionOverlay');
const toolSettings = document.getElementById('toolSettings');
const undoBtn = document.getElementById('undoBtn');
const textBtn = document.getElementById('textBtn');
const textColorInput = document.getElementById('textColor');
const textColorLabel = document.getElementById('textColorLabel');
const textSizeInput = document.getElementById('textSize');
const textSizeLabel = document.getElementById('textSizeLabel');

let activeLayer = null;   // текущий слой
let currentTool = null;
let dragState = null;     // {start, layer, handle, orig}
let historyStack = [];
let image = null;
let layers = [];          // {type, rect, params}
let originalImageData = null;


/* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */
function init() {
    const fileBtn = document.getElementById('fileBtn');
    fileBtn.addEventListener('click', () => fileInput.click());

    undoBtn.addEventListener('click', undoLastAction);
    blurRadiusInput.addEventListener('input', debounce(() => {
        if (activeLayer?.type === 'blur') {
            saveState(); // Сохраняем состояние перед изменением
            activeLayer.params.radius = +blurRadiusInput.value;
            render();
        }
    }, 150));

    highlightColorInput.addEventListener('input', () => {
        if (activeLayer?.type === 'highlight' || activeLayer?.type === 'line') {
            saveState(); // Сохраняем состояние перед изменением
            if (activeLayer.type === 'highlight') {
                activeLayer.params.color = highlightColorInput.value;
            } else {
                activeLayer.points.color = highlightColorInput.value;
            }
            render();
        }
    });

    textColorInput.addEventListener('input', () => {
        if (activeLayer?.type === 'text') {
            saveState();
            activeLayer.params.color = textColorInput.value;
            render();
            }
    });

    textSizeInput.addEventListener('input', () => {
        document.getElementById('textSizeValue').textContent = textSizeInput.value;
        if (activeLayer?.type === 'text') {
            saveState();
            activeLayer.params.fontSize = +textSizeInput.value;
            render();
        }
    });

    fileInput.addEventListener('change', handleFileSelect);

    cropBtn.addEventListener('click', () => startLayerCreation('crop'));
    blurBtn.addEventListener('click', () => startLayerCreation('blur'));
    highlightBtn.addEventListener('click', () => startLayerCreation('highlight'));
    lineBtn.addEventListener('click', () => startLayerCreation('line'));
    saveBtn.addEventListener('click', saveImage);
    textBtn.addEventListener('click', () => startLayerCreation('text'));

    document.addEventListener('keydown', e => { if (e.key === 'Escape') resetSelection(); });
    formatSelect.addEventListener('change', () => {
        qualityLabel.style.display = formatSelect.value !== 'png' ? 'inline-block' : 'none';
    });
    qualityRange.addEventListener('input', () => {
        qualityValue.textContent = Math.round(qualityRange.value * 100) + '%';
    });

    selectionOverlay.addEventListener('mousedown', onMouseDown);
    selectionOverlay.addEventListener('mousemove', onHover);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', e => {
        if (e.key === 'Delete' && activeLayer) {
            layers = layers.filter(l => l !== activeLayer);
            activeLayer = null;
            render();
            updateLayersList(); // Обновляем список слоев после удаления
        }
    });

    setToolsDisabled(true);

    fetchVersionFromManifest();

    // Инициализация панели слоев
    updateLayersList();
}

async function fetchVersionFromManifest() {
    try {
        // Предполагается, что manifest.json находится в корне расширения
        const response = await fetch(chrome.runtime.getURL('manifest.json'));
        const manifest = await response.json();
        document.getElementById('versionNumber').textContent = manifest.version || 'N/A';
    } catch (error) {
        console.error('Ошибка при загрузке версии из manifest.json:', error);
        document.getElementById('versionNumber').textContent = 'N/A';
    }
}

/* ---------- УТИЛИТЫ ---------- */
function setToolsDisabled(d) {
    [cropBtn, blurBtn, highlightBtn, saveBtn].forEach(b => b.disabled = d);
}

function debounce(fn, delay) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        // Сбрасываем активный инструмент и слой перед загрузкой нового изображения
        resetEditorState();


        const url = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = () => rej(new Error('File reading failed'));
            r.readAsDataURL(file);
        });

        // Обновляем информацию о файле
        document.getElementById('fileSize').textContent = formatFileSize(file.size);
        await loadImage(url);

        // Обновляем размеры selectionOverlay под новое изображение
        selectionOverlay.style.width = `${canvas.width}px`;
        selectionOverlay.style.height = `${canvas.height}px`;

        setToolsDisabled(false);
    } catch (err) { alert('Ошибка загрузки изображения'); }
}

function loadImage(src) {
    return new Promise(res => {
        image = new Image();
        image.onload = () => {
            canvas.width = image.naturalWidth / dpr;
            canvas.height = image.naturalHeight / dpr;
            ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight,
                0, 0, canvas.width, canvas.height);
            // adjustEditorSize();

            // Cброс инлайн-размеров canvas в CSS-режим
            canvas.style.width = '';
            canvas.style.height = '';

            originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Обновляем размеры selectionOverlay сразу после изменения canvas
            selectionOverlay.style.width = `${canvas.width}px`;
            selectionOverlay.style.height = `${canvas.height}px`;

            // Обновляем информацию о размерах
            document.getElementById('imageWidth').textContent = `${canvas.width}px`;
            document.getElementById('imageHeight').textContent = `${canvas.height}px`;
            document.getElementById('imageSize').textContent = `${canvas.width}×${canvas.height}px`;

            res();
        };
        image.src = src;
    });
}

function adjustEditorSize() {
    // const c = document.querySelector('.container');
    // c.style.width = `${canvas.width + 40}px`;
    // c.style.height = `${canvas.height + 100}px`;
}

function resetSelection() {
    // Сбрасываем только активный слой и инструмент, но НЕ трогаем другие слои
    activeLayer = null;
    currentTool = null;
    dragState = null;

    // Снимаем активность со всех кнопок инструментов
    document.querySelectorAll('.toolbar button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Скрываем панель настроек инструментов
    toolSettings.style.display = 'none';

    // Сбрасываем selectionOverlay
    selectionOverlay.style.display = 'none'; // или 'block', но без размера — обновим дальше
    selectionOverlay.className = '';
    selectionOverlay.style.cursor = 'default';

    render();
    updateLayersList(); // Обновляем список слоев после сброса
}

function resetEditorState() {
    // Сбрасываем все инструменты и состояние
    currentTool = null;
    activeLayer = null;
    dragState = null;

    // Очищаем историю и слои
    historyStack = [];
    layers = [];

    // Обновляем UI
    document.querySelectorAll('.toolbar button').forEach(btn => btn.classList.remove('active'));
    toolSettings.style.display = 'none';
    blurRadiusLabel.style.display = 'none';
    highlightColorLabel.style.display = 'none';
    textColorLabel.style.display = 'none';
    textSizeLabel.style.display = 'none';
    formatLabel.style.display = 'none';
    qualityLabel.style.display = 'none';

    // Скрываем и сбрасываем selectionOverlay
    selectionOverlay.style.display = 'none';
    selectionOverlay.className = '';
    selectionOverlay.style.cursor = 'default';
    selectionOverlay.style.left = '0';
    selectionOverlay.style.top = '0';
    selectionOverlay.style.width = '0';
    selectionOverlay.style.height = '0';

    // Очистка canvas (на всякий случай)
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Обновляем UI-части
    updateLayersList();
    render();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Функции для работы с панелью слоев
function updateLayersList() {
    const layersList = document.getElementById('layersList');
    layersList.innerHTML = ''; // Очищаем текущий список

    // Добавляем слой исходного изображения в самый низ (в конец списка)
    const bgItem = document.createElement('div');
    bgItem.className = 'layer-item';
    bgItem.innerHTML = `
        <div class="layer-icon">🖼️</div>
        <div class="layer-name">Исходное изображение</div>
    `;
    layersList.appendChild(bgItem);

    // Добавляем остальные слои в обратном порядке (последний слой сверху)
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const item = document.createElement('div');
        item.className = `layer-item ${activeLayer === layer ? 'active' : ''}`;
        item.dataset.index = i; // Сохраняем индекс слоя для drag and drop

        // Определяем иконку и имя слоя
        let icon = '❓'; // Заглушка
        let name = 'Неизвестный слой';
        if (layer.type === 'crop') { icon = '✂️'; name = 'Кадрирование'; }
        else if (layer.type === 'blur') { icon = '💧'; name = `Размытие (${layer.params?.radius || 5}px)`; }
        else if (layer.type === 'highlight') { icon = '⬜'; name = `Выделение (${layer.params?.color || '#ff0000'})`; }
        else if (layer.type === 'line') { icon = '↗️'; name = `Линия (${layer.points?.color || '#ff0000'})`; }
        else if (layer.type === 'text') { icon = '📝'; name = `Текст: "${layer.params?.text?.substring(0, 10) || 'Пусто'}..."`; }

        item.innerHTML = `
            <div class="layer-icon">${icon}</div>
            <div class="layer-name">${name}</div>
            <div class="layer-drag-handle">⋮⋮</div>
        `;

        // Обработчик клика для выбора слоя
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('layer-drag-handle')) { // Не реагировать на клик по ручке перетаскивания
                activeLayer = layer;
                render();
                updateLayersList(); // Обновляем список, чтобы отметить активный слой
            }
        });

        // Настройка drag and drop
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', i); // Передаем индекс слоя
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => item.classList.add('dragging'), 0); // Добавляем стиль во время перетаскивания
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });

        layersList.appendChild(item);
    }
}

// Обработчики событий для drag and drop
document.addEventListener('dragover', (e) => {
    e.preventDefault(); // Необходимо для срабатывания drop
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const dropTarget = e.target.closest('.layer-item');

    if (isNaN(draggedIndex) || !dropTarget || dropTarget.classList.contains('dragging')) {
        return; // Проверяем валидность индекса и целевого элемента
    }

    const dropIndex = parseInt(dropTarget.dataset.index);
    if (isNaN(dropIndex) || draggedIndex === dropIndex) {
        return; // Проверяем валидность индекса и не перетаскиваем на себя
    }

    // Перемещаем слой в массиве
    const [movedLayer] = layers.splice(draggedIndex, 1);
    // Вычисляем новый индекс в массиве, учитывая обратный порядок отображения
    // Слой с индексом 0 в массиве отображается внизу списка, слой с индексом length-1 - сверху
    // При перемещении в UI слой с индексом 3 может быть "выше" слоя с индексом 4.
    // Для корректного перемещения в массиве, нужно определить, куда именно его нужно вставить.
    // Если dropIndex (в UI) больше, чем draggedIndex (в UI), значит, мы перемещаем элемент вверх по UI (в конец массива).
    // Если dropIndex (в UI) меньше, чем draggedIndex (в UI), значит, мы перемещаем элемент вниз по UI (в начало массива).
    // Но т.к. UI отображается в обратном порядке, логика инвертируется.
    // Например, если мы перетаскиваем слой с индексом 1 (вверху UI) на позицию слоя с индексом 3 (внизу UI),
    // то в массиве он должен переместиться из позиции 1 в позицию 3.
    // И наоборот, если перетаскиваем слой с индексом 3 (внизу UI) на позицию слоя с индексом 1 (вверху UI),
    // то в массиве он должен переместиться из позиции 3 в позицию 1.
    // Это означает, что позиция вставки в массиве должна быть такой же, как dropIndex.
    layers.splice(dropIndex, 0, movedLayer);

    saveState(); // Сохраняем состояние после перемещения слоя
    updateLayersList(); // Обновляем список
    render(); // Перерисовываем холст
});

/* ---------- РАБОТА СО СЛОЯМИ ---------- */
function startLayerCreation(type) {
    saveState(); // Сохраняем состояние перед созданием нового слоя

    // Проверяем, есть ли уже кроп (только для типа 'crop')
    if (type === 'crop' && layers.some(l => l.type === 'crop')) {
        // Активируем существующий кроп для редактирования
        activeLayer = layers.find(l => l.type === 'crop');
        render();
        updateLayersList(); // Обновляем список слоев
        return;
    }

    currentTool = type;
    activeLayer = null;

    // Снимаем активность со всех кнопок
    document.querySelectorAll('.toolbar button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Активируем текущую кнопку
    const activeBtn = {
        'crop': cropBtn,
        'blur': blurBtn,
        'highlight': highlightBtn,
        'line': lineBtn,
        'text': textBtn
    }[currentTool];
    if (activeBtn) activeBtn.classList.add('active');

    // Удаляем старый кроп, если есть (только при начале создания нового)
    if (currentTool === 'crop') {
        layers = layers.filter(l => l.type !== 'crop');
        selectionOverlay.classList.add('crop-mode');
    } else {
        selectionOverlay.classList.remove('crop-mode');
    }

    blurRadiusLabel.style.display = type === 'blur' ? 'flex' : 'none';
    highlightColorLabel.style.display = (type === 'highlight' || type === 'line') ? 'flex' : 'none';
    textColorLabel.style.display = type === 'text' ? 'flex' : 'none';
    textSizeLabel.style.display = type === 'text' ? 'flex' : 'none';
    formatLabel.style.display = 'flex';
    qualityLabel.style.display = formatSelect.value !== 'png' ? 'flex' : 'none';
    toolSettings.style.display = 'flex';

    selectionOverlay.style.display = 'block';
    selectionOverlay.style.left = '0';
    selectionOverlay.style.top = '0';
    selectionOverlay.style.width = `${canvas.width}px`;
    selectionOverlay.style.height = `${canvas.height}px`;
    selectionOverlay.className = '';
    selectionOverlay.style.cursor = 'crosshair';
}

/* ---------- ОБРАБОТЧИКИ МЫШИ ---------- */
function onMouseDown(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);



    let hit = null;
    for (const l of layers) {
        if (l.rect &&
            x >= l.rect.x && x <= l.rect.x + l.rect.width &&
            y >= l.rect.y && y <= l.rect.y + l.rect.height) { hit = l; break; }
        if (l.points) {
            const d1 = Math.hypot(x - l.points.x1, y - l.points.y1);
            const d2 = Math.hypot(x - l.points.x2, y - l.points.y2);
            if (d1 < 10 || d2 < 10) { hit = l; break; }
        }
    }

    // Проверка на двойной клик по текстовому слою
    if (e.detail === 2 && hit && hit.type === 'text') {
        e.preventDefault();
        const newText = prompt('Введите текст:', hit.params.text || '');
        if (newText !== null) {
            saveState();
            hit.params.text = newText;
            render();
            updateLayersList(); // Обновляем список слоев после изменения текста
        }
        return;
    }

    /* проверка попадания в ручку */
    let handleHit = null;
    if (hit?.rect) {
        for (const h of HANDLES) {
            const [dx, dy] = {
                nw: [-1, -1], n: [0, -1], ne: [1, -1], w: [-1, 0], e: [1, 0],
                sw: [-1, 1], s: [0, 1], se: [1, 1]
            }[h];

            // Координаты центра ручки
            const centerX = hit.rect.x + hit.rect.width * (dx + 1) / 2;
            const centerY = hit.rect.y + hit.rect.height * (dy + 1) / 2;

            // Область попадания
            const hitSize = 16; // HANDLE_SIZE
            const hitX = centerX - hitSize / 2;
            const hitY = centerY - hitSize / 2;

            if (x >= hitX && x <= hitX + hitSize &&
                y >= hitY && y <= hitY + hitSize) {
                handleHit = h;
                break;
            }
        }
    }

    if (handleHit) {
        activeLayer = hit;
        dragState = { start: { x, y }, layer: hit, handle: handleHit, orig: { ...hit.rect } };
        selectionOverlay.className = `resize-${handleHit}`;
        updateLayersList(); // Обновляем список слоев после выбора слоя
        return;
    }

    if (hit) {
        activeLayer = hit;
        const isRect = !!hit.rect;
        dragState = {
            start: { x, y }, layer: hit, handle: 'move',
            orig: isRect ? { ...hit.rect } : { ...hit.points }
        };
        selectionOverlay.className = 'move';
        selectionOverlay.style.cursor = 'move';
        updateLayersList(); // Обновляем список слоев после выбора слоя
        return;
    }

    // Блокируем взаимодействие с другими инструментами при активном кропе
    const cropLayer = layers.find(l => l.type === 'crop');
    if (currentTool !== 'crop' && cropLayer && hit?.type === 'crop') {
        return;
    }

    /* создание нового слоя */
    switch (currentTool) {
        case 'crop':
            // Если уже есть кроп - не создаем новый
            if (layers.some(l => l.type === 'crop')) return;

            activeLayer = {
                type: 'crop',
                rect: { x, y, width: 0, height: 0 },
                params: {}
            };
            dragState = {
                start: { x, y },
                layer: activeLayer,
                handle: 'create',
                orig: { x, y, width: 0, height: 0 }
            };
            layers.push(activeLayer);
            break;
        case 'blur':
        case 'highlight':
            activeLayer = {
                type: currentTool,
                rect: { x, y, width: 0, height: 0 },
                params: currentTool === 'blur' ? { radius: +blurRadiusInput.value } :
                    { color: highlightColorInput.value }
            };
            dragState = {
                start: { x, y },
                layer: activeLayer,
                handle: 'create',
                orig: { x, y, width: 0, height: 0 }
            };
            layers.push(activeLayer);
            break;
        case 'line':
            activeLayer = {
                type: 'line',
                points: { x1: x, y1: y, x2: x, y2: y, color: highlightColorInput.value }
            };
            dragState = { start: { x, y }, layer: activeLayer, handle: 'x2', orig: { x1: x, y1: y, x2: x, y2: y } };
            layers.push(activeLayer);
            break;
        case 'text':
            activeLayer = {
                type: 'text',
                rect: { x, y, width: 200, height: 50 },
                params: {
                    text: 'Текст',
                    color: textColorInput.value,
                    fontSize: +textSizeInput.value
                }
            };
            dragState = {
                start: { x, y },
                layer: activeLayer,
                handle: 'create',
                orig: { x, y, width: 200, height: 50 }
            };
            layers.push(activeLayer);
            break;
    }
    updateLayersList(); // Обновляем список слоев после создания нового
}

function onMouseMove(e) {
    if (!dragState) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);

    const { handle, layer, start, orig } = dragState;

    if (handle === 'create') {
        // Создание новой области - учитываем любое направление
        const newX = Math.min(start.x, x);
        const newY = Math.min(start.y, y);
        const newWidth = Math.abs(x - start.x);
        const newHeight = Math.abs(y - start.y);

        // Применяем ограничения
        layer.rect.x = Math.max(0, newX);
        layer.rect.y = Math.max(0, newY);
        layer.rect.width = Math.max(10, Math.min(canvas.width - layer.rect.x, newWidth));
        layer.rect.height = Math.max(10, Math.min(canvas.height - layer.rect.y, newHeight));
    }
    else if (handle === 'move') {
        if (layer.rect) {
            const dx = x - start.x;
            const dy = y - start.y;
            layer.rect.x = Math.max(0, Math.min(canvas.width - orig.width, orig.x + dx));
            layer.rect.y = Math.max(0, Math.min(canvas.height - orig.height, orig.y + dy));
        } else if (layer.points) {
            const dx = x - start.x;
            const dy = y - start.y;
            layer.points.x1 = Math.max(0, Math.min(canvas.width, orig.x1 + dx));
            layer.points.y1 = Math.max(0, Math.min(canvas.height, orig.y1 + dy));
            layer.points.x2 = Math.max(0, Math.min(canvas.width, orig.x2 + dx));
            layer.points.y2 = Math.max(0, Math.min(canvas.height, orig.y2 + dy));
        }
    }
    else if (layer.rect) {
        updateRectFromHandle(handle, layer, start, x, y);
    }
    else if (layer.points) {
        layer.points.x2 = x;
        layer.points.y2 = y;
    }
    render();
}

function onMouseUp() {
    if (dragState) {
        saveState(); // Сохраняем состояние после завершения перемещения/изменения
    }
    dragState = null;
    selectionOverlay.className = '';
    render();
}

function onHover(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);

    let cls = '';

    /* ручки */
    for (const l of layers) {
        if (!l.rect) continue;

        for (const h of HANDLES) {
            const [dx, dy] = {
                nw: [-1, -1], n: [0, -1], ne: [1, -1], w: [-1, 0], e: [1, 0], sw: [-1, 1], s: [0, 1], se: [1, 1]
            }[h];

            // Координаты центра ручки
            const centerX = l.rect.x + l.rect.width * (dx + 1) / 2;
            const centerY = l.rect.y + l.rect.height * (dy + 1) / 2;

            // Область попадания (увеличим для лучшего UX)
            const hitSize = 16; // HANDLE_SIZE
            const hitX = centerX - hitSize / 2;
            const hitY = centerY - hitSize / 2;

            if (x >= hitX && x <= hitX + hitSize &&
                y >= hitY && y <= hitY + hitSize) {
                cls = `resize-${h}`;
                break;
            }
        }
        if (cls) break;
    }
    selectionOverlay.className = cls;
}

/* ---------- ОБНОВЛЕНИЕ RECT ПРИ РЕСАЙЗЕ ---------- */
function updateRectFromHandle(handle, layer, start, x, y) {
    if (!dragState) return;
    saveState(); // Сохраняем состояние перед изменением размера

    const { orig } = dragState;
    const dx = x - start.x;
    const dy = y - start.y;
    const MIN_SIZE = 10;

    let nx = orig.x, ny = orig.y, nw = orig.width, nh = orig.height;

    // Рассчитываем новые параметры в зависимости от ручки
    switch (handle) {
        case 'se':
            nw = orig.width + dx;
            nh = orig.height + dy;
            break;
        case 'sw':
            nw = orig.width - dx;
            nh = orig.height + dy;
            nx = orig.x + dx;
            break;
        case 'ne':
            nw = orig.width + dx;
            nh = orig.height - dy;
            ny = orig.y + dy;
            break;
        case 'nw':
            nw = orig.width - dx;
            nh = orig.height - dy;
            nx = orig.x + dx;
            ny = orig.y + dy;
            break;
        case 'n':
            nh = orig.height - dy;
            ny = orig.y + dy;
            break;
        case 's':
            nh = orig.height + dy;
            break;
        case 'w':
            nw = orig.width - dx;
            nx = orig.x + dx;
            break;
        case 'e':
            nw = orig.width + dx;
            break;
    }

    // Применяем ограничения для каждой ручки
    if (handle.includes('w')) {
        const maxX = orig.x + orig.width;
        nx = Math.min(maxX - MIN_SIZE, nx);
        nx = Math.max(0, nx);
        nw = maxX - nx;
    }
    else if (handle.includes('e')) {
        nw = Math.max(MIN_SIZE, Math.min(canvas.width - orig.x, nw));
    }

    if (handle.includes('n')) {
        const maxY = orig.y + orig.height;
        ny = Math.min(maxY - MIN_SIZE, ny);
        ny = Math.max(0, ny);
        nh = maxY - ny;
    }
    else if (handle.includes('s')) {
        nh = Math.max(MIN_SIZE, Math.min(canvas.height - orig.y, nh));
    }

    // Применяем изменения
    layer.rect.x = nx;
    layer.rect.y = ny;
    layer.rect.width = nw;
    layer.rect.height = nh;
}

/* ---------- РЕНДЕР ---------- */
function render() {
    if (!image) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    layers.forEach(l => {
        if (l.type === 'blur' && l.rect) {
            ctx.save();
            ctx.filter = `blur(${l.params.radius}px)`;
            ctx.drawImage(image,
                l.rect.x * dpr, l.rect.y * dpr, l.rect.width * dpr, l.rect.height * dpr,
                l.rect.x, l.rect.y, l.rect.width, l.rect.height);
            ctx.restore();
        }
        if (l.type === 'highlight' && l.rect) {
            ctx.strokeStyle = l.params.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(l.rect.x, l.rect.y, l.rect.width, l.rect.height);
        }
        if (l.type === 'line' && l.points) {
            const { x1, y1, x2, y2, color } = l.points;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            const ang = Math.atan2(y2 - y1, x2 - x1);
            const arr = 10;
            ctx.lineTo(x2 - arr * Math.cos(ang - Math.PI / 6), y2 - arr * Math.sin(ang - Math.PI / 6));
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - arr * Math.cos(ang + Math.PI / 6), y2 - arr * Math.sin(ang + Math.PI / 6));
            ctx.stroke();
        }
        if (l.type === 'text' && l.rect) {
            ctx.save();
            ctx.fillStyle = l.params.color;
            ctx.font = `${l.params.fontSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            // ctx.fillText(l.params.text, l.rect.x, l.rect.y);
            wrapText(ctx, l.params.text, l.rect.x, l.rect.y, l.rect.width, l.params.fontSize);

            ctx.restore();
        }
        if (l.type === 'text' && l.rect) {
            ctx.save();
            ctx.fillStyle = l.params.color;
            ctx.font = `${l.params.fontSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            // Используем новую функцию wrapTextInRect, которая учитывает ширину и высоту области
            wrapTextInRect(ctx, l.params.text, l.rect.x, l.rect.y, l.rect.width, l.rect.height, l.params.fontSize);
            ctx.restore();
        }
    });

    // Всегда показываем область кропа с затемнением, если такой слой есть
    const cropLayer = layers.find(l => l.type === 'crop');
    if (cropLayer) {
        // Затемняем область вне кропа
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';

        // Верхняя полоса
        ctx.fillRect(0, 0, canvas.width, cropLayer.rect.y);
        // Нижняя полоса
        ctx.fillRect(0, cropLayer.rect.y + cropLayer.rect.height,
            canvas.width, canvas.height - cropLayer.rect.y - cropLayer.rect.height);
        // Левая полоса
        ctx.fillRect(0, cropLayer.rect.y,
            cropLayer.rect.x, cropLayer.rect.height);
        // Правая полоса
        ctx.fillRect(cropLayer.rect.x + cropLayer.rect.width, cropLayer.rect.y,
            canvas.width - cropLayer.rect.x - cropLayer.rect.width, cropLayer.rect.height);

        ctx.restore();

        // Рисуем границу области кропа
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropLayer.rect.x, cropLayer.rect.y,
            cropLayer.rect.width, cropLayer.rect.height);

        // Отображаем размеры
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.fillText(
            `${formatSize(cropLayer.rect.width)} × ${formatSize(cropLayer.rect.height)}`,
            cropLayer.rect.x + 10,
            cropLayer.rect.y + 20
        );
    }

    // Рендерим ручки активного слоя
    if (activeLayer && activeLayer.rect) {
        drawHandles(ctx, activeLayer.rect);
    }
}

/* ---------- РИСОВАНИЕ РУЧЕК ---------- */
function drawHandles(ctx, rect) {
    if (!ctx || typeof ctx.save !== 'function') return;

    ctx.save();
    ctx.fillStyle = '#0096ff';

    // Учитываем devicePixelRatio при отрисовке ручек
    const handleSize = HANDLE_SIZE * dpr;

    HANDLES.forEach(h => {
        const [dx, dy] = {
            nw: [-1, -1], n: [0, -1], ne: [1, -1], w: [-1, 0], e: [1, 0],
            sw: [-1, 1], s: [0, 1], se: [1, 1]
        }[h];

        // Координаты центра ручки
        const centerX = rect.x + rect.width * (dx + 1) / 2;
        const centerY = rect.y + rect.height * (dy + 1) / 2;

        // Позиция ручки (центрированная)
        const hx = centerX - HANDLE_SIZE / 2;
        const hy = centerY - HANDLE_SIZE / 2;

        ctx.fillRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE);
    });
    ctx.restore();
}

/* ---------- СОХРАНЕНИЕ / ОТМЕНА ---------- */
function saveState() {
    // Сохраняем текущее состояние canvas и слоев
    historyStack.push({
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        layers: JSON.parse(JSON.stringify(layers)) // Глубокая копия слоев
    });

    // Ограничиваем размер истории (последние 20 действий)
    if (historyStack.length > 20) {
        historyStack.shift();
    }
}

function undoLastAction() {
    if (!historyStack.length) return;

    const lastState = historyStack.pop();

    // Восстанавливаем изображение
    ctx.putImageData(lastState.imageData, 0, 0);

    // Восстанавливаем слои
    layers = JSON.parse(JSON.stringify(lastState.layers));

    // Обновляем активный слой
    activeLayer = layers.length > 0 ? layers[layers.length - 1] : null;

    // Перерисовываем
    render();
}

function updateBlurRadius() { }   // значение берётся при рендере

function updateHighlightColor() { }

/* ---------- ДОБАВЛЯЕМ CSS-ПОДСВЕТКУ ДЛЯ РУЧЕК ---------- */
const style = document.createElement('style');
style.innerHTML = `
.layer-item.dragging {
    opacity: 0.5;
    background-color: #060505ff;
}
`;

function saveImage() {
    if (!image) return;

    const cropLayer = layers.find(l => l.type === 'crop');
    let x = 0, y = 0, width = canvas.width, height = canvas.height;

    if (cropLayer) {
        x = Math.max(0, Math.round(cropLayer.rect.x));
        y = Math.max(0, Math.round(cropLayer.rect.y));
        width = Math.min(Math.round(cropLayer.rect.width), canvas.width - x);
        height = Math.min(Math.round(cropLayer.rect.height), canvas.height - y);

        // Дополнительная проверка на минимальный размер
        if (width <= 0 || height <= 0) {
            width = canvas.width;
            height = canvas.height;
        }
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Копируем основное изображение с учетом DPR
    tempCtx.drawImage(
        image,
        x * dpr, y * dpr, width * dpr, height * dpr,
        0, 0, width, height
    );

    // Применяем эффекты (blur, highlight)
    layers.filter(l => l.type !== 'crop').forEach(layer => {
        if (!layer.rect) return;

        const layerX = layer.rect.x - x;
        const layerY = layer.rect.y - y;

        // Пропускаем слои вне области кропа
        if (layerX + layer.rect.width < 0 || layerY + layer.rect.height < 0 ||
            layerX > width || layerY > height) return;

        if (layer.type === 'blur') {
            tempCtx.save();
            tempCtx.filter = `blur(${layer.params.radius}px)`;
            tempCtx.drawImage(
                image,
                layer.rect.x * dpr, layer.rect.y * dpr,
                layer.rect.width * dpr, layer.rect.height * dpr,
                Math.max(0, layerX), Math.max(0, layerY),
                Math.min(layer.rect.width, width - layerX),
                Math.min(layer.rect.height, height - layerY)
            );
            tempCtx.restore();
        }
        else if (layer.type === 'highlight') {
            tempCtx.strokeStyle = layer.params.color;
            tempCtx.lineWidth = 2;
            tempCtx.strokeRect(
                Math.max(0, layerX),
                Math.max(0, layerY),
                Math.min(layer.rect.width, width - layerX),
                Math.min(layer.rect.height, height - layerY)
            );
        }
        else if (layer.type === 'text') {
            tempCtx.save();
            tempCtx.fillStyle = layer.params.color;
            tempCtx.font = `${layer.params.fontSize}px Arial`;
            tempCtx.textAlign = 'left';
            tempCtx.textBaseline = 'top';
            const layerXInCrop = layer.rect.x - x;
            const layerYInCrop = layer.rect.y - y;
            wrapTextInRect(tempCtx, layer.params.text, layerXInCrop, layerYInCrop, layer.rect.width, layer.rect.height, layer.params.fontSize);
            tempCtx.restore();
        }
    });

    // Сохраняем изображение
    const format = formatSelect.value;
    const quality = parseFloat(qualityRange.value);

    tempCanvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T-]/g, '_');
        a.download = `edited_${ts}.${format}`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
    }, `image/${format}`, quality);
}

function formatSize(value) {
    return Math.round(value * 10) / 10; // Округляем до 1 знака после запятой
}

function wrapTextInRect(context, text, x, y, maxWidth, maxHeight, fontSize) {
    if (!text || maxWidth <= 0 || maxHeight <= 0) return; // Проверяем на валидность

    const words = text.split(' ');
    let line = '';
    let currentY = y;
    const lineHeight = fontSize * 1.2;

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;

        // Проверяем, помещается ли строка по ширине
        if (testWidth > maxWidth && i > 0) {
            // Проверяем, помещается ли строка по высоте
            if (currentY + lineHeight > y + maxHeight) {
                // Если не помещается, рисуем многоточие в предыдущей строке
                if (line.trim() !== '') {
                    // Обрезаем строку, добавляем ...
                    let truncatedLine = line.trim();
                    let lastSpaceIndex = truncatedLine.lastIndexOf(' ');
                    while (context.measureText(truncatedLine + '...').width > maxWidth && lastSpaceIndex > 0) {
                         truncatedLine = truncatedLine.substring(0, lastSpaceIndex);
                         lastSpaceIndex = truncatedLine.lastIndexOf(' ');
                    }
                    context.fillText(truncatedLine + '...', x, currentY);
                }
                return; // Выходим, если высота превышена
            }
            // Рисуем текущую строку
            context.fillText(line, x, currentY);
            // Начинаем новую строку
            line = words[i] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }

    // Проверяем, помещается ли последняя строка по высоте
    if (currentY + lineHeight <= y + maxHeight) {
        context.fillText(line, x, currentY);
    } else {
        // Если последняя строка не помещается, обрезаем её
        let truncatedLine = line.trim();
        let lastSpaceIndex = truncatedLine.lastIndexOf(' ');
        while (context.measureText(truncatedLine + '...').width > maxWidth && lastSpaceIndex > 0) {
             truncatedLine = truncatedLine.substring(0, lastSpaceIndex);
             lastSpaceIndex = truncatedLine.lastIndexOf(' ');
        }
        context.fillText(truncatedLine + '...', x, currentY);
    }
}

// Старая функция wrapText остается для совместимости, если используется где-то еще
function wrapText(context, text, x, y, maxWidth, fontSize) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && i > 0) {
            context.fillText(line, x, currentY);
            line = words[i] + ' ';
            currentY += fontSize * 1.2; // Интервал между строками
        } else {
            line = testLine;
        }
    }
    context.fillText(line, x, currentY);
}

document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', init);