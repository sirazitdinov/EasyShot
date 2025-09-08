async function handleAction(action) {
  try {
    const response = await chrome.runtime.sendMessage({action});

    if (!response?.success) {
      throw new Error(response?.error || 'Action failed');
    }

    if (action === "captureFullScreen" && response.imageUrl) {
      await chrome.runtime.sendMessage({
        action: "saveImage",
        dataUrl: response.imageUrl
      });
    }
  } catch (error) {
    console.error('Action error:', error);
    alert(`Error: ${error.message}`);
  }
}

function showError(message) {
  const errorEl = document.createElement('div');
  errorEl.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 10px;
    background: #ff4444;
    color: white;
    border-radius: 5px;
    z-index: 10000;
  `;
  errorEl.textContent = `Error: ${message}`;
  document.body.appendChild(errorEl);
  setTimeout(() => errorEl.remove(), 3000);
}

function getTimestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T-]/g, '_');
}

function resetCaptureState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const overlay = document.getElementById('screenshot-overlay');
        if (overlay) overlay.remove();
      }
    });
  });
}

document.getElementById('fullScreen').addEventListener('click', () => {
  handleAction("captureFullScreen");
});

document.getElementById('areaScreen').addEventListener('click', () => {
  resetCaptureState();
  handleAction("captureArea");
});

document.getElementById('openEditor').addEventListener('click', () => {
  handleAction("openEditor");
});

document.getElementById('rulerToggle').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: "toggleRuler"});
  });
  window.close(); // Закрываем popup после клика
});

// Обработка горячей клавиши
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-ruler") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: "toggleRuler"});
    });
  }
});