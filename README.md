# Practical TypeScript Refresher

[Read the course in your browser](https://infame.github.io/practical-typescript-refresher/)
A practical refresher for developers who know programming and have forgotten the details of TypeScript. **Explanations → code → exercises → spoilers**, with tested implementations and a browser reader.

**The course is in Russian.** [Русский README](README.ru.md) · [Curriculum](course.json) · [Evaluation](docs/EVALUATION.md) · [Content audit](docs/AUDIT.md)

## Start locally

Requires Node.js 24+ and npm.

```sh
npm ci
npm run verify
npm start
```

Open http://127.0.0.1:4173. You can also open `dist/index.html` directly after building; use the local server for consistent cross-page progress storage.

## Two reading paths

- **Returning to TS:** language and inference → runtime pitfalls → narrowing → type design → tooling → data processing → async → practical exercises.
- **Preparing for a coding interview:** collections → JS/TS → concurrency → ingestion → SQL → algorithms → review → workshop → mock interview.

14 chapters cover the language, backend data processing and failure handling. React, DOM and advanced library authoring are outside this edition. These are original exercises, not a list of any company's interview questions.

## What makes this useful

- Explain why the code works before showing a solution.
- Predict output, implement functions, diagnose bugs and check edge cases.
- Read in the browser with syntax highlighting, chapter search, Prev / Next at both ends and local progress.
- Run real implementations with strict TypeScript and deterministic tests.
- Inspect a separate task-solving evaluation; successful example tests are not presented as proof of learning.

## Verify your own work

```sh
npm run check
npm test
npm run check:snippets
npm run check:site
```

Study `lessons/*.md`. Try the workshop before reading `examples/workshop.ts`. For an independent submission, use [benchmark tasks](benchmarks/TASKS.md):

```sh
npm run eval -- /absolute/path/to/solution.ts
```

The harness executes the submitted module on your machine. Use your own solution or code you have reviewed. Reading the benchmark checks before solving makes it a practice exercise rather than a blind evaluation.

## Edit and contribute

Change Markdown, then run `npm run build`. The static site is generated into `dist/`; root HTML copies preserve local file links. A new numbered lesson automatically joins the full course; update `course.json` to include it in a reading path. See [CONTRIBUTING](CONTRIBUTING.md) for snippet checks and review criteria.

CI verifies the course on Node 24. GitHub Pages has an opt-in manual workflow; publishing requires Pages configured to use GitHub Actions.

Built with markdown-it, highlight.js and Node. No client CDN or framework required. Dependencies and versions are recorded in package-lock.json.

## License

MIT. The bundled syntax-highlighting stylesheet is from highlight.js (BSD-3-Clause); its attribution is included in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).
