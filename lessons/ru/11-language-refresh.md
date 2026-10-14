# Подзабыл TS: восстановить язык

Эта глава — вход для разработчика, который умеет программировать, но давно не писал TypeScript. Она восстанавливает базовые правила, чтобы следующие главы не ощущались набором заклинаний. Сначала разберём, что знает компилятор, затем перейдём к объектам и функциям.

## 1. Два слоя: тип и значение

```ts check
const limit: number = 4;
type Options = { limit: number };
```

limit существует во время исполнения. Options — описание для проверки кода. Обычные type/interface и аннотации удаляются при подготовке JS. Компилятор проверяет совместимость, но не добавляет автоматическую проверку пользовательского JSON.

Некоторые конструкции TypeScript, например обычный enum, создают runtime-код. Поэтому утверждение «всё в TS стирается» слишком широкое. В упражнениях используем в основном стираемый синтаксис, который Node может выполнить без отдельной сборки. Проверку типов всё равно запускаем отдельно.

Примитивы пишутся строчными: string, number, boolean. Number — общий числовой тип; встроенных разных типов int и float нет. Bigint существует отдельно и напрямую с number в арифметике не смешивается. Типы String/Number/Boolean с большой буквы относятся к wrapper-объектам и обычно не нужны.

## 2. Inference: где аннотация нужна

```ts check
let status = "queued";   // string: переменную можно переназначать
const mode = "queued";   // литеральный тип "queued"
const job = { status: "queued" }; // поле status обычно string
```

const запрещает заменить ссылку на job, но поле job.status всё ещё изменяемо. Поэтому компилятор обычно расширяет литерал поля до string. Это частая причина ошибки при передаче объекта в API, ожидающее `"queued" | "done"`.

```ts check
type Job = { status: "queued" | "done" };
const job: Job = { status: "queued" };
job.status = "done";
```

Аннотация задаёт контракт. `as const` сохраняет более узкие литералы и readonly-представление; не выбирай его, если объект должен менять состояние. `satisfies` проверяет соответствие формы, но не гарантирует, что каждое поле будет расширено до целевого union. Узкий литеральный тип может остаться узким.

У пустой коллекции компилятору часто нечего выводить:

```ts check
const state: { tags: string[] } = { tags: [] };
state.tags.push("new");
```

В strict-коде поле `tags: []` без контекста может получить never[]. У отдельной переменной пустого массива правила вывода зависят от контекста. Не заучивай «пустой массив всегда never[]»: задавай тип, когда собираешь коллекцию постепенно.

## 3. Structural typing

TypeScript обычно смотрит на форму объекта, а не на имя его типа.

```ts check
type Identified = { id: string };
function show(value: Identified): string {
  return value.id;
}
const listing = { id: "A", price: 500 };
show(listing); // можно: обязательное поле id есть
```

Но свежий object literal имеет дополнительную проверку лишних полей:

```ts check
type Identified = { id: string };
function show(value: Identified): string { return value.id; }
// @ts-expect-error: лишнее поле в свежем литерале
show({ id: "A", price: 500 });
```

Это помогает ловить опечатки, но не превращает тип в точную runtime-схему. Передача через переменную может быть допустимой; лишние поля физически не исчезают. Для контроля внешнего объекта нужен parser.

Так же два типа `UserId = string` и `ListingId = string` совместимы: alias не создаёт отдельную номинальную сущность. Для предотвращения путаницы можно использовать branded types, о них дальше в главе про проектирование типов.

## 4. Union и intersection

`A | B` — значение одного из вариантов. До проверки доступны только операции, безопасные для всех вариантов.

```ts check
function format(value: string | number): string {
  return typeof value === "number" ? value.toFixed(2) : value.trim();
}
```

`A & B` — значение должно удовлетворять обоим контрактам одновременно. Intersection не означает «перезапиши поле правым типом».

```ts check
type Impossible = { id: string } & { id: number };
// id должен быть и string, и number: для обычных значений это never.
```

Чтобы заменить тип поля: `Omit<Original, "id"> & { id: number }`. Для состояния «успех или ошибка» обычно нужен union, а не intersection и несколько необязательных полей.

## 5. Optional: отсутствует или равен undefined

```ts check
type Options = { retries?: number };
const omitted: Options = {};
```

