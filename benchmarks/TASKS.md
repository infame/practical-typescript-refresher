# Independent practical benchmark

Submit one file solution.ts in your assigned output directory. Export the functions/types below. Use no dependencies. Target Node 24, strict TypeScript, noUncheckedIndexedAccess, exactOptionalPropertyTypes. Each task is independent. Helpers allowed. Do not inspect hidden tests, other submissions, examples or course source unless explicitly provided as study material. Do not execute tsc to change benchmark configuration. You may check your own solution in a temporary local config with the specified flags.

## Task 1 — parsePacket(raw: unknown)

Return a new plain object `{source: string, id: string, version: number, price: number | null}`. source/id must be nonempty after trim; return trimmed strings. version must be a nonnegative safe integer number; numeric strings not accepted. price accepts null, finite nonnegative numbers, or decimal strings matching digits with optional fractional digits, e.g. "12", "12.50". Trim strings before checking. Reject blank, exponent, hex, suffix, negative, boolean, absent and undefined values. Reject arrays/null/nonobjects. Extra fields ignored. Throw Error on invalid. Do not modify input.

## Task 2 — applyPatch(current, patch)

Export type Current = {id:string; price:number|null; tags:readonly string[]}; export type Patch = {price?:number|null; tags?:readonly string[]}. Return Current, a new outer object. Missing price/tags leaves existing value; null clears price; zero is valid. Clone tags into a new array even when omitted. Do not change current or patch. Assume typed valid inputs.

## Task 3 — summarize(events)

Input readonly {source:string; eventId:string; listingId:string; version:number; price:number}[] of valid events. Event identity is (source,eventId); ignore repeat identity after its first occurrence, even if payload differs. Listing identity is (source,listingId). For each listing return {source,listingId,version,price,count}: greatest version, first winner on equal version; count is number of distinct event identities for this listing after global duplicate removal. Return listings in order of first appearance after deduplication. IDs may contain delimiters. Do not mutate. Expected O(n) time.

## Task 4 — mapLimit<T,R>(items, limit, fn)

Input readonly T[], limit positive integer, fn(item:T,index:number):Promise<R>. At most limit active callbacks; preserve result order. Invalid limit rejects RangeError even for empty input. On first observed error stop scheduling; await all already active callbacks; then reject with that same error, which may be undefined. Sync callback throws must be handled too. Empty input returns []. Assume dense immutable array.

## Task 5 — memoizeAsync<K,V>(load)

load(key:K):Promise<V>. Return function (key:K)=>Promise<V>. Concurrent same-key calls share one in-flight invocation; successes cached (including undefined); different keys independent. Rejections evict so next call retries; all callers for failed operation reject. A synchronous load throw must become Promise rejection and must not poison cache. No TTL or cancellation required. Map equality for keys is intended.

## Task 6 — processEvents(events, storage, limit)

events readonly {id:string;version:number}[], storage.write(event):Promise<"applied"|"stale">. Return in input order a result for every event:
{status:"applied"|"stale",id:string,index:number} OR {status:"failed",id:string,index:number,message:string}.
Use bounded concurrency with valid positive integer limit as task 4; one failure must not stop other records. Unknown thrown values: Error.message otherwise String(error). Inputs typed/valid. No retries and no mutation. Export discriminated union type Outcome as above. Counts/DB atomicity not part of task.

## Knowledge questions — answers.md

Answer briefly with reasoning. If study material was supplied, cite its chapter and section; mark statements relying on prior knowledge.

1. Does `as SomeType` validate JSON? What does typeof null return?
2. Does Readonly<{tags:string[]}> prevent tags.push? Why?
3. Difference between `{x?:number}` and `{x:number|undefined}` under exactOptionalPropertyTypes?
4. Can setting an existing Map key change its insertion position?
5. Why can map/filter hide O(n²)?
6. Does Promise.all cancel siblings when one rejects?
7. In mapLimit, why is `firstError !== undefined` an insufficient failure flag?
8. Why can one JS thread still have a read-modify-write race?
9. Is concurrency=4 the same as 4 requests/sec?
10. What happens if a rejected Promise is cached forever?
11. Does noUncheckedIndexedAccess prove non-empty arrays at runtime?
12. Why is a conditional upsert safer than find-then-update?
