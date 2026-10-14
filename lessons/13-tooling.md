# Compiler settings, modules and running TS

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## Checking, transforming and executing

These are separate operations. This repository checks with tsc --noEmit and runs supported TS syntax under Node 24 with type stripping. Running TS does not imply checking types or respecting all tsconfig transformations. Inspect scripts, engines and tsconfig first. npm ci installs the locked dependency set and detects a package/lock mismatch; npm install is for changing dependencies.

```sh
npm ci
npm run check
npm test
npm run build
npm start
```

## Strict and additional flags

strict enables a group of checks, including nullability and unknown catch values, but noUncheckedIndexedAccess and exactOptionalPropertyTypes are separate options. Indexed access may be absent; check the value or model a nonempty tuple rather than applying ! reflexively. verbatimModuleSyntax makes explicit type imports useful. A direct-Node noEmit configuration is not interchangeable with a browser bundler configuration.

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  }
}
```

## Target and lib do not install APIs

target controls emitted language assumptions; lib describes available APIs for checking. Adding toSorted declarations does not install toSorted in an older runtime. Node declarations also do not upgrade Node. Match supported runtime, package engines, declarations and CI so the checker does not approve calls to unavailable APIs.

## ESM, CommonJS and type imports

type: module defines Node ESM interpretation for .js; .mjs and .cjs make format explicit. module and moduleResolution must match the real loading environment. import type is erased; an interface cannot be instantiated as a runtime value. Direct TS execution uses appropriate .ts paths; compiled ESM often uses .js or an explicit extension-rewriting pipeline. paths aliases help the checker but do not teach the runtime to resolve aliases.

```ts
import { mapLimit } from "./core.ts";
import type { Repository } from "./core.ts";
```

## Declarations describe existing implementations

.d.ts and declare describe values implemented elsewhere; they do not create the values. Check package exports, installation, declarations and module resolution when an import fails. declare module "*" with any hides API mistakes instead of fixing the missing module.

```ts check
declare const API_URL: string;

