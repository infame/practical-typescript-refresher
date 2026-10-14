# Algorithm patterns in TypeScript

A practical refresher. Read the contract, trace the examples, and attempt the exercise before opening its answer. Code blocks may share context; only `ts check` blocks are standalone checks.

## Hash map: Two Sum

Store previously seen values with their indices. For each value check the needed complement before inserting the current index; this prevents using the same element twice. Clarify whether one answer or all pairs are required and how duplicates should behave. Expected O(n) lookups replace the quadratic nested loop, with O(n) extra space.

```ts
function twoSum(nums: readonly number[], target: number): [number, number] | null {
  const seen = new Map<number, number>();
  for (const [index, value] of nums.entries()) {
    const previous = seen.get(target - value);
    if (previous !== undefined) return [previous, index];
    seen.set(value, index);
  }
  return null;
}
```

## Two pointers on sorted input

Move the left or right pointer according to whether the current sum is below or above the target. This depends on sorted input: verify the precondition, or account for sorting and original-index reconstruction. Do not copy a pointer pattern into an unsorted problem without its invariant.

```ts
function hasPair(sorted: readonly number[], target: number): boolean {
  let left = 0;
  let right = sorted.length - 1;
  while (left < right) {
    const sum = sorted[left]! + sorted[right]!;
    if (sum === target) return true;
    if (sum < target) left++;
    else right--;
  }
  return false;
}
```

## Sliding window

Maintain a window with no repeated characters. Record each last-seen position and move the left edge only forward using max; otherwise a repeat before the current window can incorrectly move the edge backward. JavaScript string indexing uses UTF-16 code units, not user-perceived graphemes. State the text model or use an appropriate segmentation strategy.

```ts
function longestUnique(text: string): number {
  const last = new Map<string, number>();
  let left = 0;
  let best = 0;
  let right = 0;
  for (const char of text) {
    const previous = last.get(char);
    if (previous !== undefined) left = Math.max(left, previous + 1);
    last.set(char, right);
    best = Math.max(best, right - left + 1);
    right++;
  }
  return best;
}
```

## Stack: matching brackets

Push expected closing brackets, then compare each closing token with the stack top. Reject mismatches and a nonempty stack at the end. Define behavior for non-bracket characters. Stack operations are constant-time at the end of an array; shift at the front would repeatedly move elements.

```ts
function balanced(text: string): boolean {
  const opening = new Map([["(", ")"], ["[", "]"], ["{", "}"]]);
  const closing = new Set([")", "]", "}"]);
  const expected: string[] = [];
  for (const char of text) {
    const close = opening.get(char);
    if (close !== undefined) expected.push(close);
    else if (closing.has(char) && expected.pop() !== char) return false;
  }
  return expected.length === 0;
}
```

## Merge intervals

Sort a copy by start, then merge when the next interval overlaps according to the endpoint policy. Extend the current end with max; directly assigning the next end breaks nested intervals. Clarify whether touching intervals merge and whether endpoints are inclusive. Sorting makes the overall cost O(n log n).

```ts
function mergeIntervals(input: readonly (readonly [number, number])[]): [number, number][] {
  const sorted = [...input].sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [];
  for (const [start, end] of sorted) {
    const previous = result[result.length - 1];
    if (previous !== undefined && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      result.push([start, end]);
    }
  }
  return result;
}
```

## Binary search: first value at least target

Use a half-open interval [left, right), with right initialized to length. Keep the answer inside the search interval and shrink one side each iteration. Return length if no value qualifies. The midpoint must use the current bounds; test empty input, first and last positions and a target beyond every value.

```ts
function lowerBound(values: readonly number[], target: number): number {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (values[mid]! < target) left = mid + 1;
    else right = mid;
  }
  return left;
}
```

## BFS, DFS and heaps

BFS explores by levels and finds shortest paths only in an unweighted graph. DFS is useful for reachability and cycle reasoning. Mark visited nodes at enqueue time to avoid duplicate queue growth and use a head index instead of shift. A heap supports repeated priority extraction in O(log n); it is not a sorted array. This chapter introduces these patterns, but does not provide a complete dynamic-programming or competitive-programming curriculum.

## Practice

Solve Two Sum on [2,7,11,15] with target 9; longest nonrepeating substring in "abba"; first index at least 5 in [1,5,5,9]; merge [1,6] and [2,3].

### Spoiler

Results are indices [0,1], length 2, index 1 and [1,6]. Write the loop invariant before optimizing. Use max when extending the interval and when moving a sliding-window boundary.

## When stuck

State a correct simple solution, estimate its cost, identify repeated work, then select the data structure that removes it. Trace a small counterexample. Recognizing a pattern is not enough: explain why its invariant matches this task.
