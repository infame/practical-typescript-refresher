import { mapLimit } from './core.ts';

export function parsePriceRecord(raw: unknown): { id: string; price: number } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error('Expected an object');
  if (!('id' in raw) || typeof raw.id !== 'string' || raw.id.trim() === '')
    throw new Error('Invalid id');
  if (!('price' in raw)) throw new Error('Missing price');
  let price: number;
  if (typeof raw.price === 'number') price = raw.price;
  else if (typeof raw.price === 'string' && /^\d+(\.\d+)?$/.test(raw.price.trim()))
    price = Number(raw.price.trim());
  else throw new Error('Invalid price format');
  if (!Number.isFinite(price) || price < 0) throw new Error('Invalid price');
  return { id: raw.id.trim(), price };
}
export type Current = { id: string; price: number | null; tags: readonly string[] };
export type Patch = { price?: number | null; tags?: readonly string[] };
export function applyPatch(current: Current, patch: Patch): Current {
  return {
    id: current.id,
    price: patch.price === undefined ? current.price : patch.price,
    tags: [...(patch.tags ?? current.tags)],
  };
}
export function memoizeAsync<K, V>(load: (key: K) => Promise<V>): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return (key) => {
    const existing = cache.get(key);
    if (existing !== undefined) return existing;
    const pending = Promise.resolve()
      .then(() => load(key))
      .catch((error) => {
        cache.delete(key);
        throw error;
      });
    cache.set(key, pending);
    return pending;
  };
}
export type Outcome<T> =
  { status: 'loaded'; id: string; value: T } | { status: 'failed'; id: string; message: string };
export function loadAll<T>(
  ids: readonly string[],
  limit: number,
  load: (id: string) => Promise<T>,
): Promise<Outcome<T>[]> {
  return mapLimit(ids, limit, async (id): Promise<Outcome<T>> => {
    try {
      return { status: 'loaded', id, value: await load(id) };
    } catch (error) {
      return {
        status: 'failed',
        id,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
