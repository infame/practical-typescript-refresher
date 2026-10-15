# Fetching data: pages, timeouts and retries

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## HTTP failure is not necessarily rejection

fetch can resolve normally for 404, 429 or 500. Check `response.ok` or status, then parse the body and validate it as a separate step.

A timeout must cancel or otherwise bound the operation; `Promise.race` alone only stops waiting and leaves the losing work running.

Pass an `AbortSignal` to supported operations and clean up timers in finally. The examples are patterns, not a universal production retry policy.

```ts
async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be positive and finite");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const value: unknown = await response.json();
    return value;
  } finally {
    clearTimeout(timer);
  }
}
```

## Which failures to retry

Retry only failures that the operation contract treats as transient and safe. Typical candidates include selected network failures, 429 and selected 5xx responses; validation errors and most 4xx responses usually need a changed request.

Use bounded attempts, a total time budget, exponential backoff and jitter; consider Retry-After.

A retry can duplicate a write whose response was lost, so idempotency belongs in the design. Avoid multiplying retries across layers.

```ts
const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

async function retry<T>(
  operation: () => Promise<T>,
  attempts: number,
  shouldRetry: (error: unknown) => boolean,
): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError("attempts must be a positive integer");
  }
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === attempts - 1 || !shouldRetry(error)) throw error;
      const ceiling = Math.min(5000, 200 * 2 ** attempt);
      await sleep(Math.random() * ceiling);
    }
  }
  throw new Error("Unreachable");
}
```

## Cursor pagination

Read a page, process it, then advance to its next cursor. Detect repeated cursors instead of looping forever.

Cursor semantics and snapshot consistency come from the API; deduplication cannot recover records never delivered.

Decide whether individual page failures stop the import, retry that page or produce a resumable report. Do not advance the checkpoint before the page has been durably processed.

```ts
type Page<T> = { items: T[]; nextCursor: string | null };

async function* pages<T>(
  load: (cursor: string | undefined) => Promise<Page<T>>,
): AsyncGenerator<T[]> {
  let cursor: string | undefined;
  const seen = new Set<string>();
  while (true) {
    const page = await load(cursor);
    yield page.items;
    if (page.nextCursor === null) return;
    if (seen.has(page.nextCursor)) throw new Error("Cursor cycle");
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}
```

```ts
for await (const batch of pages(loadPage)) {
  await mapLimit(batch, 8, processRecord);
}
```

## Checkpoint and backpressure

Limit processing per page and persist the cursor after successful processing. This bounds memory without retaining the entire dataset.

In a stream, consumers must slow producers or buffer only within a declared bound.

A checkpoint should correspond to completed durable effects, not merely received data. Recovery must tolerate replay of already-completed work.

## Practice

An API returns an endless repeated cursor and sometimes 429. What state should the importer keep, which failures are retried, and when is the checkpoint written?

### Spoiler

Keep visited cursors or another explicit progress guard, bound retries and respect the operation time budget. Process the current page with a limiter, then commit its checkpoint. Retry a transient page fetch; do not hide malformed payloads as successful empty pages. Ensure processing is replay-safe before relying on checkpoints.

## Official references

- [Node.js: stream](https://nodejs.org/api/stream.html)
