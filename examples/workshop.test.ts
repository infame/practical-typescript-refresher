import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyPatch, loadAll, memoizeAsync, parsePriceRecord } from './workshop.ts';

test('strict parser accepts decimal price but rejects coercion shortcuts', () => {
  assert.deepEqual(parsePriceRecord({ id: ' a ', price: ' 12.50 ', extra: 42 }), {
    id: 'a',
    price: 12.5,
  });
  assert.deepEqual(parsePriceRecord({ id: 'a', price: 0 }), { id: 'a', price: 0 });
  for (const price of [
    '',
    ' ',
    '1e3',
    '0x10',
    '2usd',
    '-1',
    '.5',
    '1.',
    true,
    null,
    undefined,
    NaN,
    Infinity,
  ]) {
    assert.throws(() => parsePriceRecord({ id: 'a', price }));
  }
  for (const raw of [null, [], { id: ' ', price: 1 }, { id: 'a' }])
    assert.throws(() => parsePriceRecord(raw));
});
test('patch distinguishes missing, null, zero and copies nested array', () => {
  const original = Object.freeze({ id: 'a', price: 10, tags: Object.freeze(['x']) });
  const unchanged = applyPatch(original, {});
  assert.deepEqual(unchanged, original);
  assert.notEqual(unchanged, original);
  assert.notEqual(unchanged.tags, original.tags);
  assert.equal(applyPatch(original, { price: null }).price, null);
  assert.equal(applyPatch(original, { price: 0 }).price, 0);
  const tags: string[] = [];
  const changed = applyPatch(original, { tags });
  assert.deepEqual(changed.tags, []);
  assert.notEqual(changed.tags, tags);
});
test('memoization shares pending promise and caches undefined', async () => {
  let calls = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const load = memoizeAsync(async (_key: string) => {
    calls++;
    await barrier;
    return undefined;
  });
  const first = load('a'),
    second = load('a');
  assert.equal(first, second);
  release();
  await Promise.all([first, second]);
  await load('a');
  assert.equal(calls, 1);
});
test('memoization evicts failed async and synchronous operations', async () => {
  let calls = 0;
  const error = new Error('temporary');
  const load = memoizeAsync((_key: string): Promise<number> => {
    if (++calls === 1) throw error;
    return Promise.resolve(7);
  });
  let first: Promise<number> | undefined;
  assert.doesNotThrow(() => {
    first = load('a');
  });
  await assert.rejects(first!, (e) => e === error);
  assert.equal(await load('a'), 7);
  assert.equal(calls, 2);
  let asyncCalls = 0;
  const asyncLoad = memoizeAsync(async (_key: string) => {
    if (++asyncCalls === 1) throw error;
    return 2;
  });
  await assert.rejects(asyncLoad('a'));
  assert.equal(await asyncLoad('a'), 2);
});
test('loadAll preserves partial errors including unknown thrown values', async () => {
  const results = await loadAll(['a', 'b', 'c'], 2, async (id) => {
    if (id === 'b') throw undefined;
    return id.toUpperCase();
  });
  assert.deepEqual(results, [
    { status: 'loaded', id: 'a', value: 'A' },
    { status: 'failed', id: 'b', message: 'undefined' },
    { status: 'loaded', id: 'c', value: 'C' },
  ]);
  await assert.rejects(
    loadAll([], 0, async () => 1),
    RangeError,
  );
});
