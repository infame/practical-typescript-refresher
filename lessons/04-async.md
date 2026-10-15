# Async work and the event loop

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## When work starts

A `Promise` executor runs immediately; an `async` function starts running when called and pauses at `await`. Collecting already-created promises does not postpone their work.

To control the start, store functions or let workers call the operation. `await` does not turn CPU work into background parallel work.

```ts
async function example() {
  console.log("B");
  await Promise.resolve();
  console.log("D");
}
console.log("A");
const promise = example();
console.log("C");
await promise;
// A, B, C, D
```

```ts
const first = fetchFirst();
const second = fetchSecond();
const a = await first;
const b = await second;
```

## Sequential or concurrent

A loop with `await` performs operations sequentially. `Promise.all` can wait for independent operations concurrently and returns results in input order, not completion order.

map invokes its callback for every input immediately; `Promise.all` is not a concurrency limiter. Decide whether dependencies require sequencing or only the returned array requires stable order.

```ts
const results = [];
for (const item of items) {
  results.push(await processItem(item));
}
```

```ts
const results = await Promise.all(items.map(processItem));
```

```ts
const outcomes = await Promise.allSettled(items.map(processItem));
for (const outcome of outcomes) {
  if (outcome.status === "fulfilled") console.log(outcome.value);
  else console.error(outcome.reason);
}
```

## Errors and missing await

An unawaited promise can escape `try/catch`, finish after the function reports success, or reject without a handler. Await the actual operation within the try block when you need to catch its rejection.

`Promise.all` rejects on the first observed rejection but does not cancel the other operations. `Promise.allSettled` reports every outcome.

`finally` is for cleanup; a `return` or `throw` inside it can override the original result.

```ts
async function broken(items: Item[]) {
  items.forEach(async item => {
    await save(item);
  });
  return "done";
}
```

```ts
async function load() {
  try {
    return await fetchData();
  } catch (error) {
    throw new Error("Load failed", { cause: error });
  }
}
```

## Event-loop ordering

Synchronous code finishes before queued promise callbacks. An `await` continuation runs as a microtask. Timers are scheduled later and their delay is a lower bound, not a guaranteed execution instant.

A long synchronous computation blocks other callbacks; recursively scheduling microtasks can starve other work.

Node has additional queues, so do not generalize a tiny browser ordering example to every Node context.

```ts
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve()
  .then(() => console.log("C"))
  .then(() => console.log("D"));
queueMicrotask(() => console.log("E"));
console.log("F");
```

## Races on one thread

Two operations can read shared state before either resumes from `await` and writes it. Single-threaded JavaScript does not make a read-`await`-write sequence atomic.

Preserve invariants with a serial queue per key, database conditional writes or an appropriate transaction. Concurrency and parallel CPU execution are different concepts.

```ts
async function increment() {
  const old = counter;
  await delay();
  counter = old + 1;
}
```

## Practice

Predict the order of synchronous logs, `Promise.then` and `setTimeout`. Then explain why `try/catch` around a call without `await` fails to catch its later rejection.

### Spoiler

For the code above the exact order is **A, F, C, E, D, B**. A and F are synchronous. The first then queues C; `queueMicrotask` queues E. Only when C completes does its returned promise enqueue D, so E precedes D. The timer runs after the microtask queue drains.

Wrapping CPU-heavy work in an `async` function does not move that work to another thread.

Synchronous logs come first, then promise microtasks, then the timer callback in the demonstrated context. Put `await` inside `try/catch` or return a promise with an explicit rejection handler. For shared state, check whether an `await` separates the read and the write.

#### A plausible wrong solution: race means cancellation

```ts check
async function demonstrateRace(): Promise<boolean> {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let completed = false;
  const work = gate.then(() => { completed = true; return 42; });
  try {
    await Promise.race([work, Promise.reject(new Error("Timeout"))]);
  } catch {
    // The caller stopped waiting; the underlying work still exists.
  }
  release();
  await work;
  return completed; // true
}
```

The rejected deadline settles the race, not work. Releasing the controlled gate proves the losing operation still completes; the example needs no timing guesses.

A real timeout should pass `AbortSignal` to an operation that supports it, and clear the timer in finally. Cancellation is cooperative: a non-supporting dependency will not stop merely because a signal was set.

Decide how to observe or drain unfinished work.

## Explain concurrency

Name the order guarantee, maximum active work and failure policy separately. “Concurrent but returned in input order” is a valid combination; it requires storing results by input index.

## Official references

- [MDN: all](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
