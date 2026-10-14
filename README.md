# Practical TypeScript Refresher

[Open the training](https://infame.github.io/practical-typescript-refresher/) · [Русский](https://infame.github.io/practical-typescript-refresher/ru/) · [Español](https://infame.github.io/practical-typescript-refresher/es/)

For developers who know programming but have forgotten the details of TypeScript. **Find gaps → review explanations → write code → check your reasoning.** English is the default; all 14 chapters, the diagnostic and practice are also available in Russian and Spanish.

[Русский README](README.ru.md) · [README en español](README.es.md) · [Curriculum](course.json) · [Evaluation](docs/EVALUATION.md) · [Content audit](docs/AUDIT.md)

## Find your gaps, then practice

Start with 12 diagnostic questions. Wrong and unknown answers produce explanations, relevant chapters and official MDN / TypeScript / Node documentation. This score measures your answers, not coding competence. No account, analytics or uploaded answers.

Choose your domain at the top right: product catalog, analytics events, background jobs or profile sync. The same lessons and three practice contracts use the selected entity names and fields. Changing domains keeps your page, language and reading route. [Practice contracts and domain mapping](docs/DOMAIN-PRACTICE.md).

Search indexes explanations **and code**, including spoiler answers, and links to the matching section. Solutions stay collapsed until you open them, or follow a search result that matches their content. Chapter progress is saved locally and shared across languages.

If this helps, a GitHub star makes the project easier to discover. Corrections, clearer explanations and reports of gaps are welcome.

## Coverage

Two reading paths: return to TS after a break, or rehearse practical backend coding. Prev / Next at both ends follow the selected route.

The training covers inference, narrowing, practical generics, type design, JavaScript behavior, collections, concurrency, validation, ingestion and failure handling. SQL, durable events, BFS/DFS/heaps and Node tooling are introductions. React/DOM, framework APIs, security, system design, advanced dynamic programming and distributed transactions need separate preparation. The home page maps coverage to chapters.

This is a refresher, not a comprehensive course or a guarantee of passing any interview. Exercises are original and independent of a particular employer.

## Content highlights

Ten compiler-error walkthroughs pair intentional errors with explained fixes. Five wrong implementations have concrete counterexamples, and the workshop ends with a fifteen-trap review sheet. All additions are available in English, Russian and Spanish.

[Content release plan](docs/PLAN.md) · [Compiler-error clinic](lessons/13-tooling.md) · [Workshop and review sheet](lessons/14-workshop.md)

## Start locally

Requires Node.js 24+ and npm.

```sh
npm ci
npm run verify
npm start
```

Open http://127.0.0.1:4173. Use `/ru/` or `/es/` for translations. Serve the built site over HTTP; the browser modules need a server.

## Check your own work

```sh
npm run check:content
npm run check
npm test
npm run check:snippets
npm run check:site
npm run eval -- /absolute/path/to/solution.ts
```

The evaluation harness runs the submitted module on your machine. Use your own or reviewed code. [Benchmark tasks](benchmarks/TASKS.md) are separate from the diagnostic; reading their checks first makes them practice rather than an unseen evaluation. Example tests and an LLM experiment do not prove human learning effectiveness.

## Edit and contribute

Canonical English sources are in `lessons/`, Russian in `lessons/ru/` and Spanish in `lessons/es/`. Shared practice, diagnostic questions and UI translations are in `content/`. Domain vocabulary is defined in `scripts/course-content.mjs`. Tested implementations are in `examples/`.

Run `npm run build` after editing. The static site goes into `dist/`; root HTML copies preserve existing lesson filenames. Keep chapter IDs and section order consistent across languages and update `course.json` for route changes. See [CONTRIBUTING](CONTRIBUTING.md).

CI verifies on Node 24. GitHub Pages uses a manual publishing workflow. Built with markdown-it, highlight.js and Node; no client CDN or framework. Dependency versions are recorded in package-lock.json.

## License

MIT. The bundled highlight.js stylesheet is BSD-3-Clause; see [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).
