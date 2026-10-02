import { mapLimit } from './core.ts';

// catalog
export type StockEvent = {
  storeId: string;
  eventId: string;
  sku: string;
  version: number;
  stock: number;
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

// analytics
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

// jobs
export type JobResult = { ok: true; value: string } | { ok: false; error: string };
export async function runJobs<T>(
  jobs: readonly T[],
  limit: number,
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

// profiles
export type Profile = { id: string; displayName: string | null; tags: string[] };
export type ProfilePatch = { displayName?: string | null; tags?: readonly string[] };
export function patchProfile(current: Profile, patch: ProfilePatch): Profile {
  return {
    id: current.id,
    displayName: patch.displayName !== undefined ? patch.displayName : current.displayName,
    tags: [...(patch.tags ?? current.tags)],
  };
}
