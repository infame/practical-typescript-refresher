# Task-solving evaluation after studying the material

Experiment date: **2026-10-02**. The participant with the material solved **6/6 tasks**, and the control without it also solved **6/6**. **A learning benefit was not established.** This report describes a frozen earlier edition, not the October 14 content release. [Original Russian report](ru/EVALUATION.md).

## Method

Two separate AI sessions had no history of developing the material. Both were given the role of an experienced developer returning to TypeScript after a break; deliberately pretending to make mistakes was prohibited.

The control received only the task specification. The other participant first received the frozen text of all 14 chapters, then the same specification. Participants were instructed not to access other submissions, the evaluator, example implementations or external search. Checks hidden at submission time were written by the evaluator and run after submission. Strict type checking with noUncheckedIndexedAccess and exactOptionalPropertyTypes followed.

File access was restricted by participant instructions, not demonstrated hardware isolation. Submissions used a shared filesystem. The model's pretrained TypeScript knowledge could not be removed.

## Results

| Task | Without material | With material | Checks |
| --- | --- | --- | --- |
| Validate and normalize an external packet | Solved | Solved | 4 |
| Apply PATCH with null/zero and independent copies | Solved | Solved | 3 |
| Combine scoped deduplication, counting and latest version | Solved | Solved | 4 |
| mapLimit: stop scheduling and drain active operations | Solved | Solved | 5 |
| Async cache: share in-flight calls and evict rejections | Solved | Solved | 4 |
| Partial import with bounded concurrency | Solved | Solved | 4 |
| **Total** | **6/6 tasks; 24/24 checks** | **6/6 tasks; 24/24 checks** | **24** |
| Strict type checking | Passed | Passed | Separate |
| 12 behavior questions | 12 correct answers | 12 correct answers | Manual author assessment |

Machine-readable results and hashes of frozen inputs are in [evaluation-results.json](evaluation-results.json). Checks are grouped: one parser check, for example, includes several invalid inputs. Twenty-four checks do not mean twenty-four independent concepts. Recorded results and hashes are preserved unchanged; this translation does not redefine the experiment inputs.

## Interpretation and limits

The material is compatible with solutions to the chosen tasks. The participant with it associated reasoning with particular sections. Implementations handled zero, null, string prices, delimiters in IDs, out-of-order completion, synchronous throws, rejection with undefined and partial failures.

The role “returning after a break” does not erase pretrained knowledge. The control was already at the ceiling. The experiment does not establish that a new reader will learn to solve six tasks or measure a benefit over receiving no material.

Several tasks test near transfer from explained solutions: PATCH, mapLimit and memoization resemble chapters. Combined deduplication/counting/version selection and the strict parser require adapting the contract. Do not describe the entire benchmark as far transfer.

Knowledge answers were assessed manually by the material's author, not an independent blind assessor. One run per condition provides no statistical confidence or robustness estimate for alternative wording.

## Changes after the experiment

The participant found an explicit statement of `typeof null === "object"` more useful than an implicit parser check; it was added. The cost of compound string keys was clarified: linear estimates by record count assume bounded ID length, and constructing keys also depends on that length.

These small edits followed the frozen input. No later run was presented as the original result. Four additional chapters existed before material was supplied to the participant. Subsequent translations, reader changes and content additions have not been measured by this experiment.

## A more informative evaluation

1. Recruit experienced people who have not used TS recently and measure initial independent solutions.
2. After studying, give equivalent new tasks with different surface forms, rather than repeating worked examples.
3. Record complete solutions, time, hints and error causes. Separate runtime behavior, type checking and reasoning about contracts.
4. Check retention after several days using a third task set.
5. Use predetermined criteria and retain failed attempts rather than reporting only the best run.

## Try the benchmark

Specification: [benchmarks/TASKS.md](../benchmarks/TASKS.md). Export its six functions and named types in a separate solution.ts.

```sh
npm run eval -- /absolute/path/to/solution.ts
```

The evaluator executes submitted code on your machine; use your own or reviewed code. Tests are now public. Inspecting them before solving makes this known-test practice, not a blind evaluation.
