# Workshop: write the code yourself

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## Parse an external record

Implement parseRecord(unknown): { id: string; price: number | null }. Normalize a nonempty ID. Accept a finite nonnegative numeric metric, null, or a trimmed strict decimal string. Reject booleans, empty strings, hexadecimal, exponents and Infinity. Return a fresh object and ignore unrelated fields. Define your accepted decimal grammar before converting; the examples use digits with an optional nonempty fractional part.

### Spoiler

Check object shape, ID type and normalized content. Handle null separately; for strings validate the full decimal syntax before Number. Then check finiteness and sign. Test zero, whitespace, .5 versus 0.5, exponent syntax and unsafe coercion shortcuts. The reference functions are in examples/workshop.ts.

```ts
export function parsePriceRecord(raw: unknown): { id: string; price: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Expected an object");
  }
  if (!("id" in raw) || typeof raw.id !== "string" || raw.id.trim() === "") {
    throw new Error("Invalid id");
  }
  if (!("price" in raw)) throw new Error("Missing price");
  let price: number;
  if (typeof raw.price === "number") {
    price = raw.price;
  } else if (typeof raw.price === "string" && /^\d+(\.\d+)?$/.test(raw.price.trim())) {
    price = Number(raw.price.trim());
  } else {
    throw new Error("Invalid price format");
  }
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
  return { id: raw.id.trim(), price };
}
```

## PATCH without mutation

Apply a patch to an already-validated entity. Missing fields preserve values, null clears the nullable metric, zero is valid, and an empty tags array clears tags. Return a fresh object and a fresh tags array even when the patch is empty. Explicit undefined is prohibited in the patch contract.

### Spoiler

Choose nullable fields with an explicit undefined check, not ??, because null is meaningful. Clone the selected tags array. Object spread alone leaves nested references shared. Test mutation of the result and of a supplied patch array after the call.

```ts
export type Current = { id: string; price: number | null; tags: readonly string[] };
export type Patch = { price?: number | null; tags?: readonly string[] };

export function applyPatch(current: Current, patch: Patch): Current {
  return {
    id: current.id,
    price: patch.price === undefined ? current.price : patch.price,
    tags: [...(patch.tags ?? current.tags)],
  };
}
```

## Async cache and concurrent callers

Implement an async memoizer that coalesces calls with the same key while loading and retains successful values, including undefined. Failed loads must be evicted so a later caller can retry. A synchronous throw also becomes a rejected promise. Define key identity, retention and invalidation separately; this small cache has no TTL or capacity policy.

### Spoiler

Cache the in-flight promise before other callers can start another load. Promise.resolve().then invokes the loader after the cache entry is set and captures synchronous throws. On rejection, evict that entry. Distinguish absence of an entry from a successfully cached undefined. Failed promises must not remain permanently cached.

```ts
export function memoizeAsync<K, V>(
  load: (key: K) => Promise<V>,
): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return key => {
    const existing = cache.get(key);
    if (existing !== undefined) return existing;

    const pending = Promise.resolve()
      .then(() => load(key))
      .catch(error => {
        cache.delete(key);
        throw error;
      });
    cache.set(key, pending);
    return pending;
  };
}
```

## Partial failures as values

Load IDs with bounded concurrency, preserve input positions and return a success/failure union for every ID. Continue after a rejected or synchronously thrown operation. Invalid concurrency still rejects the whole call.

### Spoiler

Catch inside the mapLimit callback, return a discriminated failure with a normalized message, and let successful results remain values. Error or String(error) handles ordinary thrown values without assuming every exception is Error. Type the callback result union explicitly when inference widens the discriminator.

```ts
import { mapLimit } from "./core.ts";

export type Outcome<T> =
  | { status: "loaded"; id: string; value: T }
  | { status: "failed"; id: string; message: string };

export function loadAll<T>(
  ids: readonly string[],
  limit: number,
  load: (id: string) => Promise<T>,
): Promise<Outcome<T>[]> {
  return mapLimit(ids, limit, async (id): Promise<Outcome<T>> => {
    try {
      return { status: "loaded", id, value: await load(id) };
    } catch (error) {
      return {
        status: "failed", id,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
```

## Measure the attempt

Record requirements solved, tests passed, hints used and the point where you got stuck. After reading the solution, change the input or policy and implement again from a blank file. Passing a multiple-choice diagnostic checks recognition, not independent coding. Use the domain practice task and mock interview as subsequent checks.

