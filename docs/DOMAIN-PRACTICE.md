# Shared practice across four domains

The browser offers three exercises with the **same contracts and solutions** in every domain. The global selector changes entity names, IDs and numeric fields in lesson examples and practice. It does not introduce unrelated tasks or change the algorithm.

| Domain           | Entity  | ID        | Numeric field |
| ---------------- | ------- | --------- | ------------- |
| Product catalog  | Product | productId | price         |
| Analytics events | Page    | pageId    | views         |
| Background jobs  | Job     | jobId     | attempts      |
| Profile sync     | Profile | profileId | reputation    |

The vocabulary panel explains the selected scenario as well as listing its fields. Catalog examples use supplier snapshots; analytics uses snapshots of page view counts; jobs uses reported job state; profiles uses synchronized profile state. Importing a job update does not execute or retry a job, and a view-count snapshot is not an increment to apply on every delivery.

Update exercises use three different identifiers:

- `sourceId` identifies the supplying feed or system.
- The selected entity ID identifies state within that source; for jobs the pair is `(sourceId, jobId)`.
- `eventId` identifies an emitted event within a source. It is not the entity ID. `version` orders state for a source/entity pair.

1. Validate an unknown update and return a fresh normalized object. Preserve zero; reject invalid IDs, versions and numeric values.
2. Deduplicate delivery within a source and retain the latest entity version within that source. Keep first appearance order and the first record on version ties. Do not mutate inputs.
3. Save with bounded concurrency. Return one success/failure outcome per input in input order; one failure must not discard other results.

These numeric fields deliberately share the simplified rule “finite, nonnegative number”. A real views/attempts count would normally add an integer constraint; introducing that here would change the exercise contract between domains.

Each exercise owns its behavior contract. Shared practice removes duplicate deliveries before selecting the latest state. The mock interview instead returns one outcome for every input, including repeated deliveries, and delegates version selection to an atomic repository operation. The vocabulary picker does not make those two tasks interchangeable.

[English source](../content/practice.en.md) · [Русский](../content/practice.ru.md) · [Español](../content/practice.es.md)

The neutral implementation is `examples/training-core.ts`, tested by `examples/training-core.test.ts`. Practice is a numbered step between the workshop and mock interview in both routes, with completion tracking and previous/next links. Each answer stays under a closed spoiler; the final section lists expected outcomes for manual checks. The reader copies displayed code rather than linking to a standalone TypeScript download.
