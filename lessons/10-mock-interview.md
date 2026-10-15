# Mock backend coding interview

A 45–60 minute exercise in backend data processing. Clarify the contract, write the implementation, then compare it with the spoiler.

The executable reference is in `examples/core.ts`, with tests in `examples/core.test.ts`. Code blocks below share context.

## The task

Implement `importUpdates(raw, repository, concurrency)`. The input is a `readonly unknown[]`.

Each valid update contains:

- `sourceId`: a nonblank `string` identifying the supplying feed or system.
- `eventId`: a nonblank `string` identifying an emitted event within that source.
- `listingId`: a nonblank `string` identifying the entity within that source.
- `version`: a nonnegative safe integer ordering the state of that entity.
- `price`: a finite, nonnegative `number`. Numeric strings are invalid; zero is valid.

The state key is **`(sourceId, listingId)`**. Keep the maximum stored `version` for each key. Equal versions are immutable and must be skipped. There are no additional external side effects in this exercise.

The importer must:

1. Return exactly one result per input element, in input order.
2. Report malformed input as `invalid`, including its index and an explanation.
3. Report a completed write as `applied` or `stale`, including its index and `eventId`.
4. Report a repository error as `failed` and continue processing other inputs.
5. Keep at most `concurrency` repository calls active and `await` their completion.
6. Leave the input objects unchanged.

`concurrency` must be a positive integer; an invalid value rejects the whole call, including an empty batch. Individual record errors belong in the returned report.

**Do not remove repeated `eventId` values before processing.** This task needs a report for every input. The atomic version condition provides state idempotency; delivery deduplication is a separate contract.

## Plan the hour

| Time | Focus |
| --- | --- |
| 0–5 min | Clarify key scope, equal versions, partial failure and result order. |
| 5–15 min | Define types and implement validation. |
| 15–30 min | Connect the limiter, repository and report. |
| 30–45 min | Test invalid input, out-of-order versions and a failed write. |
| 45–60 min | Explain guarantees, complexity and follow-ups. |

Prepare the environment before starting the timer. If time is tight, first finish a correct sequential path, then add bounded concurrency.

## Starter contracts

`Repository.upsertIfNewer` must be **atomic**: compare the version and write as one storage operation. The importer must not replace that guarantee with a separate read followed by a write. You do not need to implement a real database here.

Keep responsibilities separate:

- `parseUpdate` validates one external value and returns a new `ListingUpdate`.
- `mapLimit` controls active work and preserves result positions.
- `importUpdates` turns expected per-record failures into report values.

```ts
type ListingUpdate = {
  sourceId: string;
  eventId: string;
  listingId: string;
  version: number;
  price: number;
};

interface Repository {
  upsertIfNewer(update: ListingUpdate): Promise<"applied" | "stale">;
}

type ImportResult =
  | { status: "applied" | "stale"; index: number; eventId: string }
  | { status: "invalid"; index: number; message: string }
  | { status: "failed"; index: number; eventId: string; message: string };
```

## Practice

Implement the parser, limiter and importer before opening the answer. Include these cases:

- Entity A at v5, followed by A at v3.
- An invalid numeric `string` and a valid zero value.
- Entity B at v1 whose repository call fails.
- A repeated A/v5 update.
- An invalid concurrency value, including with an empty input.

Check the returned order, the final stored versions and completion of all active work. Distinguish the final-state guarantee from the classification of individual writes.

### Spoiler

If A/v5 is applied before A/v3, their results are `applied` and `stale`. If v3 reaches storage first, both may be `applied`; the final state is still v5.

**The contract guarantees the maximum final version, not an identical per-record classification under every schedule.** Invalid input produces `invalid`; the failed B write produces `failed`; an equal version does not change state.

```ts
async function importUpdates(
  raw: readonly unknown[],
  repository: Repository,
  concurrency: number,
): Promise<ImportResult[]> {
  return mapLimit(raw, concurrency, async (value, index): Promise<ImportResult> => {
    let update: ListingUpdate;
    try {
      update = parseUpdate(value);
    } catch (error) {
      return { status: "invalid", index, message: messageOf(error) };
    }
    try {
      const status = await repository.upsertIfNewer(update);
      return { status, index, eventId: update.eventId };
    } catch (error) {
      return {
        status: "failed", index, eventId: update.eventId,
        message: messageOf(error),
      };
    }
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

The parser creates a fresh validated object. Local `catch` blocks turn record failures into results, so one failed write does not stop the batch. `mapLimit` retains input positions and waits for active work.

## Follow-up: repeated delivery with effects

Suppose an `applied` update must also send a notification. A crash after the database write but before sending makes the replay `stale`, so the notification can be lost.

Record the effect durably, for example with an outbox in the same transaction as the update. Delivery still needs an idempotency or deduplication policy. An in-memory set alone does not provide durable coordination.

## Follow-up: an unbounded stream

The current API retains the complete input and output: **`O(n)` memory**. Use `async` iteration, bounded active work and an incremental report or sink for a large stream.

Define backpressure and a durable checkpoint. Strict output order can make a slow first item hold back completed later items, so bound the completed-result buffer as well as active work.

## Follow-up: ordering per key

A global concurrency cap does not serialize updates to one entity. Atomic maximum-version writes are sufficient for this state-selection contract.

Increments, state transitions or intermediate effects may need a partitioned queue, a per-key lock or a different atomic business operation. State the required ordering before choosing the mechanism.

## Follow-up: retries

Retry only selected transient failures of operations that are safe to repeat, with bounded attempts and a total time budget.

A timeout can mean “the write happened but its response was lost”. Repeating the versioned upsert may return `stale` while leaving state correct. If the distinction between `applied` and `stale` matters, the report needs a policy for the uncertain first outcome.

## Assess the attempt

Review five things:

- **Contract:** are key scope, ties and output order explicit?
- **Validation:** do malformed input and valid zero behave correctly?
- **Concurrency:** is active work bounded, and is completion awaited?
- **Failures:** do record errors preserve other results and the final-state guarantee?
- **Explanation:** can you justify the implementation with meaningful tests?

Run `npm test` and `npm run check`. The in-memory repository is a test double; a real database needs separate integration checks for atomic writes and constraints.

## Before an interview

Confirm the language, environment, duration and rules for documentation or AI with the recruiter. Rehearse running the compiler and tests before the round.

Explain the requirements, algorithm, implementation, examples, complexity and limitations in that order. After reviewing the answer, change an input or failure policy and implement the variation independently.
