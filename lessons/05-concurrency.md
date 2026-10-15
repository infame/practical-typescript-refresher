# Implement a concurrency limiter

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## Define the contract first

`mapLimit` accepts an input array, a positive integer limit and an `async` callback. It returns an array in input order and never has more than limit active callbacks.

This version stops scheduling after observing a failure, waits for already-active work, then rejects with the first observed error.

Validate the limit even for an empty input. Use a separate failure `boolean` because `undefined` is a legal thrown value.

## Workers instead of batches

Create at most `min(limit, items.length)` workers sharing a synchronous iterator. Each worker takes one index, awaits the callback and writes its result to that index.

Once a worker finishes, it immediately takes another item; fixed batches would wait for the slowest item in each batch and waste available capacity.

A results array can retain order while execution completes out of order.

```ts
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("limit must be a positive integer");
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

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  if (failed) throw firstError;
  return results;
}
```

## Why work is not duplicated

Obtaining the next iterator item happens synchronously before `await`. Another worker cannot interleave inside that operation in this single-threaded implementation. This is not a guarantee across `worker_threads` or multiple processes.

When a worker observes failure it changes a shared flag; others finish their active item and check the flag before requesting more.

## Partial outcomes as data

To keep processing after an individual failure, catch inside the callback and return a discriminated success/failure value. The limiter still handles unexpected failures of that wrapper according to its fail-fast contract. Do not silently substitute `null` when the caller needs the reason and the input position.

```ts
type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

const outcomes = await mapLimit(items, 4, async (item): Promise<Outcome<Saved>> => {
  try {
    return { ok: true, value: await save(item) };
  } catch (error) {
    return { ok: false, error };
  }
});
```

## What a limit does not guarantee

A concurrency limit is not a requests-per-second rate limit, cancellation, a retry budget or a per-key ordering guarantee. Slow tasks can hang all workers unless operations have timeouts or cancellation.

Huge input and result arrays still consume memory; an unbounded stream needs a streaming contract and backpressure.

## Practice

Implement the limiter without reading the solution. Try variable delays, one early error, a synchronous throw, `throw undefined` and an empty array with an invalid limit.

### Spoiler

Reserve indices before awaiting, use a shared failure flag and store the first error independently. Drain active workers with `Promise.all` before rethrowing. This makes the timing of rejection predictable and avoids claiming that active work was cancelled.

#### A plausible wrong solution: limit promises after starting them

```ts check
async function demonstrateEagerStart(): Promise<number[]> {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started: number[] = [];
  const load = async (id: number): Promise<number> => {
    started.push(id);
    await gate;
    return id;
  };
  const promises = [1, 2, 3].map(load);
  // All three are active now; awaiting promises one by one cannot undo that.
  const beforeWaiting = [...started]; // [1, 2, 3]
  release();
  await Promise.all(promises);
  return beforeWaiting;
}
```

Workers must receive items or functions that start work, not already-running promises. For a limit of two, the third load must not start until one of the first two settles. The gate shows that every call started and is blocked before any consumer waits.

Likewise, fixed groups of two preserve a ceiling but leave capacity idle when one task finishes early; a free worker should take the next item immediately.

## Test observable behavior

Track active operations and maximum concurrency, use deferred promises to control completion, check input-order output and verify that no additional items start after observed failure. Avoid sleep-based tests that depend on wall-clock scheduling. Include limit one and a limit larger than the input.
