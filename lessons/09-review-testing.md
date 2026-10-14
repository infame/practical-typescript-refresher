# Code review, debugging and tests

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## Review a broken importer

Look for an async forEach whose promises are not awaited, wrong deduplication scope, a truthiness check dropping zero, an assertion pretending to validate JSON, and a find-then-write race. Check both the returned report and when the function actually completes. Review the contract before optimizing or rewriting unfamiliar code.

```ts
async function importListings(records: any[]) {
  const errors: string[] = [];
  records.forEach(async record => {
    try {
      if (!record.price) return;
      const current = await db.find(record.id);
      if (!current) {
        await db.insert(record);
      } else {
        await db.update(record.id, record);
      }
    } catch (error: any) {
      errors.push(error.message);
    }
  });
  return { imported: records.length, errors };
}
```

### Spoiler

Compare the implementation with the stated contract. Explain which check establishes each guarantee before trying a new variation.

## Explain a bug with evidence

Give a concrete input, the expected result and the actual behavior. Then point to the invariant violated by the code. For async bugs, show the sequence of operations, not just a final value. A minimal reproducer is more useful than a general opinion about coding style.

## Test behavior through dependencies

Inject a repository or transport and make the fake record calls, defer completion or return a chosen error. Assert observable behavior: input validation, key scope, actual completion and failure policy. Mock only the boundary you need; do not copy the implementation into the test. Deterministic deferred promises reveal concurrency without relying on timers.

```ts
interface Repository {
  upsertIfNewer(update: ListingUpdate): Promise<"applied" | "stale">;
}
```

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { mapLimit } from "./core.ts";

test("respects concurrency", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapLimit([1, 2, 3, 4], 2, async value => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return value * 2;
  });
  assert.deepEqual(result, [2, 4, 6, 8]);
  assert.equal(peak, 2);
});
```

## Choose edge cases

Cover empty input, zero, null, missing fields, repeated delivery, equal and reversed versions, invalid limits, synchronous throw, throw undefined and reversed completion order. Test no mutation when that is promised. Concurrency, input-order output and per-key ordering are separate assertions.

## A minimal debugging loop

Reproduce the smallest failure, classify it as contract, data, type, runtime or scheduling, and change one cause. Keep a regression test for meaningful behavior. Run the relevant typecheck and test after the fix. Logging should identify the operation and input key without dumping secrets or huge payloads.

## Practice

The first limiter callback rejects while others are active. Which contract decisions should the test assert?

### Spoiler

Check whether new work stops, whether active operations are drained or cancelled, which error is returned and when rejection becomes visible. Tests should follow the chosen policy instead of assuming every limiter uses the same semantics.

## Explain the fix

Describe the triggering input, changed behavior and evidence. “The importer now waits for repository completion” states a user-visible guarantee; naming await alone does not.
