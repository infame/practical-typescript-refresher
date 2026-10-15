# JavaScript pitfalls in correct algorithms

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## References and shallow copies

`const` prevents rebinding a variable, not mutating its object. Spread copies one level. Changing a nested object through the copy can change the original; copying a nested array is also required when results must be independently mutable.

`Object.isFrozen` and `readonly` types are separate from a deep immutability guarantee. Copy only the levels your contract owns, and test that changes to the result do not affect the input.

```ts
const a = { id: "A" };
const b = { id: "A" };
const c = a;
a === b; // false
a === c; // true
new Set([a, b]).size; // 2
```

```ts
const source = { id: "A", address: { city: "Austin" }, tags: ["new"] };
const copy = { ...source };
copy.id = "B";
copy.address.city = "Denver";
copy.tags.push("featured");

const updated = {
  ...source,
  address: { ...source.address, city: "Boston" },
  tags: [...source.tags, "verified"],
};
```

## Arrays and sorting

`sort()` mutates its array and defaults to `string` comparison. Supply `(a, b) => a - b` for numbers and copy first when mutation is forbidden. Modern `toSorted` returns a new array but needs a supporting runtime.

`map` transforms, `filter` selects and `reduce` accumulates; choose the operation that expresses the task.

An index may be absent under `noUncheckedIndexedAccess` even when you think the array is nonempty: check the element or model a nonempty tuple.

```ts
[100, 20, 3].sort();
[100, 20, 3].sort((a, b) => a - b); // [3, 20, 100]
```

```ts
const sorted = [...items].sort(compare);

const alsoSorted = items.toSorted(compare);
```

## Missing values

|| replaces every falsy value, including zero and the empty string. ?? replaces only null or undefined. Optional chaining stops on nullish receivers, but does not validate unknown JSON. filter(Boolean) removes more than missing values. Distinguish property absence, an explicit undefined, null and a valid zero; Object.hasOwn checks own properties while in also includes the prototype chain.

```ts
0 || 3;         // 3
0 ?? 3;         // 0
"" ?? "name";   // ""
null ?? 3;      // 3
const { price = 100 } = { price: null }; // null
```

```ts
const nextPrice = patch.price === undefined ? oldPrice : patch.price;
```

## Numbers and dates

`Number` accepts coercions that a domain parser may reject: an empty `string` can become zero, and hexadecimal or exponent notation may be accepted. Check syntax separately if the contract requires strict decimals.

Use `Number.isFinite` and `Number.isSafeInteger` as appropriate; `NaN` does not equal itself.

Specify units, timezone and invalid-date handling rather than comparing ambiguous date strings. Floating-point arithmetic is not exact decimal money arithmetic.

```ts
Number(" ");          // 0
Number(null);         // 0
Number("500usd");     // NaN
parseInt("500usd", 10); // 500
parseInt("12.9", 10); // 12
```

```ts
function parsePrice(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("Expected number or string");
  }
  if (typeof value === "string" && value.trim() === "") {
    throw new Error("Empty price");
  }
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
  return price;
}
```

```ts
const a = Date.parse("2026-10-01T10:00:00+02:00"); // 08:00 UTC
const b = Date.parse("2026-10-01T09:00:00Z");      // 09:00 UTC
a < b; // true
```

For example, `0.1 + 0.2 !== 0.3`. If the contract uses currency with two decimal places, integer minor units in the safe range can avoid these fractional errors; other currencies and domains need their own scale.

Keep IDs such as "00123" as strings.

`Date.parse` returns milliseconds or `NaN`, while an API may send seconds; encode the unit in the field name. For date-time strings include an explicit timezone, normalize once, and compare timestamps rather than ISO strings with different offsets.

## Practice

Predict the numeric sort, defaulting a zero, and changing a nested array through a spread copy. Explain which operation mutates its input and how to retain a valid zero.

```ts
const source: Array<{ id: string; tags: string[] }> = [
  { id: "A", tags: [] }, { id: "B", tags: [] },
];
const result = source.map(x => ({ ...x }));
const first = result[0];
if (first === undefined) throw new Error("Expected a first element");
first.id = "X";
first.tags.push("new");
result.reverse();
const retries = 0 || 3;
```

### Spoiler

The original `source` still has IDs A, B in that order. Its first `tags` array is now `["new"]`, because the shallow object copy shares that nested array. `result` has IDs B, X after reversal. `retries` is 3: use `0 ?? 3` to preserve an explicit zero.

Clone `tags` as well as its parent when independent mutation is required.

The earlier default sort produces `[100, 20, 3]` by `string` comparison; the numeric comparator produces `[3, 20, 100]`.

## Explain your checks

Before each `if` ask whether you are testing existence, runtime type or business validity. They are separate decisions. A `number` can be present and correctly typed but still invalid because it is negative or nonfinite.
