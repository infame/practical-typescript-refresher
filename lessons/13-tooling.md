# Компилятор, модули и запуск TS

Цель: открыть небольшой репозиторий и быстро понять, как он проверяется и запускается. Даже хорошее знание union не помогает, если на интервью десять минут уходят на ошибку импорта.

## 1. Проверка, преобразование и исполнение

Есть три разных действия: проверка типов, подготовка исполняемого кода и исполнение. Иногда один инструмент объединяет часть действий, но не предполагай, что запуск TS обязательно проверил его типы.

В этом репозитории `npm run check` вызывает tsc без emit, а Node 24 выполняет подходящие .ts-файлы с удалением типов. Node не запускает полный typecheck и не реализует все настройки tsconfig. В production-проекте может быть tsc-сборка, bundler или другой runtime. Сначала посмотри scripts и tsconfig.

```sh
npm ci
npm run check
npm test
npm run build
npm start
```

npm ci использует lockfile и устанавливает зафиксированный набор зависимостей. npm install нужен при изменении зависимостей. Если package.json и lockfile расходятся, ci должен это обнаружить.

## 2. Strict и дополнительные настройки

strict включает группу строгих проверок: в том числе implicit any, nullability и тип неизвестной catch-ошибки. Но полезные noUncheckedIndexedAccess и exactOptionalPropertyTypes не следует считать автоматически включёнными одним strict: проверяй их отдельно.

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  }
}
```

Это конфигурация для прямого выполнения TS под выбранный runtime и отдельного typecheck. Она не универсальна для браузерного bundler-проекта.

С noUncheckedIndexedAccess `items[0]` может быть undefined. Если массив действительно непустой по контракту, опиши это tuple-типом `[T, ...T[]]`, проверь индекс или получи элемент через итерацию. Случайный `!` не исправляет контракт.

С exactOptionalPropertyTypes `field?: number` не означает разрешение записать undefined в существующее поле. Подробное различие разобрано в главе 11. VerbatimModuleSyntax делает явное разделение type/value imports особенно полезным.

## 3. Target и lib не устанавливают runtime API

target влияет на генерируемый JS при emit и на некоторые предположения компилятора. lib описывает доступные типы стандартных API. Если добавить описание toSorted, старый runtime от этого не получит реализацию toSorted. Полная поддержка требует подходящей версии среды или polyfill.

Типы Node тоже описывают API, а не обновляют сам Node. Поэтому в package engines и CI важно указать поддерживаемую среду. Если types новее runtime, можно случайно скомпилировать вызов отсутствующего API. Для учебного репозитория держим @types/node в ветке 24, соответствующей Node 24+.

## 4. ESM, CommonJS и import type

В package.json этого проекта стоит `"type": "module"`. Для .js файлов это задаёт ESM-контекст Node; отдельные расширения .mjs и .cjs позволяют явно выбрать формат. Настройки module/moduleResolution должны соответствовать среде, которая реально будет загружать код.

```ts
import { mapLimit } from "./core.ts";
import type { Repository } from "./core.ts";
```

Первый импорт нужен во время исполнения, второй — только для типов и удаляется. Interface нельзя импортировать как runtime-значение и потом ожидать `new Repository()`.

В прямом Node-исполнении нашего TS используются .ts пути. При традиционной ESM-сборке в .js часто пишут .js в исходных import или используют поддерживаемую compiler-настройку переписывания расширений. Выбирай один согласованный pipeline, не копируй настройки из другого проекта наугад.

Paths aliases в tsconfig помогают компилятору находить модули, но сами не обучают Node или браузер разрешать alias при исполнении. Нужна поддержка loader/bundler либо runtime-механизма импорта.

## 5. Типы библиотек и ambient declarations

.d.ts описывает значения и типы, реализация которых находится где-то ещё. `declare` говорит компилятору, что значение существует; не создаёт его.

```ts check
declare const API_URL: string;
// В runtime эта переменная должна быть предоставлена отдельно.
```

Некоторые библиотеки поставляют свои типы, другим нужны @types-пакеты. Если компилятор жалуется на module not found, проверь установку, exports, разрешение модулей и declarations. Не создавай `declare module "*"` с any только ради зелёной сборки: это скрывает ошибки API.

## 6. Environment variables — внешние данные

```ts
function readPort(value: string | undefined): number {
  if (value === undefined) return 4173;
  if (!/^\d+$/.test(value)) throw new Error("PORT must be digits");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT out of range");
  }
  return port;
}
```

process.env значения — строки или undefined. Assertion `as number` не преобразует строку. Для конфигурации делай отдельный parser, чтобы ошибка появлялась при запуске, а не через час в обработчике запроса.

## 7. Читаем ошибку компилятора

Когда видишь «type X is not assignable to Y», найди точку, где тип неожиданно расширился или потерял связь. Обычно причина — строковый литерал стал string, optional-поле может отсутствовать, callback принимает слишком узкий тип или внешний JSON объявлен проверенным без parser.

При runtime module-not-found проверь файл, расширение, формат модуля и фактический путь после сборки. Это другая категория, чем ошибка типа. Добавление as any не исправит отсутствующий файл.

## Практика

Проект проходит tsc, но при запуске `import { Repository }` падает: Repository был interface. Второй проект проходит typecheck с `@app/utils`, но Node не находит alias. Третий запускается в Node, хотя строковая цена передана вместо number. Что проверишь?

### Спойлер

Repository импортировать через import type и не использовать как runtime-значение. Для alias проверить runtime-resolver или заменить путь относительным; paths сам не меняет Node. В третьем проекте отдельно запустить typecheck и проверить границу внешних данных: runtime-удаление типов не является валидацией JSON.

## Минимальный рабочий цикл

Открыл проект → прочитал scripts, engines и tsconfig → установил по lockfile → запустил check и один тест → начал задачу. После правки повтори релевантную проверку. Время на настройку лучше потратить до собеседования.

Справочники: [теория модулей TypeScript](https://www.typescriptlang.org/docs/handbook/modules/theory.html), [выполнение TypeScript в Node](https://nodejs.org/api/typescript.html). Конфигурация главы описывает этот репозиторий, а не все способы запуска TS.
