import { mapLimit } from './core.ts';
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
