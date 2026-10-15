# Events, idempotency and database writes

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## Duplicates and stale updates

Duplicate delivery asks whether an event was already handled. Stale update asks whether a newer entity version is already stored. Their keys differ.

Versions from unrelated sources are not automatically comparable; use a composite state key unless the domain defines a cross-source ordering. Identity resolution between providers is another business problem.

## Why find-then-insert races

Two callers can both observe a missing record before either inserts it. A JavaScript check does not replace a database uniqueness constraint. Enforce the composite key in storage and combine the condition with the write.

A transaction alone is not a magic substitute for choosing the correct constraint, isolation and atomic statement.

```ts
const existing = await db.find(id);
if (!existing) await db.insert(record);
else await db.update(id, record);
```

## Conditional upsert

An INSERT ON CONFLICT with a version condition can keep the highest version despite concurrent delivery. RETURNING distinguishes an applied update from a skipped one. The unique constraint must match the conflict target.

Equal versions are skipped in this contract, so their payloads must be immutable or a conflict rule is required. This example demonstrates state selection; it does not magically deduplicate external side effects.

```sql
CREATE TABLE listings (
  source_id text NOT NULL,
  listing_id text NOT NULL,
  version bigint NOT NULL CHECK (version >= 0),
  price_cents bigint NOT NULL CHECK (price_cents >= 0),
  PRIMARY KEY (source_id, listing_id)
);

INSERT INTO listings (source_id, listing_id, version, price_cents)
VALUES ($1, $2, $3, $4)
ON CONFLICT (source_id, listing_id)
DO UPDATE SET
  version = EXCLUDED.version,
  price_cents = EXCLUDED.price_cents
WHERE EXCLUDED.version > listings.version
RETURNING source_id, listing_id, version;
```

## Idempotent side effects

Email, payment or another external effect cannot safely be repeated merely because a record update is conditional. Combine an inbox marker and database changes in the same transaction; an outbox can atomically record work to publish later.

A downstream consumer still needs an idempotency key or deduplication policy.

Explain the failure window between commit and delivery rather than promising exactly-once behavior without assumptions.

## Deletion and old events

Physically removing version 5 can let late version 3 recreate the entity. A tombstone retains deletion state and version so old updates are rejected. Retention depends on replay and recovery windows. If a source can reset versions, the ordering contract must also include an epoch or another generation identifier.

## Write SQL by hand

Use ROW_NUMBER partitioned by the entity key to select a latest row, with a deterministic tie-breaker. A left join must preserve missing right-side rows; count or aggregate according to `null` semantics. Identify useful indexes from predicates and joins, and inspect the actual query plan. SQL examples need an appropriate schema and database to execute.

```sql
SELECT source_id, listing_id, price_cents, updated_at
FROM (
  SELECT e.*,
    ROW_NUMBER() OVER (
      PARTITION BY source_id, listing_id
      ORDER BY updated_at DESC, event_id DESC
    ) AS rn
  FROM listing_events e
) ranked
WHERE rn = 1;
```

```sql
SELECT source_id, COUNT(*) AS total, AVG(price_cents) AS avg_price
FROM listings
GROUP BY source_id;
```

## Practice

Two events v5 and v3 for the same source/entity complete in reverse order. What protects the latest state? What changes if each event sends an email?

### Spoiler

An atomic conditional write protects version 5 regardless of completion order. The email adds an independent effect: use a delivery identity, durable inbox/outbox protocol and downstream replay-safe behavior. A `Set` in one process disappears on restart and cannot coordinate multiple workers.

## Official references

- [Node.js: sql-insert](https://www.postgresql.org/docs/current/sql-insert.html)
