# Практика в выбранном домене

## 1. Проверить одно обновление

Реализуй `parseEntity(value: unknown): EntityUpdate`. При невалидном входе бросай `Error`; null или undefined вместо ошибки не возвращаются. Нужны собственные непустые строки sourceId, eventId и entityId с trim; version — безопасное целое ≥ 0; metric — конечное число ≥ 0. Запрети null, массивы, числовые строки и отсутствующие поля. Верни новый объект, игнорируй лишние поля. Числовое поле — метрика выбранного домена в упрощённом контракте, а не универсальное правило бизнеса.

### Спойлер

Сначала исключи null и массивы, затем проверь тип и допустимость каждого поля. Если другой контракт разрешает строки, сначала проверь синтаксис. Локальная assertion Record применяется только к уже проверенному объекту: каждое поле всё равно проверяется в runtime. Она не объявляет весь вход валидным.

```ts
export type EntityUpdate = {
  sourceId: string;
  eventId: string;
  entityId: string;
  version: number;
  metric: number;
};
export function parseEntity(value: unknown): EntityUpdate {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected object');
  const object = value;
  function text(key: string): string {
    if (!Object.hasOwn(object, key)) throw new Error(`Missing ${key}`);
    const field = (object as Record<string, unknown>)[key];
    if (typeof field !== 'string' || !field.trim()) throw new Error(`Invalid ${key}`);
    return field.trim();
  }
  if (
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0
  )
    throw new Error('Invalid version');
  if (
    !('metric' in value) ||
    typeof value.metric !== 'number' ||
    !Number.isFinite(value.metric) ||
    value.metric < 0
  )
    throw new Error('Invalid metric');
  return {
    sourceId: text('sourceId'),
    eventId: text('eventId'),
    entityId: text('entityId'),
    version: value.version,
    metric: value.metric,
  };
}
```

## 2. Дедупликация и последняя версия

Вход уже валиден. eventId уникален внутри sourceId; повтор неизменяем. Выбери максимум version по sourceId/entityId, первую запись при равенстве и порядок первого появления сущности. Не меняй вход. Проверь одинаковый ID у двух источников, обратные версии, повтор и разделители внутри IDs.

### Спойлер

Нужны два независимых ключа: Set доставленных событий и Map последних состояний. JSON-пара исключает коллизии разделителей. Обновляй только при большей версии; Map сохраняет позицию ключа. Это дедупликация одного batch, а не долговечный inbox; память O(события + сущности).

```ts
export type EntityUpdate = {
  sourceId: string;
  eventId: string;
  entityId: string;
  version: number;
  metric: number;
};
export function latestEntities(input: readonly EntityUpdate[]): EntityUpdate[] {
  const seen = new Set<string>();
  const latest = new Map<string, EntityUpdate>();
  for (const entity of input) {
    const eventKey = JSON.stringify([entity.sourceId, entity.eventId]);
    if (seen.has(eventKey)) continue;
    seen.add(eventKey);
    const entityKey = JSON.stringify([entity.sourceId, entity.entityId]);
    const current = latest.get(entityKey);
    if (!current || entity.version > current.version) latest.set(entityKey, entity);
  }
  return [...latest.values()];
}
```

## 3. Обработка с частичными ошибками

Вход — проверенные сущности, положительный безопасный целый limit и save(entity): Promise<void>. Ограничь активные записи, сохрани порядок результатов, продолжай после ошибки одной записи и верни ok-union для каждой. Невалидный limit отклоняет даже пустой batch. Синхронный throw и throw undefined тоже ошибки.

### Спойлер

Поймай ошибку внутри callback limiter: ожидаемые ошибки станут значениями. Дождись save перед успехом и явно сузь Error. mapLimit из главы 5 и examples/core.ts импортируется, а не копируется. Аннотация union сохраняет литеральные дискриминаторы.

```ts
import { mapLimit } from './core.ts';
export type EntityUpdate = {
  sourceId: string;
  eventId: string;
  entityId: string;
  version: number;
  metric: number;
};
export type Outcome = { ok: true; entity: EntityUpdate } | { ok: false; error: string };
export async function processEntities(
  input: readonly EntityUpdate[],
  limit: number,
  save: (entity: EntityUpdate) => Promise<void>,
): Promise<Outcome[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('Invalid limit');
  return mapLimit<EntityUpdate, Outcome>(input, limit, async (entity) => {
    try {
      await save(entity);
      return { ok: true, entity };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
```

## Проверить попытку

Проверь ноль, отсутствие поля, повтор события, равные и старые версии, области уникальности, обратный порядок завершения, синхронный throw и невалидный limit. Запусти npm run check и npm test. Затем измени политику ошибки или добавь поле и напиши заново без ответа.
