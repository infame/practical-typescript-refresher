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
