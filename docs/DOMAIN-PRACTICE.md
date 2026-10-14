# Shared practice across four domains

The browser offers three exercises with the **same contracts and solutions** in every domain. The global selector changes entity names, IDs and numeric fields in lesson examples and practice. It does not introduce unrelated tasks or change the algorithm.

| Domain | Entity | ID | Numeric field |
| --- | --- | --- | --- |
| Product catalog | Product | productId | price |
| Analytics events | Page | pageId | views |
| Background jobs | Job | jobId | attempts |
| Profile sync | Profile | profileId | reputation |

1. Validate an unknown update and return a fresh normalized object. Preserve zero; reject invalid IDs, versions and numeric values.
2. Deduplicate delivery within a source and retain the latest entity version within that source. Keep first appearance order and the first record on version ties. Do not mutate inputs.
3. Save with bounded concurrency. Return one success/failure outcome per input in input order; one failure must not discard other results.

These numeric fields deliberately share the simplified rule “finite, nonnegative number”. A real views/attempts count would normally add an integer constraint; introducing that here would change the exercise contract between domains.

[English source](../content/practice.en.md) · [Русский](../content/practice.ru.md) · [Español](../content/practice.es.md)

The neutral implementation is `examples/training-core.ts`, tested by `examples/training-core.test.ts`. The practice page shows prerequisites before the tasks, and answers under closed spoilers. No extra chapter outline appears below answers.

English `training.json` (with the earlier Russian copy in `content/training.ru.json`) and `examples/domains.ts` preserve the earlier, supplementary domain-specific tasks. They are separate exercises and are not the reader's shared practice flow.
