(function() {
  // Удаляем старый оверлей если есть
  const oldOverlay = document.getElementById('screenshot-overlay');
  if (oldOverlay) oldOverlay.remove();

  // Создаем элементы
  const overlay = document.createElement('div');
  overlay.id = 'screenshot-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483647;
    cursor: crosshair;
    background: rgba(0,0,0,0.4);
  `;

  const selection = document.createElement('div');
  selection.id = 'screenshot-selection';
  selection.style.cssText = `
    position: absolute;
    border: 2px dashed #fff;
    background: rgba(255,255,255,0.1);
    display: none;
    pointer-events: none;
  `;
  overlay.appendChild(selection);
  document.body.appendChild(overlay);

  // Состояние выделения
  let isSelecting = false;
  let startX, startY;

  // Обработчики событий
  function startSelection(e) {
    if (e.button !== 0) return;
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    selection.style.left = `${startX}px`;
    selection.style.top = `${startY}px`;
    selection.style.width = '0';
    selection.style.height = '0';
    selection.style.display = 'block';
  }

  function updateSelection(e) {
    if (!isSelecting) return;

    const left = Math.min(startX, e.clientX);
    const top = Math.min(startY, e.clientY);
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);

    selection.style.left = `${left}px`;
    selection.style.top = `${top}px`;
    selection.style.width = `${width}px`;
    selection.style.height = `${height}px`;
  }

  async function endSelection() {
    if (!isSelecting) return;
    isSelecting = false;

    const width = parseInt(selection.style.width);
    const height = parseInt(selection.style.height);

    if (width < 10 || height < 10) {
      cleanup();
      return;
    }

    try {
      const rect = selection.getBoundingClientRect();
      await chrome.runtime.sendMessage({
        action: "processAreaCapture",
        coordinates: {
            x: Math.round(rect.left) + 2,
            y: Math.round(rect.top) + 2,
            width: Math.round(rect.width) - 4,
            height: Math.round(rect.height) - 4
        }
      });
    } catch (error) {
      console.error('Capture error:', error);
    } finally {
      cleanup();
    }
  }

  function cancelSelection(e) {
    if (e.key === 'Escape') cleanup();
  }

  function cleanup() {
    document.removeEventListener('mousemove', updateSelection);
    document.removeEventListener('mouseup', endSelection);
    document.removeEventListener('keydown', cancelSelection);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  // Инициализация
  overlay.addEventListener('mousedown', startSelection);
  document.addEventListener('mousemove', updateSelection);
  document.addEventListener('mouseup', endSelection);
  document.addEventListener('keydown', cancelSelection);
})();