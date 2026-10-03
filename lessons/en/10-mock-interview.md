# Mock backend coding interview

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## The task

Implement importUpdates(raw, repository, concurrency). Input values are unknown. Valid records contain nonempty sourceId, eventId and entity ID, a nonnegative safe integer version and a finite nonnegative metric. Keep the maximum version per source/entity and skip equal versions. Report invalid, applied, stale and failed outcomes according to the demonstrated contract. Events at equal versions are immutable and there are no additional external effects.

## Plan the hour

Spend the first minutes clarifying validation, key scope, ordering and failure policy. Write types and one vertical path, then add the limiter and reporting. Use the last part for edge cases and explanation. A simpler correct implementation with explicit assumptions is better than an incomplete abstraction. Time spent on setup should happen before the interview.

## Starter contracts

The repository must offer an atomic upsertIfNewer rather than forcing the importer to read and then write. The parser handles external unknown input. Keep the concurrency helper generic and let the caller decide whether per-record errors become values. File implementations in examples/core.ts are the executable reference; domain-adjusted examples preserve the same algorithm.

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

Write the importer before opening the answer. Add tests for malformed input, a valid zero metric, v5 before v3, equal versions, failure of one repository write and completion of all active work.

### Spoiler

Validate each record at the boundary, keep identities in their correct scope, process with bounded concurrency and wait for every repository call covered by the return contract. The reference uses an atomic repository operation and records expected failures in the report.

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

## Follow-up: repeated delivery with effects

If processing sends a message or changes another resource, state selection alone is insufficient. Add an inbox/outbox protocol and downstream idempotency; specify recovery after each possible crash boundary. Do not present in-memory deduplication as durable coordination.

## Follow-up: an unbounded stream

Replace whole-input and whole-output arrays with async iteration, bounded work and an incremental report or sink. Define backpressure and a durable checkpoint. Do not retain every event ID forever without a retention or storage policy.

## Follow-up: ordering per key

A global concurrency cap does not serialize one entity. Atomic maximum-version writes are safe for this state-selection contract. Stateful transitions, increments and intermediate effects may need partitioned queues, a per-key lock or a different transaction protocol.

## Follow-up: retries

Retry selected transient failures with bounded attempts and a total budget. Decide which operation is replay-safe; a timeout does not prove that the write did not happen. Keep retry, deduplication and version selection as separate concepts.

## Assess the attempt

Count solved requirements and meaningful tests, but also identify unsafe assertions, unexplained assumptions and places where help was needed. Do not confuse reading the solution with independent implementation. Repeat with changed inputs and a different failure policy.

## Before an interview

Run the project, check the compiler settings and rehearse one problem under a timer. This is a backend/data-processing exercise, not a guarantee for any company or every interview format. A frontend, framework, system-design or advanced algorithm round needs separate preparation.

