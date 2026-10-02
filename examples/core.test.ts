import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importUpdates, mapLimit, MemoryRepository, parseUpdate } from './core.ts';
import type { ListingUpdate, Repository } from './core.ts';

function gate<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const update = (version: number, overrides: Partial<ListingUpdate> = {}): ListingUpdate => ({
  sourceId: 's',
  listingId: 'a',
  eventId: `e${version}`,
  version,
  price: 500,
  ...overrides,
});

test('empty input and invalid limits', async () => {
  assert.deepEqual(await mapLimit([], 2, async () => 1), []);
  for (const limit of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(
      mapLimit([], limit, async () => 1),
      RangeError,
    );
  }
});

test('concurrency ceiling, work conservation and input ordering', async () => {
  const gates = [gate<number>(), gate<number>(), gate<number>()];
  const thirdStarted = gate<void>();
  const started: number[] = [];
  let active = 0;
  let peak = 0;
  const pending = mapLimit([0, 1, 2], 2, async (index) => {
    started.push(index);
    active++;
    peak = Math.max(peak, active);
    if (index === 2) thirdStarted.resolve();
    const result = await gates[index]!.promise;
    active--;
    return result;
  });
  assert.deepEqual(started, [0, 1]);
  gates[1]!.resolve(20);
  await thirdStarted.promise;
  assert.deepEqual(started, [0, 1, 2]);
  gates[2]!.resolve(30);
  gates[0]!.resolve(10);
  assert.deepEqual(await pending, [10, 20, 30]);
  assert.equal(peak, 2);
});

test('stops scheduling after observed error and drains active operations', async () => {
  const slow = gate<number>();
  const failure = new Error('failed');
  const started: number[] = [];
  let settled = false;
  const pending = mapLimit([0, 1, 2, 3], 2, async (index) => {
    started.push(index);
    if (index === 1) throw failure;
    return slow.promise;
  });
  const assertion = assert.rejects(pending, (error) => error === failure);
  pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(started, [0, 1]);
  assert.equal(settled, false);
  slow.resolve(10);
  await assertion;
  assert.equal(settled, true);
});

test('handles synchronous throw including undefined', async () => {
  let rejected = false;
  try {
    await mapLimit([1], 3, () => {
      throw undefined;
    });
  } catch (error) {
    rejected = true;
    assert.equal(error, undefined);
  }
  assert.equal(rejected, true);
});

test('limit one preserves serial execution; excess workers do not duplicate input', async () => {
  const started: number[] = [];
  assert.deepEqual(
    await mapLimit([1, 2], 1, async (n) => {
      started.push(n);
      return n * 2;
    }),
    [2, 4],
  );
  assert.deepEqual(started, [1, 2]);
  assert.deepEqual(await mapLimit([1], 50, async (n) => n), [1]);
});

test('parser rejects malformed input and preserves zero without mutating', () => {
  for (const value of [
    null,
    [],
    {},
    update(1, { price: NaN }),
    update(-1),
    update(1, { price: Infinity }),
    update(1, { sourceId: ' ' }),
    { ...update(1), price: '500' },
    update(Number.MAX_SAFE_INTEGER + 1),
  ]) {
    assert.throws(() => parseUpdate(value));
  }
  const original = Object.freeze(update(0, { price: 0 }));
  const parsed = parseUpdate(original);
  assert.deepEqual(parsed, original);
  assert.notEqual(parsed, original);
});

test('import reports each outcome and leaves maximum version per source/listing', async () => {
  const memory = new MemoryRepository();
  const repository: Repository = {
    async upsertIfNewer(value) {
      if (value.listingId === 'broken') throw new Error('DB unavailable');
      return memory.upsertIfNewer(value);
    },
  };
  const input = [
    update(5),
    update(3),
    { price: 'bad' },
    update(1, { listingId: 'broken' }),
    update(5),
    update(1, { sourceId: 'other' }),
  ];
  const before = structuredClone(input);
  const results = await importUpdates(input, repository, 2);
  assert.deepEqual(
    results.map((r) => r.status),
    ['applied', 'stale', 'invalid', 'failed', 'stale', 'applied'],
  );
  assert.deepEqual(
    results.map((r) => r.index),
    [0, 1, 2, 3, 4, 5],
  );
  assert.equal(memory.records.get(JSON.stringify(['s', 'a']))?.version, 5);
  assert.equal(memory.records.get(JSON.stringify(['other', 'a']))?.version, 1);
  assert.deepEqual(input, before);
});

test('import awaits repository completion', async () => {
  const write = gate<'applied'>();
  let finished = false;
  const pending = importUpdates([update(1)], { upsertIfNewer: () => write.promise }, 1);
  pending.then(() => {
    finished = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(finished, false);
  write.resolve('applied');
  assert.equal((await pending)[0]?.status, 'applied');
});
