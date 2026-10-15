# Компилятор, модули и запуск TS

Цель: открыть небольшой репозиторий и быстро понять, как он проверяется и запускается. Даже хорошее знание union не помогает, если на интервью десять минут уходят на ошибку импорта.

## 1. Проверка, преобразование и исполнение

Есть три разных действия: проверка типов, подготовка исполняемого кода и исполнение. Иногда один инструмент объединяет часть действий, но не предполагай, что запуск TS обязательно проверил его типы.

В этом репозитории `npm run check` вызывает tsc без emit, а Node 24 выполняет подходящие .ts-файлы с удалением типов. Node не запускает полный typecheck и не реализует все настройки `tsconfig`. В production-проекте может быть tsc-сборка, bundler или другой runtime. Сначала посмотри scripts и `tsconfig`.

```sh
npm ci
npm run check
npm test
npm run build
npm start
```

`npm ci` использует lockfile и устанавливает зафиксированный набор зависимостей. `npm install` нужен при изменении зависимостей. Если package.json и lockfile расходятся, ci должен это обнаружить.

## 2. Strict и дополнительные настройки

`strict` включает группу строгих проверок: в том числе implicit `any`, nullability и тип неизвестной catch-ошибки. Но полезные `noUncheckedIndexedAccess` и `exactOptionalPropertyTypes` не следует считать автоматически включёнными одним `strict`: проверяй их отдельно.

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

С `noUncheckedIndexedAccess` `items[0]` может быть `undefined`. Если массив действительно непустой по контракту, опиши это tuple-типом `[T, ...T[]]`, проверь индекс или получи элемент через итерацию. Случайный `!` не исправляет контракт.

С `exactOptionalPropertyTypes` `field?: number` не означает разрешение записать `undefined` в существующее поле. Подробное различие разобрано в главе 11. VerbatimModuleSyntax делает явное разделение type/value imports особенно полезным.

## 3. Target и lib не устанавливают runtime API

target влияет на генерируемый JS при emit и на некоторые предположения компилятора. lib описывает доступные типы стандартных API. Если добавить описание `toSorted`, старый runtime от этого не получит реализацию `toSorted`. Полная поддержка требует подходящей версии среды или polyfill.

Типы Node тоже описывают API, а не обновляют сам Node. Поэтому в package engines и CI важно указать поддерживаемую среду. Если types новее runtime, можно случайно скомпилировать вызов отсутствующего API. Для учебного репозитория держим `@types/node` в ветке 24, соответствующей Node 24+.

## 4. ESM, CommonJS и import type

В package.json этого проекта стоит `"type": "module"`. Для .js файлов это задаёт ESM-контекст Node; отдельные расширения .mjs и .cjs позволяют явно выбрать формат. Настройки module/`moduleResolution` должны соответствовать среде, которая реально будет загружать код.

```ts
import { mapLimit } from "./core.ts";
import type { Repository } from "./core.ts";
```

Первый импорт нужен во время исполнения, второй — только для типов и удаляется. Interface нельзя импортировать как runtime-значение и потом ожидать `new Repository()`.

В прямом Node-исполнении нашего TS используются .ts пути. При традиционной ESM-сборке в .js часто пишут .js в исходных import или используют поддерживаемую compiler-настройку переписывания расширений. Выбирай один согласованный pipeline, не копируй настройки из другого проекта наугад.

Paths aliases в `tsconfig` помогают компилятору находить модули, но сами не обучают Node или браузер разрешать alias при исполнении. Нужна поддержка loader/bundler либо runtime-механизма импорта.

## 5. Типы библиотек и ambient declarations

.d.ts описывает значения и типы, реализация которых находится где-то ещё. `declare` говорит компилятору, что значение существует; не создаёт его.

```ts check
declare const API_URL: string;
// В runtime эта переменная должна быть предоставлена отдельно.
```

Некоторые библиотеки поставляют свои типы, другим нужны @types-пакеты. Если компилятор жалуется на module not found, проверь установку, exports, разрешение модулей и declarations. Не создавай ``declare module "*"`` с `any` только ради зелёной сборки: это скрывает ошибки API.

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

`process.env` значения — строки или `undefined`. Assertion `as number` не преобразует строку. Для конфигурации делай отдельный parser, чтобы ошибка появлялась при запуске, а не через час в обработчике запроса.

## 7. Читаем ошибку компилятора

Когда видишь «type X is not assignable to Y», найди точку, где тип неожиданно расширился или потерял связь. Обычно причина — строковый литерал стал `string`, optional-поле может отсутствовать, callback принимает слишком узкий тип или внешний JSON объявлен проверенным без parser.

При runtime module-not-found проверь файл, расширение, формат модуля и фактический путь после сборки. Это другая категория, чем ошибка типа. Добавление as `any` не исправит отсутствующий файл.

## Практика

Проект проходит tsc, но при запуске `import { Repository }` падает: `Repository` был interface. Второй проект проходит typecheck с `@app/utils`, но Node не находит alias. Третий запускается в Node, хотя строковая цена передана вместо `number`. Что проверишь?

### Спойлер

