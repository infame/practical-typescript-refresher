import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEntity, latestEntities, processEntities } from './training-core.ts';
const sample = { sourceId: 's', eventId: 'e1', entityId: 'x', version: 2, metric: 0 };
test('shared domain parser: fresh normalized value, zero, malformed and own identifiers', () => {
  const input = { ...sample, entityId: ' x ' };
  assert.deepEqual(parseEntity(input), sample);
  assert.notEqual(parseEntity(sample), sample);
  for (const input of [
    null,
    [],
    {},
    { ...sample, version: 1.5 },
    { ...sample, metric: '0' },
    Object.create(sample),
  ])
    assert.throws(() => parseEntity(input));
});
test('shared domain versions: independent event/entity keys, scope, stable ties and collision-safe pairs', () => {
  const next = { ...sample, eventId: 'e2', version: 3 };
  const other = { ...sample, sourceId: 't' };
  assert.deepEqual(
    latestEntities([sample, other, next, next, { ...next, eventId: 'e3', metric: 9 }]),
    [next, other],
  );
  const a = { ...sample, sourceId: 'a|b', entityId: 'c' },
    b = { ...sample, sourceId: 'a', entityId: 'b|c' };
  assert.deepEqual(latestEntities([a, b]), [a, b]);
});
test('shared domain processing: completion, bounded activity, partial failure and invalid limit', async () => {
  let active = 0,
    max = 0,
    finished = 0;
  const records = [sample, { ...sample, eventId: 'e2' }, { ...sample, eventId: 'e3' }];
  const result = await processEntities(records, 2, async (e) => {
    active++;
    max = Math.max(max, active);
    try {
      await Promise.resolve();
      if (e.eventId === 'e2') throw undefined;
      finished++;
    } finally {
      active--;
    }
  });
  assert.equal(max, 2);
  assert.equal(finished, 2);
  assert.equal(active, 0);
  assert.deepEqual(result, [
    { ok: true, entity: records[0] },
    { ok: false, error: 'undefined' },
    { ok: true, entity: records[2] },
  ]);
  await assert.rejects(
    processEntities([], 0, async () => {}),
    RangeError,
  );
});
