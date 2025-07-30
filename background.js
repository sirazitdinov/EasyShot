// Проверка URL
function isUrlAllowed(url) {
  return url && !url.startsWith('chrome://') && !url.startsWith('about:');
}

// Основной обработчик
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleRequest = async () => {
    try {
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab) throw new Error('No active tab found');

      if (!isUrlAllowed(tab.url)) {
        throw new Error('Cannot capture this page');
      }

      switch (request.action) {
        case "captureFullScreen":
          const fullDataUrl = await captureVisibleTab();
          await saveImage(fullDataUrl);
          return { success: true };

        case "captureArea":
          await injectOverlayScript(tab.id);
          return { success: true };

        case "processAreaCapture":
          const croppedDataUrl = await processAreaCapture(request.coordinates);
          await saveImage(croppedDataUrl);
          return { success: true };

        case "openEditor":
          await openEditor();
          return { success: true };

        default:
          throw new Error(`Unknown action: ${request.action}`);
      }
    } catch (error) {
      console.error('Handler error:', error);
      return { success: false, error: error.message };
    }
  };

  handleRequest().then(sendResponse);
  return true;
});

// Захват видимой вкладки
async function captureVisibleTab() {
  return new Promise((resolve, reject) => {
    chrome.windows.getCurrent({populate: true}, (window) => {
      if (chrome.runtime.lastError || !window) {
        reject(new Error('Window not found'));
        return;
      }

      chrome.tabs.captureVisibleTab(
        window.id,
        {format: 'png'},
        (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            reject(new Error('Capture failed'));
            return;
          }
          resolve(dataUrl);
        }
      );
    });
  });
}

// Обработка выделенной области (теперь без использования Image)
async function processAreaCapture(coordinates) {
  return new Promise((resolve, reject) => {
    chrome.windows.getCurrent({populate: true}, (window) => {
      if (chrome.runtime.lastError || !window) {
        reject(new Error('Window not found'));
        return;
      }

      chrome.tabs.captureVisibleTab(
        window.id,
        {format: 'png'},
        (fullDataUrl) => {
          if (chrome.runtime.lastError || !fullDataUrl) {
            reject(new Error('Capture failed'));
            return;
          }

          // Отправляем данные в content script для обработки
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs[0]) {
              reject(new Error('No active tab'));
              return;
            }

            chrome.scripting.executeScript({
              target: {tabId: tabs[0].id},
              func: cropImage,
              args: [fullDataUrl, coordinates]
            }, (results) => {
              if (chrome.runtime.lastError || !results?.[0]?.result) {
                reject(new Error('Image processing failed'));
                return;
              }
              resolve(results[0].result);
            });
          });
        }
      );
    });
  });
}

// Сохранение изображения
async function saveImage(dataUrl) {
  return new Promise((resolve) => {
    chrome.downloads.download({
      url: dataUrl,
      filename: `screenshot_${Date.now()}.png`,
      saveAs: true
    }, () => resolve());
  });
}

// Внедрение скрипта оверлея
async function injectOverlayScript(tabId) {
  await chrome.scripting.executeScript({
    target: {tabId},
    files: ['content-scripts/overlay.js']
  });
}

// Открытие редактора
async function openEditor() {
  return new Promise((resolve) => {
    chrome.windows.create({
      url: chrome.runtime.getURL('editor/editor.html'),
      type: 'popup',
      width: 1000,
      height: 700,
      focused: true
    }, () => resolve());
  });
}

// Функция для выполнения в контексте страницы
function cropImage(fullDataUrl, coordinates) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = coordinates.width;
      canvas.height = coordinates.height;
      const ctx = canvas.getContext('2d');

      const dpr = window.devicePixelRatio || 1;
      ctx.drawImage(
        img,
        coordinates.x * dpr,
        coordinates.y * dpr,
        coordinates.width * dpr,
        coordinates.height * dpr,
        0,
        0,
        coordinates.width,
        coordinates.height
      );
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = fullDataUrl;
  });
}