const fileInput = document.getElementById('fileInput');
const cropBtn = document.getElementById('cropBtn');
const blurBtn = document.getElementById('blurBtn');
const highlightBtn = document.getElementById('highlightBtn');
const lineBtn = document.getElementById('lineBtn');
const saveBtn = document.getElementById('saveBtn');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const selectionOverlay = document.getElementById('selectionOverlay');
const formatSelect = document.getElementById('formatSelect');
const qualityRange = document.getElementById('qualityRange');
const qualityValue = document.getElementById('qualityValue');

/* ---------- ПЕРЕМЕННЫЕ ---------- */
let layers = [];          // {type, rect, params}
let activeLayer = null;        // текущий слой
let dragState = null;        // {start, layer, handle, orig}
const undoBtn = document.getElementById('undoBtn');
const toolSettings = document.getElementById('toolSettings');
const blurRadiusInput = document.getElementById('blurRadius');
const highlightColorInput = document.getElementById('highlightColor');
const blurRadiusLabel = document.getElementById('blurRadiusLabel');
const highlightColorLabel = document.getElementById('highlightColorLabel');
let historyStack = [];

/* ---------- НОВЫЙ РАЗМЕР РУЧЕК ---------- */
const HANDLE_SIZE = 8;        // было 6 – стало 12
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

let image = null;
const dpr = window.devicePixelRatio || 1;
let currentTool = null;
let originalImageData = null;

/* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */
function init() {
    undoBtn.addEventListener('click', undoLastAction);
    blurRadiusInput.addEventListener('input', debounce(() => {
        if (currentTool === 'blur') updateBlurRadius();
    }, 150));
    highlightColorInput.addEventListener('input', updateHighlightColor);
    fileInput.addEventListener('change', handleFileSelect);

    cropBtn.addEventListener('click', () => startLayerCreation('crop'));
    blurBtn.addEventListener('click', () => startLayerCreation('blur'));
    highlightBtn.addEventListener('click', () => startLayerCreation('highlight'));
    lineBtn.addEventListener('click', () => startLayerCreation('line'));
    saveBtn.addEventListener('click', saveImage);

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
        }
    });

    setToolsDisabled(true);
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
        const url = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = () => rej(new Error('File reading failed'));
            r.readAsDataURL(file);
        });
        await loadImage(url);
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
            adjustEditorSize();
            originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            res();
        };
        image.src = src;
    });
}
function adjustEditorSize() {
    const c = document.querySelector('.container');
    c.style.width = `${canvas.width + 40}px`;
    c.style.height = `${canvas.height + 100}px`;
}
function resetSelection() {
    activeLayer = null;
    render();
}

/* ---------- РАБОТА СО СЛОЯМИ ---------- */
function startLayerCreation(type) {
    // Проверяем, есть ли уже кроп (только для типа 'crop')
    if (type === 'crop' && layers.some(l => l.type === 'crop')) {
        // Активируем существующий кроп для редактирования
        activeLayer = layers.find(l => l.type === 'crop');
        render();
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
        'line': lineBtn
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
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

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

    /* проверка попадания в ручку */
    let handleHit = null;
    if (hit?.rect) {
        for (const h of HANDLES) {
            const [dx, dy] = {
                nw: [-1, -1], n: [0, -1], ne: [1, -1], w: [-1, 0], e: [1, 0], sw: [-1, 1], s: [0, 1], se: [1, 1]
            }[h];
            const hx = hit.rect.x + hit.rect.width * (dx + 1) / 2 - HANDLE_SIZE / 2;
            const hy = hit.rect.y + hit.rect.height * (dy + 1) / 2 - HANDLE_SIZE / 2;
            if (x >= hx && x <= hx + HANDLE_SIZE && y >= hy && y <= hy + HANDLE_SIZE) {
                handleHit = h;
                break;
            }
        }
    }

    if (handleHit) {
        activeLayer = hit;
        dragState = { start: { x, y }, layer: hit, handle: handleHit, orig: { ...hit.rect } };
        selectionOverlay.className = `resize-${handleHit}`;
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
    }
}

function onMouseMove(e) {
    if (!dragState) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

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
    dragState = null;
    selectionOverlay.className = '';
    render();
}

function onHover(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let cls = '';

    /* ручки */
    for (const l of layers) {
        if (!l.rect) continue;
        for (const h of HANDLES) {
            const [dx, dy] = {
                nw: [-1, -1], n: [0, -1], ne: [1, -1], w: [-1, 0], e: [1, 0], sw: [-1, 1], s: [0, 1], se: [1, 1]
            }[h];
            const hx = l.rect.x + l.rect.width * (dx + 1) / 2 - HANDLE_SIZE / 2;
            const hy = l.rect.y + l.rect.height * (dy + 1) / 2 - HANDLE_SIZE / 2;
            if (x >= hx && x <= hx + HANDLE_SIZE && y >= hy && y <= hy + HANDLE_SIZE) {
                cls = `resize-${h}`;
                break;
            }
        }
    }
    selectionOverlay.className = cls;
}

/* ---------- ОБНОВЛЕНИЕ RECT ПРИ РЕСАЙЗЕ ---------- */
function updateRectFromHandle(handle, layer, start, x, y) {
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
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            const ang = Math.atan2(y2 - y1, x2 - x1);
            const arr = 10;
            ctx.lineTo(x2 - arr * Math.cos(ang - Math.PI / 6), y2 - arr * Math.sin(ang - Math.PI / 6));
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - arr * Math.cos(ang + Math.PI / 6), y2 - arr * Math.sin(ang + Math.PI / 6));
            ctx.stroke();
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
    HANDLES.forEach(h => {
        const [dx, dy] = {
            nw: [-1, -1], n: [0, -1], ne: [1, -1], w: [-1, 0], e: [1, 0],
            sw: [-1, 1], s: [0, 1], se: [1, 1]
        }[h];
        const hx = rect.x + rect.width * (dx + 1) / 2 - HANDLE_SIZE / 2;
        const hy = rect.y + rect.height * (dy + 1) / 2 - HANDLE_SIZE / 2;
        ctx.fillRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE);
    });
    ctx.restore();
}

/* ---------- СОХРАНЕНИЕ / ОТМЕНА ---------- */
function saveState() { historyStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); }

function undoLastAction() {
    if (!historyStack.length) return;
    const s = historyStack.pop();
    canvas.width = s.width; canvas.height = s.height;
    ctx.putImageData(s, 0, 0); adjustEditorSize();
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function updateBlurRadius() { }   // значение берётся при рендере

function updateHighlightColor() { }

/* ---------- ДОБАВЛЯЕМ CSS-ПОДСВЕТКУ ДЛЯ РУЧЕК ---------- */
const style = document.createElement('style');
style.innerHTML = `
.resize-nw, .resize-n, .resize-ne, .resize-w,
.resize-e, .resize-sw, .resize-s, .resize-se {
    cursor: pointer !important;
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

document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', init);