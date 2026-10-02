import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestStock, countViews, runJobs, patchProfile } from './domains.ts';

test('catalog: scoped identity, latest version, first tie, zero stock and no mutation', () => {
  const base = { storeId: 'a', eventId: '1', sku: 'x', version: 3, stock: 0 };
  const input = [
    base,
    { ...base, eventId: '2', version: 2, stock: 5 },
    { ...base, storeId: 'b' },
    { ...base, eventId: '3', stock: 7 },
    base,
  ];
  const snapshot = structuredClone(input);
  assert.deepEqual(latestStock(input), [base, { ...base, storeId: 'b' }]);
  assert.deepEqual(input, snapshot);
  const a = { ...base, storeId: 'a|b', sku: 'c' },
    b = { ...base, storeId: 'a', sku: 'b|c' };
  assert.deepEqual(latestStock([a, b]), [a, b]);
});
test('analytics: invalid events do not claim IDs, normalization and dedup', () => {
  assert.deepEqual(
    [
      ...countViews([
        null,
        [],
        { eventId: 'x', page: ' ', kind: 'view' },
        { eventId: ' x ', page: ' /home ', kind: 'view' },
        { eventId: 'x', page: '/home', kind: 'view' },
        { eventId: 'y', page: '/home', kind: 'view' },
        { eventId: 'z', page: '/other', kind: 'click' },
      ]),
    ],
    [['/home', 2]],
  );
});
test('jobs: bound concurrency, input order, partial errors, sync throw and validation', async () => {
  let active = 0,
    max = 0;
  const result = await runJobs([0, 1, 2, 3], 2, async (i) => {
    active++;
    max = Math.max(max, active);
    try {
      await Promise.resolve();
      if (i === 1) throw undefined;
      return String(i);
    } finally {
      active--;
    }
  });
  assert.equal(max, 2);
  assert.deepEqual(result, [
    { ok: true, value: '0' },
    { ok: false, error: 'undefined' },
    { ok: true, value: '2' },
    { ok: true, value: '3' },
  ]);
  assert.deepEqual(
    await runJobs([1], 1, () => {
      throw 'sync';
    }),
    [{ ok: false, error: 'sync' }],
  );
  assert.deepEqual(await runJobs([], 1, async () => ''), []);
  for (const limit of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(
      runJobs([], limit, async () => ''),
      RangeError,
    );
});
test('profiles: absent, null, empty string and arrays; independent copies', () => {
  const input = { id: 'a', displayName: 'A', tags: ['x'] };
  const copy = patchProfile(input, {});
  copy.tags.push('y');
  assert.deepEqual(input.tags, ['x']);
  assert.notEqual(copy, input);
  assert.deepEqual(patchProfile(input, { displayName: null, tags: [] }), {
    id: 'a',
    displayName: null,
    tags: [],
  });
  const tags = ['fresh'];
  const next = patchProfile(input, { displayName: '', tags });
  tags.push('later');
  assert.deepEqual(next.tags, ['fresh']);
  assert.equal(next.displayName, '');
});
