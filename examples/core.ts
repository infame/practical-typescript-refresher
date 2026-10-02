export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('limit must be a positive integer');
  }
  const iterator = items.entries();
  const results: R[] = new Array(items.length);
  let failed = false;
  let firstError: unknown;

  async function worker(): Promise<void> {
    while (!failed) {
      const next = iterator.next();
      if (next.done) return;
      const [index, item] = next.value;
      try {
        results[index] = await fn(item, index);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
        return;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  if (failed) throw firstError;
  return results;
}

export type ListingUpdate = {
  sourceId: string;
  eventId: string;
  listingId: string;
  version: number;
  price: number;
};
export type WriteStatus = 'applied' | 'stale';
export interface Repository {
  upsertIfNewer(update: ListingUpdate): Promise<WriteStatus>;
}
export type ImportResult =
  | { status: WriteStatus; index: number; eventId: string }
  | { status: 'invalid'; index: number; message: string }
  | { status: 'failed'; index: number; eventId: string; message: string };

export function parseUpdate(value: unknown): ListingUpdate {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an object');
  }
  if (!('sourceId' in value) || typeof value.sourceId !== 'string' || !value.sourceId.trim()) {
    throw new Error('Invalid sourceId');
  }
  if (!('eventId' in value) || typeof value.eventId !== 'string' || !value.eventId.trim()) {
    throw new Error('Invalid eventId');
  }
  if (!('listingId' in value) || typeof value.listingId !== 'string' || !value.listingId.trim()) {
    throw new Error('Invalid listingId');
  }
  if (
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0
  ) {
    throw new Error('Invalid version');
  }
  if (
    !('price' in value) ||
    typeof value.price !== 'number' ||
    !Number.isFinite(value.price) ||
    value.price < 0
  ) {
    throw new Error('Invalid price');
  }
  return {
    sourceId: value.sourceId,
    eventId: value.eventId,
    listingId: value.listingId,
    version: value.version,
    price: value.price,
  };
}

export async function importUpdates(
  raw: readonly unknown[],
  repository: Repository,
  concurrency: number,
): Promise<ImportResult[]> {
  return mapLimit(raw, concurrency, async (value, index): Promise<ImportResult> => {
    let update: ListingUpdate;
    try {
      update = parseUpdate(value);
    } catch (error) {
      return { status: 'invalid', index, message: errorMessage(error) };
    }
    try {
      const status = await repository.upsertIfNewer(update);
      return { status, index, eventId: update.eventId };
    } catch (error) {
      return { status: 'failed', index, eventId: update.eventId, message: errorMessage(error) };
    }
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// A single-process test double. There is no await between comparison and write.
// Production implementations must provide this guarantee atomically in the DB.
export class MemoryRepository implements Repository {
  readonly records = new Map<string, ListingUpdate>();
  async upsertIfNewer(update: ListingUpdate): Promise<WriteStatus> {
    const key = JSON.stringify([update.sourceId, update.listingId]);
    const current = this.records.get(key);
    if (current !== undefined && current.version >= update.version) return 'stale';
    this.records.set(key, { ...update });
    return 'applied';
  }
}
