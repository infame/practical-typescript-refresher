# Practical TypeScript contracts

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## Unknown, any and narrowing

any disables useful checks. unknown can hold anything but requires evidence before use. Validate external input at the boundary: exclude null and arrays, check required fields, check their types and business constraints, then return a normalized object. typeof null is object. An as assertion neither checks nor converts data. JSON.parse can fail on syntax before schema validation even starts. A parser is useful for normalization and error messages; a type guard is useful for branching, but its implementation is a promise the compiler trusts.

```ts check
type Listing = { id: string; price: number };

function parseListing(value: unknown): Listing {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object");
  }
  if (!("id" in value) || typeof value.id !== "string" || !value.id.trim()) {
    throw new Error("Invalid id");
  }
  if (!("price" in value) || typeof value.price !== "number" ||
      !Number.isFinite(value.price) || value.price < 0) {
    throw new Error("Invalid price");
  }
  return { id: value.id, price: value.price };
}
```

## Discriminated unions

A boolean success flag with optional data and error permits impossible combinations. Instead make each allowed state a union member with a literal discriminator and required payload. Checking the discriminator narrows to the correct member. never represents an exhausted set of possibilities and supports a compile-time exhaustiveness check. It does not validate an external payload. Return expected per-record failures as values when a batch should continue; throw when the enclosing operation cannot proceed.

```ts
type WeakResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function describe(result: Result<Listing>): string {
  if (result.ok) {
    return `${result.value.id}: ${result.value.price}`;
  }
  return result.error;
}
```

```ts check
type ListingEvent =
  | { kind: "price_changed"; id: string; price: number }
  | { kind: "removed"; id: string; reason: string };

function assertNever(value: never): never {
  throw new Error(`Unexpected event: ${JSON.stringify(value)}`);
}

function summarize(event: ListingEvent): string {
  switch (event.kind) {
    case "price_changed": return `${event.id}: ${event.price}`;
    case "removed": return `${event.id}: ${event.reason}`;
    default: return assertNever(event);
  }
}
```

## Generics preserve relationships

T links element input to output, K links the selected key to the Map key. Usually inference supplies both. any loses the relationship and returning unknown loses information already known to the caller. K extends keyof T restricts a key to the object type; T[K] recovers its value type. This extends is a type constraint, not runtime inheritance. Add a generic parameter only when it connects meaningful positions in the API.

```ts check
function groupBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

const byPrice = groupBy(
  [{ id: "A", price: 500 }],
  listing => listing.price,
); // Map<number, { id: string; price: number }[]>
```

```ts check
function getField<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const price = getField({ id: "A", price: 500 }, "price"); // number

```

## Utility types and API boundaries

Pick selects properties, Omit removes them, Partial makes them optional and Readonly prevents assignment through that type. None removes runtime fields or deeply freezes an object. Restrict a patch to editable fields instead of Partial of an entire entity. Record with a finite key union is useful; sparse string dictionaries need absent-value handling. type can describe unions and tuples; interface describes extensible object contracts. as const preserves literal information; satisfies checks compatibility without runtime validation. Catch values are unknown: narrow Error or stringify the alternative.

```ts check
type Listing = { id: string; price: number; source: string };
type Summary = Pick<Listing, "id" | "price">;
type CreateListing = Omit<Listing, "id">;
type PatchListing = Partial<Pick<Listing, "price">>;
type FrozenListing = Readonly<Listing>;
```

```ts check
const handlers = {
  queued: "Pending",
  done: "Finished",
} satisfies Record<"queued" | "done", string>;
```

## Practice

Represent three import outcomes: applied, stale, failed. Every outcome has an ID; only failed has a message. Write a function counting applied results.

### Spoiler

A union discriminated by status makes failed without message invalid and exposes message after narrowing. Count only status === "applied". Add skip reasons to the stale member if needed instead of introducing optional fields on every outcome.

```ts check
type ImportResult =
  | { status: "applied"; id: string }
  | { status: "stale"; id: string }
  | { status: "failed"; id: string; message: string };

function countApplied(results: readonly ImportResult[]): number {
  return results.filter(result => result.status === "applied").length;
}
```

## Explain the boundary

State where validation happens and which errors are expected. The useful guarantee is that callers receive a validated value or an explicit failure, not that assertions make unknown data safe.

## Official references

- [TypeScript: narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
