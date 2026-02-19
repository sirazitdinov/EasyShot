# Unit-тесты для редактора изображений

## Запуск тестов

```bash
# Запустить все тесты
npm test

# Запустить тесты в режиме watch (автоматический перезапуск при изменениях)
npm test -- --watch

# Запустить тесты с покрытием кода
npm test -- --coverage

# Запустить тесты с UI
npm test -- --ui
```

## Структура тестов

```
tests/
├── Helper.test.js              # Тесты утилит (deepMerge, конвертация координат)
├── HistoryManager.test.js      # Тесты истории (undo/redo, атомарные операции)
├── LayerManager.test.js        # Тесты менеджера слоёв
├── HighlightTool.test.js       # Тесты инструмента выделения (HighlightTool)
├── LineTool.test.js            # Тесты инструмента "Стрелка" (LineTool)
└── EditorCore.crop.test.js     # Тесты методов кропа (crop functionality)
```

## Покрытие тестами

### Helper.js (17 тестов)
- `deepMerge` — глубокое слияние объектов
- `formatSize` — форматирование размеров
- `getScaleFactor` — расчёт коэффициента масштабирования
- `toCssPixels` — конвертация в CSS-пиксели
- `toCanvasPixels` — конвертация в пиксели канваса

### HistoryManager.js (25 тестов)
- `commit` — сохранение состояний, дедупликация, maxHistory
- `beginAtomicOperation` / `endAtomicOperation` — атомарные операции
- `undo` / `redo` — отмена и повтор действий
- `clear` — очистка истории
- `isStateEqual` — сравнение состояний
- `destroy` — очистка менеджера

### LayerManager.js (39 тестов)
- `createLayerObject` — создание слоёв разных типов
- `addLayer` / `deleteActiveLayer` — добавление и удаление
- `setActiveLayerById` — установка активного слоя
- `moveLayer` — перемещение слоёв
- `redrawAllLayers` — перерисовка
- `captureActiveLayerFromCanvas` / `restoreActiveLayerToCanvas` — синхронизация с холстом
- `getLayerTypeDisplay` — иконки и имена слоёв
- `destroy` — очистка менеджера

### HighlightTool.js (31 тест)
- `constructor` — инициализация с настройками по умолчанию
- `activate` / `deactivate` — активация и деактивация инструмента
- `getUISettingsConfig` — конфигурация UI настроек
- `setupOverlay` / `cleanupOverlay` — настройка и очистка overlay
- `updateOverlay` — обновление позиции и цвета рамки выделения
- `updateSetting` — изменение цвета и толщины

### LineTool.js (21 тест)
- `constructor` — инициализация с настройками по умолчанию
- `activate` / `deactivate` — активация и деактивация инструмента
- `getUISettingsConfig` — конфигурация UI настроек
- `setupOverlay` / `cleanupOverlay` — настройка и очистка overlay
- `updateSetting` — изменение цвета и толщины линии
- Интеграционные тесты — применение настроек к активному слою

### EditorCore.crop.js (12 тестов)
- `_calculateVisibleArea` — вычисление видимой области слоя внутри кроп-области
- `_drawHighlightLayer` — отрисовка слоя выделения (highlight) на кропнутом canvas
- `_drawTextLayer` — отрисовка текстового слоя на кропнутом canvas
- `_drawBlurredLayer` — отрисовка размытого слоя на кропнутом canvas
- `_applyLineLayerToCroppedCanvas` — применение слоя линии к кропнутому canvas
- `_applyRectLayerToCroppedCanvas` — применение прямоугольного слоя к кропнутому canvas

## Добавление новых тестов

1. Создайте файл `tests/<ModuleName>.test.js`
2. Импортируйте тестируемый модуль
3. Используйте `describe` для группировки тестов
4. Используйте `it` для отдельных тестов
5. Используйте `expect` для проверок

Пример:
```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import MyModule from '../editor/MyModule.js'

describe('MyModule', () => {
  describe('methodName', () => {
    it('должен делать что-то', () => {
      expect(result).toBe(expected)
    })
  })
})
```

## Мокирование

Для тестирования модулей, зависящих от EditorCore, используйте моки:

```javascript
function createMockEditor() {
  return {
    canvas: { width: 100, height: 100 },
    context: {
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(40000) })),
      putImageData: vi.fn()
    },
    render: vi.fn(),
    updateToolbarButtons: vi.fn()
  }
}
```

## Статистика

- **Всего тестов:** 145
- **Файлов с тестами:** 6
- **Покрытие модулей:** Helper, HistoryManager, LayerManager, HighlightTool, LineTool, EditorCore (crop methods)
