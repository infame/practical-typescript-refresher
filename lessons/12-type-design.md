# Type design beyond basic generics

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## What relationship does the generic preserve?

identity links its input and output through T. A generic used only once may add no useful information. `groupBy` preserves element and key types; `mapLimit` preserves input and callback result; `getField` preserves key/value correspondence. Prefer the smallest API that expresses the relationship instead of adding parameters for every implementation detail.

```ts check
function identity<T>(value: T): T { return value; }
```

## Typeof, keyof and indexed access

typeof in a type position extracts the type of an existing value; `keyof` extracts its keys; indexed access selects value types. This can derive configuration unions without maintaining duplicate lists. `Object.keys` normally returns `string[]` because a structurally typed object may have extra runtime properties. An assertion to `(keyof T)[]` is valid only under stronger assumptions, not for every object.

```ts check
const sourceNames = { primary: "MLS", secondary: "Partner" } as const;
type SourceKey = keyof typeof sourceNames; // "primary" | "secondary"
type SourceName = (typeof sourceNames)[SourceKey]; // "MLS" | "Partner"
```

## Mapped types

A mapped type visits each key and transforms its property type. An optional clearable patch adds `null` to each editable field. Apply it only to allowed fields so callers cannot alter identifiers. This type does not implement runtime patch semantics: the function still must distinguish absence, validate values and construct the next state.

```ts check
type ClearablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};
type Editable = { price: number; description: string };
type Patch = ClearablePatch<Editable>;
```

## Conditional types and infer

`infer` extracts a matching part in a conditional type. `ReturnType` gets a function return type and `Awaited` models `await` unwrapping; neither executes the function.

A naked type parameter on the left of extends distributes over union members. Wrapping the operands in tuples asks about the union as a whole. Use these to read libraries, but do not build a complex conditional type when a normal signature is sufficient.

```ts check
type Returned<F> = F extends (...args: never[]) => infer R ? R : never;
type Example = Returned<() => Promise<number>>; // Promise<number>
```

```ts check
async function load() { return { id: "A", price: 500 }; }
type Loaded = Awaited<ReturnType<typeof load>>;
```

```ts check
type KeepStrings<T> = T extends string ? T : never;
type A = KeepStrings<"x" | 42>; // "x"

type AllStrings<T> = [T] extends [string] ? true : false;
type B = AllStrings<"x" | 42>; // false
```

## Overloads

Overloads express different accepted inputs and corresponding outputs. Callers see the overloads, not the implementation signature. An argument already typed as a union may match neither individual overload; add a union overload or choose one union signature when exact correlation is unnecessary. Keep overloads small enough to explain.

```ts check
function normalize(value: string): string;
function normalize(value: readonly string[]): string[];
function normalize(value: string | readonly string[]): string | string[] {
  return typeof value === "string" ? value.trim() : value.map(x => x.trim());
}
```

## Assertions, assertion functions and satisfies

as and ! assert facts without runtime checks. An assertion function can perform a real check and narrow after a successful call, or throw on failure.

`satisfies` checks compatibility while `as const` preserves literal information. None of these validates a loaded configuration unless an actual runtime check is executed.

```ts check
function assertString(value: unknown): asserts value is string {
  if (typeof value !== "string") throw new Error("Expected a string");
}
function upper(value: unknown): string {
  assertString(value);
  return value.toUpperCase();
}
```

```ts check
type Route = "home" | "listings";
const routes = {
  home: "/",
  listings: "/listings",
} as const satisfies Record<Route, string>;
```

## Branded identifiers

An intersection with a unique-symbol property prevents casually mixing two `string` identifier types. Put the assertion in a parser after checking the domain condition. The brand does not attach a runtime symbol to the primitive; after JSON round-trip, reestablish the guarantee at the boundary. Use this when the confusion risk justifies the extra API work.

```ts check
declare const listingIdBrand: unique symbol;
type ListingId = string & { readonly [listingIdBrand]: true };

function parseListingId(value: unknown): ListingId {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Invalid listing ID");
  }
  return value as ListingId;
}
```

## Functions and variance

If an API may call a handler with any `Animal`, a handler requiring `Dog` can fail on a cat. `strictFunctionTypes` catches this for ordinary function properties; method compatibility has exceptions. Explain what the caller may supply and what the callback can safely accept rather than relying only on variance terminology.

```ts check
type Animal = { name: string };
type Dog = Animal & { bark(): void };
type Handler = (animal: Animal) => void;
const onlyDogs = (dog: Dog) => dog.bark();
// @ts-expect-error: intentional type error
const handler: Handler = onlyDogs;
```

## Practice

Create a handler dictionary for added and removed events. added has a numeric metric; removed has a reason. Each handler must accept only its event member.

### Spoiler

Map over `Event["kind"]` and use `Extract<Event, {kind: K}>` for each handler argument. Dynamic `handlers[event.kind](event)` can lose the relationship in the checker; a switch dispatch is often clearer than hiding the issue with `any`.

```ts check
type Event =
  | { kind: "added"; price: number }
  | { kind: "removed"; reason: string };

type Handlers = {
  [K in Event["kind"]]: (event: Extract<Event, { kind: K }>) => void;
};

const handlers: Handlers = {
  added: event => console.log(event.price),
  removed: event => console.log(event.reason),
};

function dispatch(event: Event): void {
  switch (event.kind) {
    case "added": handlers.added(event); return;
    case "removed": handlers.removed(event); return;
    default: {
      const unreachable: never = event;
      throw new Error(`Unexpected event: ${String(unreachable)}`);
    }
  }
}
```

## Check understanding

Explain every type parameter, the runtime guarantee of a parser and when a union, overload or generic is the simplest contract. If the helper type is harder than the function, reconsider the API.

## Official references

- [TypeScript: generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript: conditional-types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- [TypeScript: utility-types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
