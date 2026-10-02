# Contributing

Explanations and lessons are in Russian. Keep the focus on experienced developers returning to TypeScript and practical backend coding.

1. State the contract before the solution: order, mutation, missing values, failure behavior and input assumptions.
2. Explain why the algorithm works and give a case that breaks a plausible incorrect implementation.
3. Put exercise answers under a `### Спойлер` heading.
4. For an independent compilable snippet, use a `ts check` code fence. Include every type/dependency it needs. Deliberate compile errors must use @ts-expect-error and explain why.
5. Full implementations go in examples/ with behavior tests. Do not use a mock to claim guarantees of a real database or network.
6. Add new numbered Markdown lessons and update reading paths in course.json. IDs and existing URLs should remain stable.
7. Run `npm run verify`. Describe changes to evaluation inputs and do not reuse an exposed task as an unseen learning benchmark.

Report a content issue with chapter/section, the confusing statement, expected interpretation and, when possible, a minimal example. Avoid claims that a passing LLM experiment proves human learning effectiveness.