При чтении retries может быть undefined. С включённым exactOptionalPropertyTypes запись `{ retries: undefined }` не соответствует этому типу: поле либо отсутствует, либо содержит number. Если undefined нужен как явное значение, напиши `retries?: number | undefined`.

`{ retries: number | undefined }` требует само поле: `{}` не подходит. Поэтому «optional-поле» и «обязательное поле с возможным undefined» — разные контракты.

Для PATCH это особенно полезно: отсутствие поля может означать «оставить», null — «очистить». Не теряй различие при нормализации. `"field" in obj` проверяет наличие и по цепочке прототипов; `Object.hasOwn` — только собственное поле. Последний сам по себе не всегда даёт нужное сужение типа, поэтому наличие и тип значения проверяются осознанно.

## 6. Массивы, tuple и readonly

```ts check
const prices: number[] = [100, 200];
const point: readonly [x: number, y: number] = [10, 20];
```

Tuple задаёт позиции: point[0] — x, point[1] — y. Названия помогают редактору, но не создают runtime-поля point.x. Обычный массив не гарантирует длину; с noUncheckedIndexedAccess обращение prices[0] включает undefined.

Readonly-массив можно читать и передавать дальше в readonly API. Функция, которая только читает вход, должна принимать readonly: так ей подходят и изменяемые, и неизменяемые коллекции. Readonly неглубокий и не защищает от изменения через другой alias.

## 7. Сигнатуры функций

```ts check
type Formatter = (price: number, currency?: string) => string;
const format: Formatter = (price, currency = "USD") => `${currency} ${price}`;
```

Типы параметров callback выводятся из контекста. Optional-параметр означает, что вызывающая сторона может его не передать. Если твой API всегда передаёт index callback, не объявляй index optional только потому, что некоторые callbacks его игнорируют: игнорировать лишний аргумент и получать потенциальный undefined — разные вещи.

Rest-параметр принимает много аргументов: `(...values: number[])`. Async-функция возвращает `Promise<T>`, а не T. `void` у callback означает, что вызывающий код не использует возвращённое значение. Поэтому функция, возвращающая number, может соответствовать `() => void`; это не обещание отсутствия результата во время исполнения.

## 8. This и замыкания

this обычного метода зависит от способа вызова. При передаче метода как callback объект-получатель может потеряться.

```ts check
class Counter {
  value = 0;
  increment() { this.value++; }
}
const counter = new Counter();
const safe = () => counter.increment();
safe();
```

Можно использовать bind либо arrow-поле класса, которое сохраняет this экземпляра. Замыкание хранит доступ к переменной, а не автоматически её снимок. Если переменная изменится до вызова callback, callback увидит новое значение. В цикле let создаёт отдельное binding на итерацию, var — общее.

Передача counter.increment в scheduler отделяет метод от объекта. Receiver определяется последующим вызовом, а не местом получения метода. bind связывает receiver; wrapper вызывает метод на объекте в нужный момент. Closure читает переменную при вызове, поэтому изменение count до вызова меняет результат. Проверь прямой вызов и отделённый callback: один counter.increment() не обнаружит ошибку.

```ts check
class Counter {
  value = 0;
  increment() { this.value++; }
}
const counter = new Counter();
const detached = counter.increment;
// detached() would throw in this strict module: this is undefined.
const bound = counter.increment.bind(counter);
bound(); // value is 1.
let count = 0;
const readCount = () => count;
count = 2;
readCount(); // 2: the closure reads the current variable, not its old value.
```

## Практика

Почему `const job = { status: "queued" }` может не подойти для Job? Почему `Readonly<{ tags: string[] }>` всё ещё позволяет push в tags? И чем `retries?: number` отличается от `retries: number | undefined`?

### Спойлер

Поле status обычно выведено как string, а Job ожидает ограниченный union. Задай аннотацию Job или осознанно выбери литеральный тип. Readonly запрещает заменить свойство tags, но не менять сам массив; для этого нужен readonly string[]. Optional разрешает отсутствие свойства, обязательное union-поле требует его наличия. При exactOptionalPropertyTypes отдельно различаются отсутствие и явно записанный undefined.

## Когда двигаться дальше

Ты можешь объяснить тип и значение, написать функцию с callback, выбрать union для вариантов и проверить неизвестный вход. Дальше читай главу 2 о runtime и главу 3 о narrowing.

## Официальные справочники

Справочники для уточнения терминов: [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html), [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html). Объяснения и упражнения в этой главе авторские.
