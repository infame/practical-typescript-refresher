# Collections and data processing

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## Keep the latest version

Use a Map keyed by entity ID. Read the current winner, compare versions, and replace only for a strictly larger version. Last in the input is not necessarily newest. A strict comparison retains the first record on ties. One pass costs O(n) operations and O(k) retained records, plus the cost of processing string keys. Sorting adds work without helping this contract.

```ts
type ListingUpdate = {
  listingId: string;
  version: number;
  price: number;
};

function latestByListing(
  updates: readonly ListingUpdate[],
): ListingUpdate[] {
  const latest = new Map<string, ListingUpdate>();

  for (const update of updates) {
    const current = latest.get(update.listingId);
    if (current === undefined || update.version > current.version) {
      latest.set(update.listingId, update);
    }
  }
  return [...latest.values()];
}
```

## Group and join by key

Build the right-side index once, then map the left side. This is a left join with nested history: entities without history remain present with an empty array. Preserve the order of entities and the input order of history unless chronology is explicitly required. Repeated entity IDs may share a history array; clone it if independent mutable results are part of the contract. A Map.get returns the same stored array, so pushing into it does not require another set.

```ts
type Listing = { id: string; title: string };
type PriceChange = {
  eventId: string;
  listingId: string;
  price: number;
  timestamp: number;
};

function attachHistory(
  listings: readonly Listing[],
  changes: readonly PriceChange[],
): Array<Listing & { history: PriceChange[] }> {
  const grouped = new Map<string, PriceChange[]>();

  for (const change of changes) {
    const group = grouped.get(change.listingId);
    if (group === undefined) {
      grouped.set(change.listingId, [change]);
    } else {
      group.push(change);
    }
  }

  return listings.map(listing => ({
    ...listing,
    history: grouped.get(listing.id) ?? [],
  }));
}
```

## Deduplicate deliveries

Entity identity and event identity are different. A legitimate entity may have many changes. Deduplicate by event ID in its declared scope, such as (sourceId, eventId); select the latest state separately by (sourceId, entityId). A Set of objects compares references rather than fields. For first delivery use a Set of keys; for last value use a Map. Updating a Map value does not move its iteration position.

```ts
function deduplicate(changes: readonly PriceChange[]): PriceChange[] {
  const seen = new Set<string>();
  const result: PriceChange[] = [];

  for (const change of changes) {
    if (seen.has(change.eventId)) continue;
    seen.add(change.eventId);
    result.push(change);
  }
  return result;
}
```

## Avoid accidental quadratic work

Calling filter or find for every input record repeatedly scans the same data. Build an index when the task repeatedly asks the same lookup question. Rebuilding an accumulator with object spread inside every reduce can also turn a linear algorithm into quadratic copying. Prefer a clear loop; define key uniqueness and absent values before choosing Map or an object. JSON.stringify of a pair or nested Maps avoids delimiter collisions, but processing long IDs still has a cost.

## Practice

For A/v3, B/v1, A/v2, A/v5, B/v1 retain the first record on equal versions. What remains? Then implement a per-entity event counter rather than a latest-version index.

### Spoiler

A/v5 and the first B/v1 remain. For a counter, update counts.set(id, (counts.get(id) ?? 0) + 1). Version selection, delivery deduplication and counting have different keys and policies; explain those before writing code.

#### A plausible wrong solution: deduplicate by entity

```ts check
const events = [
  { eventId: "E1", entityId: "A", version: 1 },
  { eventId: "E2", entityId: "A", version: 2 },
];
const seen = new Set<string>();
const wrong = events.filter(event => {
  if (seen.has(event.entityId)) return false;
  seen.add(event.entityId);
  return true;
});
// wrong contains only E1/version 1.
```

E2 is a new update, not a replay. The required latest version is 2, but using entity identity to deduplicate throws it away before version selection. Use event identity for delivery and entity identity for state. If E1 also exists in a second source, include sourceId in both keys. On equal versions the stated policy retains the first record, so replacing on >= is a separate bug.

## Explain the decision

Explain the key, conflict rule, complexity and order guarantee. “I will index by entity ID and keep the highest version seen” is more useful than merely naming a data structure. Try one new input with repeated IDs and delimiter characters before moving on.
