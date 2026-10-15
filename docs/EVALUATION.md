# Historical AI evaluation

On **2026-10-02**, an AI participant given the material solved **6/6 tasks**, and a control without it also solved **6/6**. **No learning benefit was established.** The experiment concerns a frozen earlier edition, not the current translations, reader or subsequent additions.

## Method and results

Two fresh AI sessions received the role of an experienced developer returning to TypeScript. The control received the task specification; the other session first read the frozen 14 chapters. Runtime checks were written separately and hidden from participants at submission time, followed by strict type checking with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

| Task                                                      | Without material        | With material           | Runtime checks |
| --------------------------------------------------------- | ----------------------- | ----------------------- | -------------- |
| Parse and normalize external data                         | Solved                  | Solved                  | 4              |
| PATCH with null, zero and independent copies              | Solved                  | Solved                  | 3              |
| Scoped deduplication, counting and latest version         | Solved                  | Solved                  | 4              |
| Concurrency limiter with stop-and-drain behavior          | Solved                  | Solved                  | 5              |
| Async cache with in-flight sharing and rejection eviction | Solved                  | Solved                  | 4              |
| Partial import with bounded concurrency                   | Solved                  | Solved                  | 4              |
| Total                                                     | 6/6 tasks, 24/24 checks | 6/6 tasks, 24/24 checks | 24             |

Both submissions passed strict type checking and answered all 12 knowledge questions correctly in a manual assessment by the author. Runtime checks group multiple inputs; their count does not represent independent concepts.

## Limits

There was one run per condition. The model retained pretrained TypeScript knowledge, the control was already at the ceiling, and several tasks resembled worked examples. File access was restricted by instructions on a shared filesystem, not hardware isolation. Knowledge answers had no independent blind assessor. These results do not measure human learning, retention or usability.

The [recorded results and frozen input hashes](evaluation-results.json) are unchanged. The [task specification](../benchmarks/TASKS.md) and checks are now public. See [contributing instructions](../CONTRIBUTING.md) to run a solution against the harness.
