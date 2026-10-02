import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const s = await import(pathToFileURL(process.env.TS_SUBMISSION).href);
const gate = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const packet = (overrides = {}) => ({ source: 's', id: 'a', version: 1, price: 12, ...overrides });

test('T1 valid numbers and null', () => {
  assert.deepEqual(s.parsePacket(packet({ price: 0 })), packet({ price: 0 }));
  assert.deepEqual(s.parsePacket(packet({ price: null })), packet({ price: null }));
});
test('T1 normalization and decimal format', () => {
  assert.deepEqual(
    s.parsePacket(packet({ source: ' s ', id: ' a ', price: ' 12.50 ' })),
    packet({ price: 12.5 }),
  );
  for (const price of ['', ' ', '1e3', '0x10', '12usd', '-1', '.5', '1.', true, false, undefined])
    assert.throws(() => s.parsePacket(packet({ price })), Error);
});
test('T1 shape and numeric validity', () => {
  for (const raw of [
    null,
    [],
    1,
    {},
    packet({ version: '1' }),
    packet({ version: 1.5 }),
    packet({ version: -1 }),
    packet({ version: Number.MAX_SAFE_INTEGER + 1 }),
    packet({ price: NaN }),
    packet({ price: Infinity }),
    packet({ source: ' ' }),
  ])
    assert.throws(() => s.parsePacket(raw), Error);
});
test('T1 new clean object without mutation', () => {
  const input = Object.freeze({ ...packet(), extra: 42 });
  const output = s.parsePacket(input);
  assert.deepEqual(output, packet());
  assert.notEqual(output, input);
});
test('T2 preserve omitted values and clone tags', () => {
  const current = Object.freeze({ id: 'a', price: 2, tags: Object.freeze(['x']) });
  const output = s.applyPatch(current, {});
  assert.deepEqual(output, current);
  assert.notEqual(output, current);
  assert.notEqual(output.tags, current.tags);
});
test('T2 null and zero semantics', () => {
  const current = { id: 'a', price: 10, tags: ['x'] };
  assert.equal(s.applyPatch(current, { price: null }).price, null);
  assert.equal(s.applyPatch(current, { price: 0 }).price, 0);
  assert.equal(current.price, 10);
});
test('T2 replacement is cloned and empty tags respected', () => {
  const current = { id: 'a', price: 10, tags: ['x'] };
  const tags = ['new'];
  const result = s.applyPatch(current, { tags });
  assert.deepEqual(result.tags, tags);
  assert.notEqual(result.tags, tags);
  assert.deepEqual(s.applyPatch(current, { tags: [] }).tags, []);
});
test('T3 dedup count latest and stable order', () => {
  const events = [
    { source: 's', eventId: 'e1', listingId: 'a', version: 5, price: 50 },
    { source: 's', eventId: 'e2', listingId: 'b', version: 1, price: 10 },
    { source: 's', eventId: 'e3', listingId: 'a', version: 3, price: 30 },
    { source: 's', eventId: 'e1', listingId: 'a', version: 9, price: 90 },
    { source: 's', eventId: 'e4', listingId: 'a', version: 5, price: 55 },
  ];
  assert.deepEqual(s.summarize(events), [
    { source: 's', listingId: 'a', version: 5, price: 50, count: 3 },
    { source: 's', listingId: 'b', version: 1, price: 10, count: 1 },
  ]);
});
test('T3 composite keys with delimiters', () => {
  const events = [
    { source: 'x:y', eventId: 'e', listingId: 'z', version: 1, price: 1 },
    { source: 'x', eventId: 'e', listingId: 'y:z', version: 2, price: 2 },
  ];
  assert.deepEqual(s.summarize(events), [
    { source: 'x:y', listingId: 'z', version: 1, price: 1, count: 1 },
    { source: 'x', listingId: 'y:z', version: 2, price: 2, count: 1 },
  ]);
});
test('T3 repeated identity reassigned to another listing is ignored', () => {
  assert.deepEqual(
    s.summarize([
      { source: 's', eventId: 'e', listingId: 'a', version: 1, price: 1 },
      { source: 's', eventId: 'e', listingId: 'b', version: 2, price: 2 },
    ]),
    [{ source: 's', listingId: 'a', version: 1, price: 1, count: 1 }],
  );
});
test('T3 empty and immutable', () => {
  assert.deepEqual(s.summarize([]), []);
  const e = Object.freeze({ source: 's', eventId: 'e', listingId: 'a', version: 1, price: 1 });
  assert.deepEqual(s.summarize(Object.freeze([e])), [
    { source: 's', listingId: 'a', version: 1, price: 1, count: 1 },
  ]);
});
test('T4 validation and empty', async () => {
  assert.deepEqual(await s.mapLimit([], 2, async () => 1), []);
  for (const limit of [0, -1, 1.5, NaN, Infinity])
    await assert.rejects(
      s.mapLimit([], limit, async () => 1),
      RangeError,
    );
});
test('T4 ceiling order and replacement worker', async () => {
  const gates = [gate(), gate(), gate()];
  const third = gate();
  let active = 0,
    peak = 0;
  const started = [];
  const p = s.mapLimit([0, 1, 2], 2, async (i) => {
    started.push(i);
    active++;
    peak = Math.max(peak, active);
    if (i === 2) third.resolve();
    const v = await gates[i].promise;
    active--;
    return v;
  });
  assert.deepEqual(started, [0, 1]);
  gates[1].resolve('b');
  await third.promise;
  assert.deepEqual(started, [0, 1, 2]);
  gates[2].resolve('c');
  gates[0].resolve('a');
  assert.deepEqual(await p, ['a', 'b', 'c']);
  assert.equal(peak, 2);
});
test('T4 failure drains before rejecting', async () => {
  const slow = gate();
  const err = new Error('failure');
  const started = [];
  let settled = false;
  const p = s.mapLimit([0, 1, 2, 3], 2, async (i) => {
    started.push(i);
    if (i === 1) throw err;
    return slow.promise;
  });
  const assertion = assert.rejects(p, (e) => e === err);
  p.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await tick();
  assert.deepEqual(started, [0, 1]);
  assert.equal(settled, false);
  slow.resolve(0);
  await assertion;
});
test('T4 undefined sync throw is still rejection', async () => {
  let caught = false;
  try {
    await s.mapLimit([1], 1, () => {
      throw undefined;
    });
  } catch (e) {
    caught = true;
    assert.equal(e, undefined);
  }
  assert.equal(caught, true);
});
test('T4 undefined results serial and excess limit', async () => {
  assert.deepEqual(await s.mapLimit([1, 2], 1, async () => undefined), [undefined, undefined]);
  assert.deepEqual(await s.mapLimit([1], 10, async (n) => n), [1]);
});
test('T5 in-flight coalescing and independent keys', async () => {
  const pending = gate();
  let calls = 0;
  const load = s.memoizeAsync(async (key) => {
    calls++;
    return key === 'a' ? pending.promise : 'b';
  });
  const a = load('a'),
    another = load('a'),
    b = load('b');
  assert.equal(await b, 'b');
  assert.equal(calls, 2);
  pending.resolve('a');
  assert.deepEqual(await Promise.all([a, another]), ['a', 'a']);
  assert.equal(await load('a'), 'a');
  assert.equal(calls, 2);
});
test('T5 caches undefined success', async () => {
  let calls = 0;
  const load = s.memoizeAsync(async () => {
    calls++;
    return undefined;
  });
  assert.equal(await load('a'), undefined);
  assert.equal(await load('a'), undefined);
  assert.equal(calls, 1);
});
test('T5 rejection evicts and all callers fail', async () => {
  let calls = 0;
  const error = new Error('fail');
  const pending = gate();
  const load = s.memoizeAsync(() => {
    calls++;
    return calls === 1 ? pending.promise : Promise.resolve(4);
  });
  const p1 = load('a'),
    p2 = load('a');
  const a1 = assert.rejects(p1, (e) => e === error),
    a2 = assert.rejects(p2, (e) => e === error);
  pending.reject(error);
  await Promise.all([a1, a2]);
  assert.equal(await load('a'), 4);
  assert.equal(calls, 2);
});
test('T5 synchronous throw becomes retryable rejection', async () => {
  let calls = 0;
  const error = new Error('sync');
  const load = s.memoizeAsync(() => {
    if (++calls === 1) throw error;
    return Promise.resolve(5);
  });
  let promise;
  assert.doesNotThrow(() => {
    promise = load('a');
  });
  await assert.rejects(promise, (e) => e === error);
  assert.equal(await load('a'), 5);
});
test('T6 outcomes and unknown errors', async () => {
  const events = [
    { id: 'a', version: 1 },
    { id: 'b', version: 1 },
    { id: 'c', version: 1 },
    { id: 'd', version: 1 },
  ];
  const r = await s.processEvents(
    events,
    {
      write: async (e) => {
        if (e.id === 'b') throw 'bad';
        if (e.id === 'd') throw undefined;
        return e.id === 'a' ? 'applied' : 'stale';
      },
    },
    2,
  );
  assert.deepEqual(r, [
    { status: 'applied', id: 'a', index: 0 },
    { status: 'failed', id: 'b', index: 1, message: 'bad' },
    { status: 'stale', id: 'c', index: 2 },
    { status: 'failed', id: 'd', index: 3, message: 'undefined' },
  ]);
});
test('T6 bounded and await completion', async () => {
  const gates = [gate(), gate(), gate()];
  const third = gate();
  let active = 0,
    peak = 0;
  const started = [];
  const p = s.processEvents(
    [
      { id: '0', version: 1 },
      { id: '1', version: 1 },
      { id: '2', version: 1 },
    ],
    {
      write: async (e) => {
        const i = Number(e.id);
        active++;
        peak = Math.max(peak, active);
        started.push(i);
        if (i === 2) third.resolve();
        const r = await gates[i].promise;
        active--;
        return r;
      },
    },
    2,
  );
  assert.deepEqual(started, [0, 1]);
  gates[1].resolve('stale');
  await third.promise;
  gates[2].resolve('applied');
  gates[0].resolve('applied');
  assert.deepEqual(
    (await p).map((r) => r.id),
    ['0', '1', '2'],
  );
  assert.equal(peak, 2);
});
test('T6 sync storage error is per-record', async () => {
  const r = await s.processEvents(
    [{ id: 'a', version: 1 }],
    {
      write: () => {
        throw new Error('sync');
      },
    },
    1,
  );
  assert.deepEqual(r, [{ status: 'failed', id: 'a', index: 0, message: 'sync' }]);
});
test('T6 invalid limit rejects even when empty', async () => {
  await assert.rejects(s.processEvents([], { write: async () => 'applied' }, 0), RangeError);
});
