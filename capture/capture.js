const overlay = document.querySelector('.overlay');
const selectionArea = document.querySelector('.selection-area');
const cancelBtn = document.getElementById('cancel');
const captureBtn = document.getElementById('capture');

let selection = {
  isActive: false,
  start: { x: 0, y: 0 },
  current: { x: 0, y: 0 }
};

async function init() {
  try {
    // Получаем текущий скриншот
    const window = await new Promise(resolve =>
      chrome.windows.getCurrent(resolve)
    );

    const dataUrl = await new Promise(resolve =>
      chrome.tabs.captureVisibleTab(window.id, { format: 'png' }, resolve)
    );

    overlay.style.backgroundImage = `url(${dataUrl})`;
    setupEventListeners();
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    alert(`Ошибка: ${error.message}`);
    window.close();
  }
}

function setupEventListeners() {
  overlay.addEventListener('mousedown', startSelection);
  document.addEventListener('mousemove', updateSelection);
  document.addEventListener('mouseup', endSelection);
  cancelBtn.addEventListener('click', () => window.close());
  captureBtn.addEventListener('click', processSelection);
  captureBtn.disabled = true;
}

function startSelection(e) {
  selection = {
    isActive: true,
    start: { x: e.clientX, y: e.clientY },
    current: { x: e.clientX, y: e.clientY }
  };
  updateSelectionDisplay();
}

function updateSelection(e) {
  if (!selection.isActive) return;
  selection.current = { x: e.clientX, y: e.clientY };
  updateSelectionDisplay();
}

function endSelection() {
  if (!selection.isActive) return;
  selection.isActive = false;
  captureBtn.disabled = getSelectionSize().width < 10 || getSelectionSize().height < 10;
}

function updateSelectionDisplay() {
  const { x, y } = getSelectionPosition();
  const { width, height } = getSelectionSize();

  selectionArea.style.left = `${x}px`;
  selectionArea.style.top = `${y}px`;
  selectionArea.style.width = `${width}px`;
  selectionArea.style.height = `${height}px`;
  selectionArea.style.display = 'block';
}

function getSelectionPosition() {
  return {
    x: Math.min(selection.start.x, selection.current.x),
    y: Math.min(selection.start.y, selection.current.y)
  };
}

function getSelectionSize() {
  return {
    width: Math.abs(selection.current.x - selection.start.x),
    height: Math.abs(selection.current.y - selection.start.y)
  };
}

async function processSelection() {
  try {
    const window = await new Promise(resolve =>
      chrome.windows.getCurrent(resolve)
    );

    const dataUrl = await new Promise(resolve =>
      chrome.tabs.captureVisibleTab(window.id, { format: 'png' }, resolve)
    );

    const img = await loadImage(dataUrl);
    const croppedUrl = await cropImage(img, {
      ...getSelectionPosition(),
      ...getSelectionSize()
    });

    await chrome.downloads.download({
      url: croppedUrl,
      filename: `screenshot_area_${getTimestamp()}.png`,
      saveAs: true
    });

    window.close();
  } catch (error) {
    console.error('Ошибка обработки:', error);
    alert(`Ошибка: ${error.message}`);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
    img.src = src;
  });
}

function cropImage(img, { x, y, width, height }) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    resolve(canvas.toDataURL('image/png'));
  });
}

function getTimestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T-]/g, '_');
}

document.addEventListener('DOMContentLoaded', init);