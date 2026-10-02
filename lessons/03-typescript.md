# TypeScript для практического задания

Цель: использовать типы, чтобы быстрее писать правильный код. Здесь четыре разбора: неизвестный вход, варианты состояния, generics и типы для API. Примеры предполагают strict mode.

## 1. Unknown, any и narrowing

`any` выключает существенную часть проверок. `unknown` позволяет хранить что угодно, но требует проверить значение перед использованием. Внешний JSON удобно сразу присвоить переменной unknown.

```ts check
type Listing = { id: string; price: number };

function parseListing(value: unknown): Listing {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object");
  }
  if (!("id" in value) || typeof value.id !== "string" || !value.id.trim()) {
    throw new Error("Invalid id");
  }
  if (!("price" in value) || typeof value.price !== "number" ||
      !Number.isFinite(value.price) || value.price < 0) {
    throw new Error("Invalid price");
  }
  return { id: value.id, price: value.price };
}
```

`typeof null` возвращает `"object"`, поэтому проверка объекта обязательно исключает null. TypeScript сужает тип по веткам: сначала объект, затем наличие поля, затем тип поля. Сам `as Listing` не проверяет и не преобразует данные. `JSON.parse` может отдельно выбросить ошибку синтаксиса ещё до проверки структуры.

Type guard возвращает boolean с обещанием `value is Listing`. При true компилятор доверяет этому обещанию; реализацию guard он не доказывает. Parser удобнее, когда нужны нормализация и сообщения об ошибках. Guard удобнее для разветвления, но `records.filter(isListing)` молча выбрасывает плохие записи — это должно соответствовать контракту.

## 2. Discriminated unions: допустимые состояния

Посмотри на тип результата:

```ts
type WeakResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

Он допускает `success: true` без data, одновременно data и error, либо вообще отсутствие обоих. В каждом месте использования приходится додумывать правила.

Лучше перечислить два допустимых состояния:

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function describe(result: Result<Listing>): string {
  if (result.ok) {
    return `${result.value.id}: ${result.value.price}`;
  }
  return result.error;
}
```

`ok` — дискриминатор: общее поле с разными литеральными значениями. Проверив его, компилятор знает, какой вариант перед ним. Для успешного результата value обязателен; для ошибки его нет.

Та же идея для событий:

```ts check
type ListingEvent =
  | { kind: "price_changed"; id: string; price: number }
  | { kind: "removed"; id: string; reason: string };

function assertNever(value: never): never {
  throw new Error(`Unexpected event: ${JSON.stringify(value)}`);
}

function summarize(event: ListingEvent): string {
  switch (event.kind) {
    case "price_changed": return `${event.id}: ${event.price}`;
    case "removed": return `${event.id}: ${event.reason}`;
    default: return assertNever(event);
  }
}
```

`never` означает, что допустимых значений уже не осталось. Если добавить третий вариант события и забыть обработчик, вызов assertNever перестанет компилироваться. Это проверка полноты обработки. Она не заменяет runtime-валидацию внешнего payload.

Result подходит для ожидаемых ошибок конкретной записи: собрать отчёт и продолжить. Исключение удобно для ситуации, когда текущая операция не может нормально продолжаться. Главное — явный контракт, а не правило «всегда только Result» или «всегда throw».

## 3. Generics: сохранить связь типов

Generic нужен, когда функция делает одну и ту же работу с разными типами, но должна сохранить информацию об этих типах.

```ts check
function groupBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

const byPrice = groupBy(
  [{ id: "A", price: 500 }],
  listing => listing.price,
); // Map<number, { id: string; price: number }[]>
```

T — тип элемента, K — тип ключа. Обычно они выводятся из аргументов, явно писать их не требуется. `any` потерял бы связь входа с выходом. `unknown` на выходе заставил бы снова проверять уже известные данные.

`keyof T` — объединение имён полей типа T; `T[K]` — тип значения выбранного поля.

```ts check
function getField<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const price = getField({ id: "A", price: 500 }, "price"); // number
// getField({ id: "A" }, "missing"); // ошибка компиляции
```

`extends` здесь — ограничение параметра типа: K может быть только ключом T. Это не наследование объектов во время исполнения.

## 4. Utility types и практический контракт

```ts check
type Listing = { id: string; price: number; source: string };
type Summary = Pick<Listing, "id" | "price">;
type CreateListing = Omit<Listing, "id">;
type PatchListing = Partial<Pick<Listing, "price">>;
type FrozenListing = Readonly<Listing>;
```

Pick выбирает поля, Omit исключает, Partial делает поля необязательными, Readonly запрещает присваивание через этот тип. Они не удаляют реальные поля из объектов и не выполняют глубокую заморозку. Для PATCH лучше перечислить разрешённые поля, чем делать `Partial<Listing>` и случайно разрешать менять идентификатор.

`Record<"queued" | "done", number>` полезен для фиксированного набора ключей. `Record<string, Listing>` выглядит как объект, у которого по любой строке есть Listing, хотя на практике ключ может отсутствовать. Для разреженного индекса используй Map, `Partial<Record<string, Listing>>` или учитывай undefined; настройка noUncheckedIndexedAccess тоже помогает ловить опасные обращения по индексу.

`type` подходит для union, tuple и alias; `interface` удобен для объектных контрактов и расширения. Для обычного объекта оба подходят. Не трать интервью на спор о стиле.

`as const` сохраняет литеральные типы и readonly-представление литерала; `satisfies` проверяет совместимость выражения с типом, не заменяя его тип просто целевым. Они не являются runtime-валидацией.

```ts check
const handlers = {
  queued: "Pending",
  done: "Finished",
} satisfies Record<"queued" | "done", string>;
```

В catch ошибка имеет неизвестный тип при strict-настройках: `error instanceof Error ? error.message : String(error)`. Не предполагай, что JavaScript разрешает бросать только Error.

## Практика

Спроектируй результат импорта одной записи: успешно применена, пропущена как устаревшая или отклонена с причиной. У всех вариантов должен быть ID; только у ошибки — message. Напиши функцию, считающую только применённые записи.

### Спойлер

```ts check
type ImportResult =
  | { status: "applied"; id: string }
  | { status: "stale"; id: string }
  | { status: "failed"; id: string; message: string };

function countApplied(results: readonly ImportResult[]): number {
  return results.filter(result => result.status === "applied").length;
}
```

Нельзя случайно создать failed без message. При обработке `status === "failed"` message доступно без `!` и `as`. Если нужна причина пропуска, добавь её именно в stale-вариант, а не optional-поле для всех состояний.

## Что сказать на интервью

> I'll validate external input at the boundary and represent success and failure as distinct types, so callers have to handle both cases.

Для сверки поведения narrowing: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/narrowing.html). Это справочник, а не обязательное чтение всей главы перед практикой.
