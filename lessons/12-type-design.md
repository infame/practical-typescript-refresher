# Проектирование типов: дальше базовых generics

Цель: читать и писать небольшие типизированные API без случайного any и чрезмерной сложности. Перед этой главой стоит пройти narrowing и generics из главы 3. Здесь каждый приём связан с конкретной задачей.

## 1. Сначала спроси, какую связь сохраняет generic

```ts check
function identity<T>(value: T): T { return value; }
```

T связывает вход и выход. Если функция принимает T, но возвращает просто string и нигде больше не использует T, возможно, generic не нужен. Чем больше параметров типа, тем больше решений должен принять компилятор и читатель. Добавляй параметр, когда он сохраняет полезную информацию.

Для функций группировки generic сохраняет тип элемента и ключа. Для mapLimit — тип входа и результата callback. Для API `getField<T, K extends keyof T>` сохраняет связь ключа с типом значения.

## 2. Typeof и keyof: значение как источник типов

```ts check
const sourceNames = { primary: "MLS", secondary: "Partner" } as const;
type SourceKey = keyof typeof sourceNames; // "primary" | "secondary"
type SourceName = (typeof sourceNames)[SourceKey]; // "MLS" | "Partner"
```

typeof в позиции типа берёт тип существующего значения. keyof получает ключи. Indexed access получает типы полей. Это помогает не дублировать один список в runtime-конфигурации и ручном union.

Но runtime-объект и его тип всё ещё разные вещи: `Object.keys` обычно возвращает string[], а не точный массив keyof. Это связано с тем, что структурно типизированный объект может содержать дополнительные runtime-поля. Не делай универсальное `as (keyof T)[]` без понимания предпосылок.

## 3. Mapped types: преобразовать поля

Нужно дать patch, где каждое существующее поле можно либо обновить, либо очистить:

```ts check
type ClearablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};
type Editable = { price: number; description: string };
type Patch = ClearablePatch<Editable>;
```

Для каждого ключа K берём исходный тип T[K], добавляем null и делаем поле optional. Важно применять тип только к действительно редактируемым полям: включение id в T случайно разрешит менять идентификатор.

Такой тип не реализует patch runtime-логикой. Нужна функция, которая различает отсутствие и null, проверяет поля и строит новое состояние. Создание utility type не завершает бизнес-задачу.

## 4. Conditional types и infer

Представь helper, который получает тип результата функции:

```ts check
type Returned<F> = F extends (...args: never[]) => infer R ? R : never;
type Example = Returned<() => Promise<number>>; // Promise<number>
```

В условии infer R просит вывести подходящую часть типа. Для обычной работы есть готовые ReturnType и Awaited:

```ts check
async function load() { return { id: "A", price: 500 }; }
type Loaded = Awaited<ReturnType<typeof load>>;
```

Awaited моделирует разворачивание await, в том числе вложенных Promise-подобных типов. ReturnType просто извлекает возвращаемый тип; исполнение функции не происходит.

Conditional type с голым параметром типа слева от extends распределяется по union:

```ts check
type KeepStrings<T> = T extends string ? T : never;
type A = KeepStrings<"x" | 42>; // "x"

type AllStrings<T> = [T] extends [string] ? true : false;
type B = AllStrings<"x" | 42>; // false
```

Tuple-обёртка меняет вопрос: проверяем union целиком, а не каждый вариант отдельно. Это полезно для чтения библиотечных типов, но на интервью не нужно строить сложный conditional type там, где обычная сигнатура достаточна.

## 5. Overloads: разные входы, разные выходы

```ts check
function normalize(value: string): string;
function normalize(value: readonly string[]): string[];
function normalize(value: string | readonly string[]): string | string[] {
  return typeof value === "string" ? value.trim() : value.map(x => x.trim());
}
```

Внешние overload-сигнатуры описывают допустимые вызовы. Широкая implementation-сигнатура проверяет тело, но сама не является дополнительным публичным overload.

