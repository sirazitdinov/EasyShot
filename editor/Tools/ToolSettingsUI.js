// Tools/ToolSettingsUI.js

/**
 * Базовый класс для отображения элементов настроек на странице
 * Определяет общий интерфейс и обеспечивает базовую функциональность
 */
export default class ToolSettingsUI {
    constructor(containerElement) {
        this.container = containerElement; // DOM-элемент панели настроек
    }

    renderSettings(tool) {
        // Если инструмент null — скрываем панель настроек
        if (!tool) {
            this.container.style.display = 'none';
            this.clear();
            return;
        }

        const config = tool.getUISettingsConfig();

        // Скрываем панель если нет настроек
        if (config.fields.length === 0) {
            this.container.style.display = 'none';
            return;
        }

        // Показываем панель

        this.clear();
        config.fields.forEach(field => {
            const element = this.createFieldElement(field);
            this.container.appendChild(element);
        });

        this.container.style.display = 'flex';

    }

    createFieldElement(field) {
       // Создаем контейнер для поля
       const fieldContainer = document.createElement('div');
       fieldContainer.className = 'setting-container'; // Для CSS-стилей

       // Создаем лейбл
       const label = document.createElement('label');
       label.textContent = field.label;
       label.htmlFor = field.key; // Связываем с полем ввода
       fieldContainer.appendChild(label);

       // Создаем элемент ввода на основе type
       let inputElement;
       switch (field.type) {
         case 'color':
           inputElement = document.createElement('input');
           inputElement.type = 'color';
           inputElement.value = field.value;
           break;

         case 'range':
           inputElement = document.createElement('input');
           inputElement.type = 'range';
           inputElement.min = field.min || 0;
           inputElement.max = field.max || 100;
           inputElement.value = field.value;
           // Опционально: добавить отображение текущего значения
           const valueDisplay = document.createElement('span');
           valueDisplay.classList.add('range-value');
           valueDisplay.textContent = field.value;
           inputElement.addEventListener('input', () => {
             valueDisplay.textContent = inputElement.value;
           });
           fieldContainer._valueDisplay = valueDisplay;
           break;

         case 'number':
           inputElement = document.createElement('input');
           inputElement.type = 'number';
           inputElement.min = field.min || 0;
           inputElement.max = field.max || 100;
           inputElement.value = field.value;
           break;

         case 'text':
           inputElement = document.createElement('input');
           inputElement.type = 'text';
           inputElement.value = field.value;
           break;

         case 'checkbox':
           inputElement = document.createElement('input');
           inputElement.type = 'checkbox';
           inputElement.checked = field.value;
           break;

         case 'select':
           inputElement = document.createElement('select');
           if (field.options && Array.isArray(field.options)) {
             field.options.forEach(option => {
               const opt = document.createElement('option');
               opt.value = option.value;
               opt.textContent = option.label;
               if (option.value === field.value) opt.selected = true;
               inputElement.appendChild(opt);
             });
           }
           break;

         default:
           // Fallback: текстовое поле
           console.warn(`Unsupported field type: ${field.type}. Using text input.`);
           inputElement = document.createElement('input');
           inputElement.type = 'text';
           inputElement.value = field.value;
           break;
       }

       // Общие атрибуты для всех полей
       inputElement.id = field.key;
       inputElement.name = field.key;

       // Привязка обработчика изменения
       inputElement.addEventListener('input', (event) => {
         let newValue = event.target.value;
         if (field.type === 'checkbox') {
           newValue = event.target.checked;
         } else if (field.type === 'number' || field.type === 'range') {
           newValue = parseFloat(newValue) || 0; // Преобразование в число
         }
         // Вызываем onChange из field
         if (field.onChange) {
           field.onChange(newValue);
         }
       });

       // Добавляем элемент ввода в контейнер
       fieldContainer.appendChild(inputElement);

       // Для range выводим отображение текущего значения
       if(field.type === 'range') {
            fieldContainer.appendChild(fieldContainer._valueDisplay);
       }

       return fieldContainer;
     }

    clear() {
        this.container.innerHTML = '';
    }
}