# Contributing

Focus on experienced developers returning to TypeScript and practical backend coding. English is the default; Russian and Spanish are complete editions.

1. State the contract before the solution: order, mutation, missing values, failures and input assumptions.
2. Explain why the algorithm works and show a case that breaks a plausible wrong implementation.
3. Put exercise answers under `### Spoiler` (English/Spanish) or `### Спойлер` (Russian). The reader renders closed disclosures; do not put chapter navigation inside answers.
4. Use a `ts check` fence for an independent compilable snippet. Include dependencies; intentional errors need explained `@ts-expect-error`. Verification compiles all three languages across all four domain substitutions.
5. Put reusable implementations in `examples/` with behavior tests. Do not claim real network or database guarantees from a mock.
6. Update canonical English `lessons/`, Russian `lessons/ru/` and Spanish `lessons/es/` together. Preserve chapter IDs, section order and URLs. Update `course.json` for route changes.
7. Practice contracts live in `content/practice.<language>.md`; keep rules equivalent. Domain substitutions in `scripts/course-content.mjs` must preserve algorithm behavior. Numeric fields in the shared exercise intentionally use a simplified contract, not every business rule of a real domain.
8. Localize visible strings in `content/ui.json` and diagnostic content in `content/questions.<language>.json`.
9. Run `npm run verify`, then check navigation, search, diagnostics, language/domain switching and a narrow viewport in a browser.

Report issues with language, domain, chapter/section and a minimal example. Describe changes to evaluation inputs; exposed tasks are not unseen learning benchmarks. Do not equate a quiz score, chapter completion, example tests or an LLM experiment with demonstrated human learning.

English is the canonical language of root metadata and shared documentation. Store localized files under explicit locale paths. Run `npm run check:content` for edition parity and canonical-source checks. Recorded evaluation data/hashes are historical evidence; content edits must not replace them with current-input hashes.

In lesson prose, format identifiers, expressions, file paths and commands as inline code. Use lists for field validation, behavior requirements and test cases; keep one main idea per paragraph. Preserve section order so translated anchors still match, and keep formatting edits separate from changes to fenced examples.
