// Tools/CropTool.js
import BaseTool from './BaseTool.js';
import Helper from '../Helper.js';

export default class CropTool extends BaseTool {
  constructor(editor, settings = {}) {
    // name и supportsCreation задаём через options, как для других инструментов
    super(editor, settings, 'crop', { supportsCreation: true });
  }

  activate() {
    super.activate();

    // Синхронизируем currentLayer с активным crop-слоем в редакторе
    // Ищем именно crop-слой среди всех слоёв, а не просто активный слой
    const cropLayer = this.editor.layerManager?.layers?.find(l => l.type === 'crop');
    this.currentLayer = cropLayer || null;

    // updateOverlay() вызывается в EditorCore.activateTool() после activate()
    this.editor.updateToolbarButtons?.();
  }

  deactivate() {
    super.deactivate();
  }

  getUISettingsConfig() {
    return {
      fields: []
    };
  }

  setupOverlay(overlayElement) {
    super.setupOverlay(overlayElement);
    if (!overlayElement) return;

    // overlayElement.classList.add('crop-mode');
    // overlayElement.style.cursor = 'crosshair';
    this.createPreviewElement('cropPreview', 'crop-mode');
  }

  cleanupOverlay() {
    if (this.overlay) {
      this.overlay.classList.remove('crop-mode');

      // ✅ Полностью сбрасываем все стили
      this.overlay.style.cursor = '';
      this.overlay.style.pointerEvents = 'auto'; // ✅ Возвращаем в исходное состояние для работы других инструментов
      this.overlay.style.display = '';
      this.overlay.style.left = '';
      this.overlay.style.top = '';
      this.overlay.style.width = '';
      this.overlay.style.height = '';
      this.overlay.style.position = 'absolute'; // Восстанавливаем исходное позиционирование
      this.overlay.style.border = '';
      this.overlay.style.backgroundColor = '';

      // ✅ Сбрасываем clip-path или другие трансформации
      this.overlay.style.clipPath = '';
      this.overlay.style.filter = '';
    }

    // Удаляем preview элемент, но не обнуляем this.overlay — он может понадобиться при следующем updateOverlay
    this.removePreviewElement();
    this.currentLayer = null;
  }

  updateOverlay() {
    if (!this.overlay) return;
    if (!this.currentLayer?.rect) return;

    const { x, y, width, height } = this.currentLayer.rect;
    const canvas = this.editor?.canvas;

    if (!canvas) return;

    // Используем единую утилиту для конвертации координат канваса в CSS-пиксели
    this.overlay.style.left = `${Helper.toCssPixels(x, canvas)}px`;
    this.overlay.style.top = `${Helper.toCssPixels(y, canvas)}px`;
    this.overlay.style.width = `${Helper.toCssPixels(width, canvas)}px`;
    this.overlay.style.height = `${Helper.toCssPixels(height, canvas)}px`;
  }

  cancelOperation() {
    super.cancelOperation();
    this.currentLayer = null;
  }

  updateSettingsUI() {
    // Crop не имеет настроек, кроме формата/качества — они показываются всегда при активном инструменте
  }

  applyToCroppedCanvas() {
    // Кроп не применяется к самому себе, этот метод не нужен
  }
}