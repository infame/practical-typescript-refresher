# Practice in your selected domain

## 1. Parse one update

Implement `parseEntity(value: unknown): EntityUpdate`. Throw an `Error` on invalid input; invalid input does not return null or undefined. Require own nonempty sourceId, eventId and entityId strings, normalize them with trim, require a nonnegative safe integer version and finite nonnegative numeric metric. Reject null, arrays, numeric strings and missing fields. Return a new object; unrelated fields are ignored. The numeric field represents the selected domain metric, not a claim that every real business metric follows this simplified contract.

### Spoiler

Exclude null and arrays first, then establish each field type and business condition. Validate syntax before conversion when a different contract allows strings. The local Record assertion below is restricted to an already-checked object; each field is still checked at runtime. It is not an assertion that the whole input is valid.

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

## 2. Deduplicate and keep the latest

Input is already valid. eventId is unique within sourceId; immutable duplicate deliveries count once. Select the highest version per sourceId/entityId, keep the first at equal version and preserve first entity appearance. Do not mutate input. Check one ID in two sources, reversed versions, duplicate events and separator characters in IDs.

### Spoiler

Use two independent keys. A Set records delivered events and a Map keeps entity winners. JSON encoding a pair avoids delimiter collisions. Replace only for a greater version; Map preserves the position of an existing key. This batch-only deduplication is not a durable inbox and retains O(events + entities) keys.

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

## 3. Process with partial failures

Accept already-validated entities, a positive safe integer limit and save(entity): Promise<void>. Bound active saves, preserve input result order, keep running after per-entity failures, and return an ok union for each entity. An invalid limit rejects even when input is empty. A synchronous throw and throw undefined are failures too.

### Spoiler

Catch inside the limiter callback so expected failures become values. Await save before reporting success. Keep Error narrowing explicit. mapLimit is the helper from chapter 5 and examples/core.ts; it is imported here rather than duplicated. Type the union result to preserve literal discriminators.

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

## Verify your attempt

Test zero, absent fields, a repeated event, equal and older versions, scope collisions, reversed completion, synchronous throw and invalid limit. Run npm run check and npm test. Then change the failure policy or add a new field and implement again without the answer.