```

## Environment variables are input

Environment values are strings or undefined. Parse syntax, convert, check range and fail at startup for invalid required configuration. An assertion to number cannot convert a string. For a port require digits and the 1–65535 range; keep defaulting distinct from accepting empty or malformed input.

```ts
function readPort(value: string | undefined): number {
  if (value === undefined) return 4173;
  if (!/^\d+$/.test(value)) throw new Error("PORT must be digits");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT out of range");
  }
  return port;
}
```

## Read compiler errors

Find where a literal widened, an optional field may be absent, a callback became too narrow or JSON was asserted safe. A runtime module-not-found has another cause: inspect the file, path, extension and module format. Adding any does not fix a missing file.

## Practice

A Repository interface is imported as a runtime constructor; a paths alias checks but fails in Node; a file runs despite a wrong argument type. What will you inspect?

### Spoiler

Use import type for the interface and an actual implementation for construction. Provide a runtime resolver or use a supported relative import for the alias. Run a separate typecheck and validate external data for the third case; type stripping is not checking.

## A reliable working loop

Read scripts, engines and tsconfig; install from the lockfile; run the checker and one test; write the task; repeat relevant checks. Resolve setup problems before a timed interview, not during the first implementation.

## Official references

- [TypeScript: theory](https://www.typescriptlang.org/docs/handbook/modules/theory.html)
- [Node.js: typescript](https://nodejs.org/api/typescript.html)

## Compiler-error clinic: ten repairs

Read the diagnostic, trace the value back to its declaration, and try a repair before expanding the answer. Each failing and corrected block is checked independently with this repository's strict settings. The @ts-expect-error comments mark intentional failures; remove them in a scratch file to see the diagnostic. These are type-checking examples, not scripts to run unchanged: the failing lines still execute if you run them.

References: [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html), [generic key/value relationships](https://www.typescriptlang.org/docs/handbook/2/generics.html), [overloads](https://www.typescriptlang.org/docs/handbook/2/functions.html), [exact optional properties](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html).

### 1. A mutable field widened to string

This fails with an argument-type error even though the object binding is const. Find which value became too broad.

```ts check
type Status = "queued" | "done";
function accept(status: Status): Status { return status; }
const job = { status: "queued" };
// @ts-expect-error: mutable property inferred as string, not Status.
accept(job.status);
```

### Spoiler

const protects the binding, not the mutable property. The property is inferred as string. State the domain contract at construction; then legal transitions remain possible. as const is useful for a fixed configuration, but would make this property readonly. Check that a valid transition works and an unrelated string is rejected.

```ts check
type Status = "queued" | "done";
const job: { status: Status } = { status: "queued" };
job.status = "done";
// @ts-expect-error: not a state in this domain.
job.status = "running";
```

### 2. An optional property may be absent

The checker cannot promise a string for every caller. Fix the input contract or handle absence.

```ts check
function token(options: { token?: string }): string {
  // @ts-expect-error: options.token can be undefined.
  return options.token.trim();
}
```

### Spoiler

Capture the optional value, then check it before accessing methods. Here absence and a blank token are errors, so throw explicitly. A ! assertion would only remove the warning; it would not supply the missing token. A fallback is appropriate only if an anonymous/default token is actually allowed.

```ts check
function token(options: { token?: string }): string {
  const value = options.token;
  if (value === undefined || value.trim() === "") throw new Error("Missing token");
  return value.trim();
}
token({ token: " abc " }); // "abc"; token({}) rejects.
```

### 3. An array index is not a nonempty guarantee

With noUncheckedIndexedAccess, even index zero can be absent.

```ts check
function firstId(items: readonly { id: string }[]): string {
  // @ts-expect-error: empty arrays have no first item.
  return items[0].id;
}
```

### Spoiler

Decide what empty input means. This API returns undefined, so its result type must include that possibility. If emptiness is forbidden, validate and throw, or accept a nonempty tuple. Neither a type assertion nor an earlier informal assumption changes an external array.

```ts check
function firstId(items: readonly { id: string }[]): string | undefined {
  const first = items[0];
  return first?.id;
}
firstId([]); // undefined
firstId([{ id: "A" }]); // "A"
```

### 4. Absent is different from explicitly undefined

exactOptionalPropertyTypes rejects this assignment; reading the property may still yield undefined.

```ts check
type Patch = { name?: string };
// @ts-expect-error: present undefined is not an allowed field value.
const patch: Patch = { name: undefined };
```

### Spoiler

Omit the property to express no update. Include undefined in the value union only if a present undefined is part of the intended contract. Object.hasOwn distinguishes the two objects at runtime; JSON serialization of an object usually drops undefined properties, so transport semantics need their own design.

```ts check
type Patch = { name?: string };
const unchanged: Patch = {};
type ExplicitPatch = { name?: string | undefined };
const present: ExplicitPatch = { name: undefined };
Object.hasOwn(unchanged, "name"); // false
Object.hasOwn(present, "name"); // true
```

### 5. A generic getter lost key/value correlation

The broad signature accepts valid keys but cannot tell which property was requested.

```ts check
function field<T>(value: T, key: keyof T): T[keyof T] { return value[key]; }
const person = { age: 42, name: "Ada" };
// @ts-expect-error: result is string | number, not specifically number.
const age: number = field(person, "age");
```

### Spoiler

Give the selected key its own parameter K extends keyof T, then return T[K]. A return assertion at the call site would hide the missing relationship and can become wrong when the selected key changes. Test both a number property and a string property; an absent key must fail.

```ts check
function field<T, K extends keyof T>(value: T, key: K): T[K] { return value[key]; }
const person = { age: 42, name: "Ada" };
const age: number = field(person, "age");
const name: string = field(person, "name");
// @ts-expect-error: missing key.
field(person, "email");
```

### 6. A union matches neither overload

The implementation can handle both inputs, but callers see only its overload signatures.

```ts check
function normalize(value: string): string;
function normalize(value: readonly string[]): string[];
function normalize(value: string | readonly string[]): string | string[] {
  return typeof value === "string" ? value.trim() : value.map(x => x.trim());
}
function call(value: string | readonly string[]) {
  // @ts-expect-error: neither single-variant overload accepts this union.
  return normalize(value);
}
```

### Spoiler

Expose a union overload if union arguments are legitimate, or use one union signature if exact input/output correlation is unnecessary. Here the extra overload retains precise results for known variants. A union caller receives a union result and must narrow it.

```ts check
function normalize(value: string): string;
function normalize(value: readonly string[]): string[];
function normalize(value: string | readonly string[]): string | string[];
function normalize(value: string | readonly string[]): string | string[] {
  return typeof value === "string" ? value.trim() : value.map(x => x.trim());
}
const one: string = normalize(" a ");
function call(value: string | readonly string[]): string | string[] { return normalize(value); }
```

### 7. A readonly view has no push method

The consumer promised not to mutate this array through the received reference.

```ts check
function addTag(tags: readonly string[], next: string): string[] {
  // @ts-expect-error: readonly arrays prohibit push through this view.
  tags.push(next);
  return [...tags];
}
```

### Spoiler

Return a new array. This protects the caller through this API, but does not freeze the original object. Readonly<{tags: string[]}> is shallower: it prevents replacing tags, while tags.push still compiles. For an immutable view of both levels, write a readonly property whose array is readonly too.

```ts check
function addTag(tags: readonly string[], next: string): string[] { return [...tags, next]; }
const source = ["old"];
const result = addTag(source, "new"); // source remains ["old"].
type State = { readonly tags: readonly string[] };
const state: State = { tags: source };
// @ts-expect-error: nested view is readonly too.
state.tags.push("other");
```

### 8. An exhaustive switch missed a variant

Assigning the remaining value to never reveals the unhandled member.

```ts check
type Result = { kind: "ok"; value: number } | { kind: "failed"; message: string };
function describe(result: Result): string {
  switch (result.kind) {
    case "ok": return String(result.value);
    default:
      // @ts-expect-error: failed has not been handled.
      const missing: never = result;
      return String(missing);
  }
}
```

### Spoiler

Handle every member before the never check. Adding a later variant should cause a new compile error here. A fallback returning an empty string would silently accept the new case. This guarantee applies to the declared union; external JSON still needs validation.

```ts check
type Result = { kind: "ok"; value: number } | { kind: "failed"; message: string };
function describe(result: Result): string {
  switch (result.kind) {
    case "ok": return String(result.value);
    case "failed": return result.message;
    default: {
      const unreachable: never = result;
      throw new Error(`Unexpected result: ${String(unreachable)}`);
    }
  }
}
```

### 9. A caught value is unknown

JavaScript permits throwing values that have no message property.

```ts check
function message(run: () => void): string {
  try { run(); return "ok"; } catch (error) {
    // @ts-expect-error: a caught unknown is not automatically Error.
    return error.message;
  }
}
```

### Spoiler

Narrow to Error before reading its message. For ordinary other values use a documented fallback; String(undefined) is "undefined", not an empty message. Exotic objects can fail during conversion too, so a logging boundary that must never throw needs an additional fallback policy. Do not classify every failure as retryable just because it has a message.

```ts check
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
errorMessage(new Error("offline")); // "offline"
errorMessage(undefined); // "undefined"
```

### 10. An interface is not a runtime constructor

The compiler reports that a type is being used as a value.

```ts check
interface RecordData { id: string }
// @ts-expect-error: interfaces are erased; no constructor exists.
const record = new RecordData();
```

### Spoiler

Construct an object matching the interface, or supply a real class/factory implementation. A type-only import describes a contract and is erased. Adding declare only describes an implementation expected elsewhere; it still does not create one. Check runtime imports separately from type checking.

```ts check
interface RecordData { id: string }
const record: RecordData = { id: "A" };
class StoredRecord implements RecordData {
  id: string;
  constructor(id: string) { this.id = id; }
}
const stored: RecordData = new StoredRecord("B");
```