Если у вызывающего кода значение уже `string | readonly string[]`, ни один из двух overload не подходит целиком. Можно добавить union-overload либо выбрать обычную union-сигнатуру, если точная связь входа и выхода не нужна. Чрезмерное число overload усложняет чтение и вывод типов.

## 6. Assert, assertion function и satisfies

`as` утверждает тип. `!` утверждает отсутствие null/undefined. Они не создают runtime-проверку. Используй их там, где есть внешнее доказательство, а не как средство успокоить компилятор.

Assertion function действительно выполняет проверку:

```ts check
function assertString(value: unknown): asserts value is string {
  if (typeof value !== "string") throw new Error("Expected a string");
}
function upper(value: unknown): string {
  assertString(value);
  return value.toUpperCase();
}
```

После успешного вызова компилятор сужает value. В отличие от boolean-guard здесь ошибка прерывает выполнение.

```ts check
type Route = "home" | "listings";
const routes = {
  home: "/",
  listings: "/listings",
} as const satisfies Record<Route, string>;
```

satisfies проверяет контракт, а as const сохраняет литералы. Если маршрутов не хватает или имя написано с ошибкой, проверка поможет. Это не проверка внешней конфигурации в runtime.

## 7. Branded types для похожих идентификаторов

```ts check
declare const listingIdBrand: unique symbol;
type ListingId = string & { readonly [listingIdBrand]: true };

function parseListingId(value: unknown): ListingId {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Invalid listing ID");
  }
  return value as ListingId;
}
```

Brand делает случайное присваивание обычной строки несовместимым. Assertion локализован в parser после проверки. Brand не добавляет символ в реальную строку: во время исполнения это по-прежнему string. После JSON roundtrip типовую гарантию нужно восстановить проверкой.

Для двух ID с разными brands нельзя случайно передать UserId вместо ListingId. Это полезно на границах API, но стоит дополнительного кода. Для маленькой задачи обычных строк может хватить.

## 8. Функции и variance

Если API может передать callback любое Animal, нельзя давать callback, который умеет работать только с Dog. Он может получить кота. При strictFunctionTypes обычные function types проверяются с учётом этой опасности. Методы имеют некоторые послабления совместимости, поэтому изменение callback-свойства на method-синтаксис не всегда нейтрально.

```ts check
type Animal = { name: string };
type Dog = Animal & { bark(): void };
type Handler = (animal: Animal) => void;
const onlyDogs = (dog: Dog) => dog.bark();
// @ts-expect-error: Handler может получить Animal без bark
const handler: Handler = onlyDogs;
```

Не обязательно произносить «контравариантность». Достаточно объяснить, какие значения вызывающий код имеет право передать и способен ли callback их обработать.

## Практика

Напиши тип словаря обработчиков для событий added и removed. У added есть price, у removed — reason. Каждый обработчик должен получать только свой вариант события. Подсказка: keyof для словаря, Extract для выбора варианта union.

### Спойлер

```ts check
type Event =
  | { kind: "added"; price: number }
  | { kind: "removed"; reason: string };

type Handlers = {
  [K in Event["kind"]]: (event: Extract<Event, { kind: K }>) => void;
};

const handlers: Handlers = {
  added: event => console.log(event.price),
  removed: event => console.log(event.reason),
};
```

Тип обработчиков корректен. Но динамический вызов `handlers[event.kind](event)` может потерять корреляцию вариантов для компилятора. Проще dispatch через switch с конкретными kind, чем скрывать проблему через any. Сложные generic-dispatch abstractions не обязательны для этой задачи.

## Проверка понимания

Ты можешь объяснить каждый параметр типа, назвать runtime-гарантию parser и выбрать между union, overload и generic. Если utility type сложнее всей функции, попробуй упростить API.

Дополнительные справочники: [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html), [Conditional types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html), [Utility types](https://www.typescriptlang.org/docs/handbook/utility-types.html).
