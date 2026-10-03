# Returning to TypeScript: the language

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## Types and values

A value exists at runtime; a type describes permitted values to the checker. Ordinary annotations, type aliases and interfaces are erased, so they do not validate JSON. Some TS constructs such as a normal enum generate runtime code. Use lowercase string, number and boolean rather than wrapper types. number includes integers and fractions; bigint is separate and cannot be mixed directly with number arithmetic.

```ts check
const limit: number = 4;
type Options = { limit: number };
```

## Inference and widening

let can be reassigned, so a string literal typically widens to string. const keeps a literal for a primitive binding, but an object property remains mutable and often widens. Add an explicit contract when building a state object. as const narrows literals and produces readonly views; satisfies checks the shape but may retain a narrow literal instead of widening it. Give empty collections context when incrementally filling them; do not memorize a universal rule that every empty array is never[].

```ts check
let status = "queued";
const mode = "queued";
const job = { status: "queued" };
```

```ts check
type Job = { status: "queued" | "done" };
const job: Job = { status: "queued" };
job.status = "done";
```

```ts check
const state: { tags: string[] } = { tags: [] };
state.tags.push("new");
```

## Structural typing

Compatibility normally depends on members rather than the declared name. An object with required members and additional fields may be assignable through a variable. A fresh object literal also receives excess-property checks to catch likely mistakes. Those checks do not make an exact runtime schema or remove extra fields. Two aliases of string remain compatible; brands can distinguish IDs when this matters.

```ts check
type Identified = { id: string };
function show(value: Identified): string {
  return value.id;
}
const listing = { id: "A", price: 500 };
show(listing);
```

```ts check
type Identified = { id: string };
function show(value: Identified): string { return value.id; }
// @ts-expect-error: intentional type error
show({ id: "A", price: 500 });
```

## Unions and intersections

A | B allows one of the alternatives; only operations safe for all members are available until narrowing. A & B must satisfy both contracts simultaneously, so conflicting property types can produce never. An intersection does not overwrite a property with the right side: omit the original key first when replacing its type. Model mutually exclusive states as a union.

```ts check
function format(value: string | number): string {
  return typeof value === "number" ? value.toFixed(2) : value.trim();
}
```

```ts check
type Impossible = { id: string } & { id: number };

```

## Optional versus undefined

With exactOptionalPropertyTypes, field?: number permits absence but not an explicit undefined unless included in the value union. Reading the field can still produce undefined. field: number | undefined requires the property itself. PATCH often assigns different meanings to absence and null. in includes inherited properties; Object.hasOwn checks ownership but is not always enough to narrow the value type.

```ts check
type Options = { retries?: number };
const omitted: Options = {};
```

## Arrays, tuples and readonly

An ordinary array has no minimum length. Under noUncheckedIndexedAccess, an indexed read can be undefined. A tuple describes fixed positions, and labels are editor information rather than runtime named fields. Prefer readonly inputs for functions that only read: both mutable and readonly callers can use them. Readonly is shallow and another alias can still mutate the underlying object.

```ts check
const prices: number[] = [100, 200];
const point: readonly [x: number, y: number] = [10, 20];
```

## Function signatures

Context provides callback parameter types. An optional parameter means callers may omit it; do not mark index optional when the API always passes it simply because some callbacks ignore it. Rest parameters collect arguments. Async functions return Promise<T>. A callback typed () => void may return a value because the caller promises not to use it; void is not a runtime proof that nothing is returned.

```ts check
type Formatter = (price: number, currency?: string) => string;
const format: Formatter = (price, currency = "USD") => `${currency} ${price}`;
```

## This and closures

A normal method gets this from its call site and can lose its receiver when passed as a callback. bind, a wrapper or an arrow field can preserve the intended receiver. A closure retains access to a variable rather than an automatic snapshot. let provides an iteration-local binding; var can make callbacks share one changing binding.

```ts check
class Counter {
  value = 0;
  increment() { this.value++; }
}
const counter = new Counter();
const safe = () => counter.increment();
safe();
```

## Practice

Why can an inferred job status fail a literal-union contract? Why can Readonly<{ tags: string[] }> still permit push? How does an optional field differ from a required field containing undefined?

### Spoiler

The inferred property can be string; annotate the intended state contract. Readonly prevents replacing tags but its array needs readonly string[] to prevent mutation through that view. An optional property may be absent; the required union property must exist. exactOptionalPropertyTypes additionally controls explicitly writing undefined.

## Move on when you can explain

Explain type versus value, write a callback signature, distinguish missing from null, and narrow unknown data without assertions. Then use the runtime chapter and practical TypeScript chapter to put these rules into working code.

## Official references

- [TypeScript: everyday-types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript: exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)
