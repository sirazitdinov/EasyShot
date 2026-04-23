/**
 * Обертывает текст в прямоугольник с учетом максимальной ширины и высоты.
 * @param {CanvasRenderingContext2D} context - Контекст 2D для рисования
 * @param {string} text - Текст для обертывания
 * @param {number} x - Координата x начала текста
 * @param {number} y - Координата y начала текста
 * @param {number} maxWidth - Максимальная ширина текста
 * @param {number} maxHeight - Максимальная высота текста
 * @param {number} fontSize - Размер шрифта
 */
export function wrapTextInRect(context, text, x, y, maxWidth, maxHeight, fontSize) {
  if (!text || maxWidth <= 0 || maxHeight <= 0) return;

  try {
    const lineHeight = fontSize * 1.2;
    let currentY = y;

    const paragraphs = text.split('\n');

    for (let p = 0; p < paragraphs.length; p++) {
      const paragraph = paragraphs[p];

      if (paragraph === '') {
        if (currentY + lineHeight <= y + maxHeight) {
          currentY += lineHeight;
        }
        continue;
      }

      const words = paragraph.split(' ');
      let line = '';

      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && i > 0) {
          if (currentY + lineHeight > y + maxHeight) return;
          context.fillText(line.trim(), x, currentY);
          line = words[i] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }

      if (line.trim() !== '') {
        if (currentY + lineHeight > y + maxHeight) return;
        context.fillText(line.trim(), x, currentY);
        currentY += lineHeight;
      }
    }
  } catch (error) {
    console.error('Error in wrapTextInRect:', error);
  }
}

/**
 * Форматирует размер файла в удобочитаемый формат.
 * @param {number} bytes - Размер файла в байтах
 * @returns {string} - Форматированный размер файла
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  try {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  } catch (error) {
    console.error('Error in formatFileSize:', error);
    return 'Unknown Size';
  }
}
