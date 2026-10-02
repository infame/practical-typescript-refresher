# Практика по предметным областям

# Каталог товаров

## Задача: актуальные остатки

Вход — валидные события `{ storeId, eventId, sku, version, stock }`. `stock` — целое число ≥ 0. `eventId` уникален внутри магазина. Верни последнюю версию каждого `(storeId, sku)`, сохрани нулевой остаток. Повторная доставка учитывается один раз; при равной версии оставь первую запись. Порядок результата — первое появление товара. Вход не изменяй.

Перед кодом: назови два разных ключа и объясни, почему нельзя дедуплицировать по sku. Проверь одинаковый sku у двух магазинов, версии в обратном порядке, повтор события и stock = 0.

### Спойлер

Сначала `Set` ключей `(storeId, eventId)`, затем `Map` ключей `(storeId, sku)` с максимальной версией. Кодируй составной ключ как `JSON.stringify([storeId, sku])` или используй вложенные Map, чтобы разделитель внутри ID не создавал коллизии. `Map.set` существующего ключа сохраняет позицию. Сравнение строгое `>` сохраняет первую запись при равенстве. Не фильтруй stock по truthiness. Если повтор одного eventId может содержать другой payload, нужна отдельная политика конфликта; здесь повтор неизменяем.

Решение требует одного прохода и O(k + e) памяти для товаров и событий; стоимость обработки строковых ключей зависит от их длины. Выпиши ожидания руками, затем реализуй и добавь проверки.

```ts
export type StockEvent = {
  storeId: string; eventId: string; sku: string; version: number; stock: number;
};
export function latestStock(events: readonly StockEvent[]): StockEvent[] {
  const seen = new Set<string>();
  const latest = new Map<string, StockEvent>();
  for (const event of events) {
    const eventKey = JSON.stringify([event.storeId, event.eventId]);
    if (seen.has(eventKey)) continue;
    seen.add(eventKey);
    const itemKey = JSON.stringify([event.storeId, event.sku]);
    const current = latest.get(itemKey);
    if (!current || event.version > current.version) latest.set(itemKey, event);
  }
  return [...latest.values()];
}
```

Рабочие функции — `examples/domains.ts`, проверки — `examples/domains.test.ts`. Перед новой попыткой закрой разбор и измени входные данные.

# События аналитики

## Задача: просмотры по страницам

Напиши `countViews(input: readonly unknown[]): Map<string, number>`. Валидное событие имеет непустые после trim строки `eventId`, `page` и литерал `kind: "view"`. Остальные события игнорируй. eventId глобально уникален, повтор неизменяем; при повторе учитывай первую валидную запись. Нормализуй обе строки через trim. Вход не изменяй.

Проверь null, массив вместо события, пробелы, чужой kind, повтор и две разные записи одной страницы. Порядок страниц — первое валидное появление.

### Спойлер

На границе проверь `typeof value === "object"`, исключи null и массивы, затем проверь поля и непустые нормализованные строки. Только после валидации добавляй ID в Set: невалидный вход не должен блокировать последующую валидную запись. Для счётчика используй `counts.set(page, (counts.get(page) ?? 0) + 1)`. Объекты в Set не дедуплицируются по полям. Не используй `as Event` как замену parser. Получаются три отдельных шага: проверка, идентификация события, агрегирование.

```ts
export function countViews(input: readonly unknown[]): Map<string, number> {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const value of input) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
    if (!('kind' in value) || value.kind !== 'view') continue;
    if (!('eventId' in value) || typeof value.eventId !== 'string') continue;
    if (!('page' in value) || typeof value.page !== 'string') continue;
    const id = value.eventId.trim();
    const page = value.page.trim();
    if (!id || !page || seen.has(id)) continue;
    seen.add(id);
    counts.set(page, (counts.get(page) ?? 0) + 1);
  }
  return counts;
}
```

Рабочие функции — `examples/domains.ts`, проверки — `examples/domains.test.ts`. Перед новой попыткой закрой разбор и измени входные данные.

# Фоновые задачи

## Задача: обработать очередь

Напиши `runJobs<T>(jobs: readonly T[], limit: number, execute: (job: T, index: number) => Promise<string>)`. Верни для каждой позиции `{ ok: true, value: string } | { ok: false, error: string }`. limit — положительное безопасное целое. Не более limit операций одновременно; после ошибки одной задачи продолжай остальные. Результат сохраняет входной порядок. Синхронный throw тоже считается ошибкой задачи.

Проверь пустой вход, limit = 0, максимум активных операций, разные задержки, throw undefined и успех после ошибки.

### Спойлер

Сначала валидируй limit. Вызови mapLimit, а внутри его callback сделай try/catch вокруг `await execute(job, index)`. Catch возвращает failure-variant с `error instanceof Error ? error.message : String(error)`. Поэтому ошибки отдельных задач превращаются в значения, а не отклоняют весь batch. Callback возвращает явно заданный union: иначе ok может расшириться до boolean. Счётчик активных операций в тесте увеличивай при входе, уменьшай в finally; проверяй максимум, а не длительность по часам. Promise.all сам по себе не ограничивает запуск.

```ts
import { mapLimit } from './core.ts';

export type JobResult = { ok: true; value: string } | { ok: false; error: string };
export async function runJobs<T>(
  jobs: readonly T[], limit: number,
  execute: (job: T, index: number) => Promise<string>,
): Promise<JobResult[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('Invalid limit');
  return mapLimit<T, JobResult>(jobs, limit, async (job, index) => {
    try {
      return { ok: true, value: await execute(job, index) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
```

Рабочие функции — `examples/domains.ts`, проверки — `examples/domains.test.ts`. Перед новой попыткой закрой разбор и измени входные данные.

# Синхронизация профилей

## Задача: обновить профиль

`Profile = { id: string; displayName: string | null; tags: string[] }`. Патч имеет `displayName?: string | null` и `tags?: readonly string[]`. Отсутствующее поле сохраняет значение; null очищает имя; пустой массив очищает теги. Функция возвращает новый Profile, новый массив tags даже без патча и никогда не меняет вход. Явный undefined в патче запрещён при exactOptionalPropertyTypes. Вход уже проверен, у патча только собственные поля.

Проверь пустой патч, null, пустую строку (здесь разрешена), пустые tags и изменение результата после вызова.

### Спойлер

Сохрани id. Выбери имя через `patch.displayName !== undefined ? patch.displayName : current.displayName`: null и пустая строка должны сохраниться. Для tags сделай `[...(patch.tags ?? current.tags)]`. Здесь ?? подходит массиву, но не имени: null для имени означает очистку. Object spread сам по себе оставил бы общий вложенный массив. Optional и readonly — правила проверки типов, не runtime-валидация JSON. Для внешнего патча нужен отдельный parser.

```ts
export type Profile = { id: string; displayName: string | null; tags: string[] };
export type ProfilePatch = { displayName?: string | null; tags?: readonly string[] };
export function patchProfile(current: Profile, patch: ProfilePatch): Profile {
  return {
    id: current.id,
    displayName: patch.displayName !== undefined ? patch.displayName : current.displayName,
    tags: [...(patch.tags ?? current.tags)],
  };
}
```

Рабочие функции — `examples/domains.ts`, проверки — `examples/domains.test.ts`. Перед новой попыткой закрой разбор и измени входные данные.