`Repository` импортировать через `import type` и не использовать как runtime-значение. Для alias проверить runtime-resolver или заменить путь относительным; paths сам не меняет Node. В третьем проекте отдельно запустить typecheck и проверить границу внешних данных: runtime-удаление типов не является валидацией JSON.

## Минимальный рабочий цикл

Открыл проект → прочитал scripts, engines и `tsconfig` → установил по lockfile → запустил check и один тест → начал задачу. После правки повтори релевантную проверку. Время на настройку лучше потратить до собеседования.

## Официальные справочники

Справочники: [теория модулей TypeScript](https://www.typescriptlang.org/docs/handbook/modules/theory.html), [выполнение TypeScript в Node](https://nodejs.org/api/typescript.html). Конфигурация главы описывает этот репозиторий, а не все способы запуска TS.

## Разбор ошибок компилятора: десять исправлений

Прочитай ошибку, проследи значение до объявления и попробуй исправить код до открытия ответа. Каждый ошибочный и исправленный блок отдельно проверяется со `strict`-настройками репозитория. `@ts-expect-error` помечает намеренную ошибку; удали комментарий в черновике, чтобы увидеть диагностику. Это примеры для typecheck, а не для запуска как есть: ошибочные строки всё равно выполняются в runtime.

Справочники: [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html), [связи generic-типов](https://www.typescriptlang.org/docs/handbook/2/generics.html), [перегрузки](https://www.typescriptlang.org/docs/handbook/2/functions.html), [optional-свойства](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html).

### 1. Изменяемое поле расширилось до string

Вызов не проходит проверку аргумента, хотя переменная объекта объявлена `const`. Найди значение, тип которого стал слишком широким.

```ts check
type Status = "queued" | "done";
function accept(status: Status): Status { return status; }
const job = { status: "queued" };
// @ts-expect-error: mutable property inferred as string, not Status.
accept(job.status);
```

### Спойлер

`const` фиксирует переменную, но не изменяемое свойство: его тип — `string`. Задай контракт при создании объекта, чтобы разрешить законные переходы. `as const` подходит фиксированной конфигурации, но делает свойство `readonly`. Проверь допустимый переход и отказ для посторонней строки.

```ts check
type Status = "queued" | "done";
const job: { status: Status } = { status: "queued" };
job.status = "done";
// @ts-expect-error: not a state in this domain.
job.status = "running";
```

### 2. Optional-свойство может отсутствовать

Компилятор не может обещать строку для любого вызывающего кода. Исправь контракт входа или обработай отсутствие.

```ts check
function token(options: { token?: string }): string {
  // @ts-expect-error: options.token can be undefined.
  return options.token.trim();
}
```

### Спойлер

Сохрани значение в локальную переменную и проверь до вызова методов. Здесь отсутствие и пустой токен — ошибки. ! убрал бы предупреждение, но не создал токен. Значение по умолчанию подходит только при разрешённом контрактом анонимном доступе.

```ts check
function token(options: { token?: string }): string {
  const value = options.token;
  if (value === undefined || value.trim() === "") throw new Error("Missing token");
  return value.trim();
}
token({ token: " abc " }); // "abc"; token({}) rejects.
```

### 3. Индекс массива не гарантирует наличие элемента

При `noUncheckedIndexedAccess` даже элемент с индексом ноль может отсутствовать.

```ts check
function firstId(items: readonly { id: string }[]): string {
  // @ts-expect-error: empty arrays have no first item.
  return items[0].id;
}
```

### Спойлер

Определи поведение пустого входа. Эта функция возвращает `undefined`, значит он нужен в типе результата. Если пустой вход запрещён, проверь и брось ошибку либо принимай непустой tuple. Assertion не меняет фактический внешний массив.

```ts check
function firstId(items: readonly { id: string }[]): string | undefined {
  const first = items[0];
  return first?.id;
}
firstId([]); // undefined
firstId([{ id: "A" }]); // "A"
```

### 4. Отсутствие отличается от явного undefined

`exactOptionalPropertyTypes` отвергает присваивание; чтение свойства по-прежнему может вернуть `undefined`.

```ts check
type Patch = { name?: string };
// @ts-expect-error: present undefined is not an allowed field value.
const patch: Patch = { name: undefined };
```

### Спойлер

Для отсутствия обновления пропусти свойство. Добавляй `undefined` в union только если явное значение входит в контракт. `Object.hasOwn` различает объекты в runtime; JSON-сериализация объекта обычно удаляет свойства с `undefined`, поэтому транспортную семантику нужно определить отдельно.

```ts check
type Patch = { name?: string };
const unchanged: Patch = {};
type ExplicitPatch = { name?: string | undefined };
const present: ExplicitPatch = { name: undefined };
Object.hasOwn(unchanged, "name"); // false
Object.hasOwn(present, "name"); // true
```

### 5. Generic-getter потерял связь ключа и значения

Широкая сигнатура принимает допустимые ключи, но не сохраняет конкретный запрошенный ключ.

```ts check
function field<T>(value: T, key: keyof T): T[keyof T] { return value[key]; }
const person = { age: 42, name: "Ada" };
// @ts-expect-error: result is string | number, not specifically number.
const age: number = field(person, "age");
```

### Спойлер

Выдели ключу параметр `K extends keyof T` и возвращай `T[K]`. Assertion в месте вызова скрывает потерянную связь и может стать неверным при смене ключа. Проверь числовое и строковое свойства; отсутствующий ключ должен отвергаться.

```ts check
function field<T, K extends keyof T>(value: T, key: K): T[K] { return value[key]; }
const person = { age: 42, name: "Ada" };
const age: number = field(person, "age");
const name: string = field(person, "name");
// @ts-expect-error: missing key.
field(person, "email");
```

### 6. Union не подходит ни к одной перегрузке

Реализация умеет обработать оба входа, но вызывающий код видит только сигнатуры перегрузок.

```ts check
function normalize(value: string): string;
function normalize(value: readonly string[]): string[];
function normalize(value: string | readonly string[]): string | string[] {
  return typeof value === "string" ? value.trim() : value.map(x => x.trim());
}
function call(value: string | readonly string[]) {
  // @ts-expect-error: neither single-variant overload accepts this union.
  return normalize(value);
}
```

### Спойлер

Добавь union-перегрузку, если такие аргументы допустимы, либо одну union-сигнатуру, если точная связь не нужна. Здесь дополнительная перегрузка сохраняет точный результат для известного варианта. Union-вызов получает union-результат и должен его сузить.

```ts check
function normalize(value: string): string;
function normalize(value: readonly string[]): string[];
function normalize(value: string | readonly string[]): string | string[];
function normalize(value: string | readonly string[]): string | string[] {
  return typeof value === "string" ? value.trim() : value.map(x => x.trim());
}
const one: string = normalize(" a ");
function call(value: string | readonly string[]): string | string[] { return normalize(value); }
```

### 7. Readonly-view не имеет метода push

Получатель обещал не изменять массив через полученную ссылку.

```ts check
function addTag(tags: readonly string[], next: string): string[] {
  // @ts-expect-error: readonly arrays prohibit push through this view.
  tags.push(next);
  return [...tags];
}
```

### Спойлер

Возвращай новый массив. Это защищает вход через данную API, но не замораживает объект. `Readonly<{tags: string[]}>` запрещает заменить tags, однако tags.push компилируется. Для защиты обоих уровней нужны `readonly`-свойство и `readonly`-массив.

```ts check
function addTag(tags: readonly string[], next: string): string[] { return [...tags, next]; }
const source = ["old"];
const result = addTag(source, "new"); // source remains ["old"].
type State = { readonly tags: readonly string[] };
const state: State = { tags: source };
// @ts-expect-error: nested view is readonly too.
state.tags.push("other");
```

### 8. Исчерпывающий switch пропустил вариант

Присваивание остатка в `never` обнаруживает необработанный вариант.

```ts check
type Result = { kind: "ok"; value: number } | { kind: "failed"; message: string };
function describe(result: Result): string {
  switch (result.kind) {
    case "ok": return String(result.value);
    default:
      // @ts-expect-error: failed has not been handled.
      const missing: never = result;
      return String(missing);
  }
}
```

### Спойлер

Обработай все варианты до проверки `never`. Добавление нового варианта должно снова сломать компиляцию здесь. Fallback с пустой строкой незаметно принял бы новый случай. Гарантия относится к объявленному union; внешний JSON нужно валидировать.

```ts check
type Result = { kind: "ok"; value: number } | { kind: "failed"; message: string };
function describe(result: Result): string {
  switch (result.kind) {
    case "ok": return String(result.value);
    case "failed": return result.message;
    default: {
      const unreachable: never = result;
      throw new Error(`Unexpected result: ${String(unreachable)}`);
    }
  }
}
```

### 9. Пойманное значение имеет тип unknown

JavaScript разрешает бросать значения без свойства message.

```ts check
function message(run: () => void): string {
  try { run(); return "ok"; } catch (error) {
    // @ts-expect-error: a caught unknown is not automatically Error.
    return error.message;
  }
}
```

### Спойлер

Сузь значение до `Error` перед чтением message. Для обычных остальных значений используй согласованный fallback: `String(undefined)` — `"undefined"`, не пустая строка. Необычные объекты могут бросать и при преобразовании; для безотказного логирования нужна дополнительная политика. Наличие сообщения не делает ошибку временной.

```ts check
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
errorMessage(new Error("offline")); // "offline"
errorMessage(undefined); // "undefined"
```

### 10. Interface не является runtime-конструктором

Компилятор сообщает об использовании типа как значения.

```ts check
interface RecordData { id: string }
// @ts-expect-error: interfaces are erased; no constructor exists.
const record = new RecordData();
```

### Спойлер

Создай объект, соответствующий интерфейсу, либо реальный класс/factory. Type-only import описывает контракт и удаляется. declare лишь описывает ожидаемую внешнюю реализацию и не создаёт её. Runtime-импорты проверяй отдельно от typecheck.

```ts check
interface RecordData { id: string }
const record: RecordData = { id: "A" };
class StoredRecord implements RecordData {
  id: string;
  constructor(id: string) { this.id = id; }
}
const stored: RecordData = new StoredRecord("B");
```
