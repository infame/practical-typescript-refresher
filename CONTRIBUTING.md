# Contributing

The audience is experienced developers returning to TypeScript and practical backend coding. English is canonical; keep Russian and Spanish editions equivalent when changing learning content.

## Source map

| Location                                               | Purpose                                                 |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `lessons/`, `lessons/ru/`, `lessons/es/`               | English chapters and their translations                 |
| `content/practice.<language>.md`                       | Shared practice contracts and answers                   |
| `content/ui.json`, `content/questions.<language>.json` | Reader labels and optional self-check                   |
| `scripts/course-content.mjs`                           | Rendering, search indexing and domain substitutions     |
| `course.json`                                          | Ordered route `steps`: chapter numbers and `"practice"` |
| `assets/`                                              | Reader behavior and styles                              |
| `examples/`                                            | Implementations and behavior tests                      |
| `scripts/build.mjs`                                    | Static output in `dist/`; ignored root HTML copies      |

[Domain contracts and vocabulary](docs/DOMAIN-PRACTICE.md) explains how the four domains use the same exercises. Supplementary domain-specific examples are separate from that shared practice.

## Content changes

1. State the input/output contract before the solution: ordering, mutation, missing values, failures and assumptions. Explain why the solution works and show an input that breaks a plausible wrong approach.
2. Put answers under `### Spoiler` in English/Spanish or `### Спойлер` in Russian. Use inline code for identifiers, expressions, paths and commands; lists for requirements and test cases.
3. Use a `ts check` fence for an independently compilable snippet, with its dependencies. Explain intentional errors and mark them with `@ts-expect-error`. Add behavior tests for reusable implementations.
4. Update all three editions together. Preserve chapter IDs, section order and existing URLs; progress and translated anchors depend on them. Localize interface strings rather than hardcoding them in the reader.
5. Keep domain substitutions consistent with the stated exercise contract. Do not imply that an in-memory example provides durable database or delivery guarantees.

## Verify and preview

After `npm ci`, run:

```sh
npm run verify
npm start
```

`verify` checks content/translation parity, types, tests, independent snippets, the build and local links. It builds `dist/`, which `npm start` serves at http://127.0.0.1:4173. After another edit, run `npm run build` to refresh the preview. Check both routes, practice, copy buttons, search, language/domain switching and mobile navigation when changing the reader.

CI runs verification on Node.js 24. Maintainers publish by running **Publish course to Pages** (`.github/workflows/pages.yml`) on the intended branch; pushing alone does not publish the site.

## Optional coding benchmark

The six [benchmark tasks](benchmarks/TASKS.md) are separate from the browser practice and self-check. Export their functions and types in your own file, then run:

```sh
npm run eval -- /absolute/path/to/solution.ts
```

The harness type-checks and executes that file locally, so use your own or reviewed implementation. The checks are public; this is practice, not an unseen assessment. The [historical AI experiment](docs/EVALUATION.md) records its results and limits. Preserve the recorded input hashes and results; passing tests or an AI exercise run does not establish human learning effectiveness.

## Report a problem

Include the language, example domain, chapter/section, expected behavior and a minimal reproduction. Corrections and clearer explanations are welcome.
