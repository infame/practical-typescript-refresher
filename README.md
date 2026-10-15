# Practical TypeScript Refresher

[Open the training](https://infame.github.io/practical-typescript-refresher/) · [Русский](README.ru.md) · [Español](README.es.md)

A practical refresher for developers who know programming and want to get back to TypeScript. **Choose a topic → review the rule → write code → compare your solution.** All 14 chapters and the shared practice are available in English, Russian and Spanish. English is canonical.

## How to use it

- Choose a topic or follow a guided route: return to TypeScript or prepare for a backend coding interview. Practice is part of both routes, between the workshop and mock interview.
- Select an example domain at the top right: product catalog, analytics events, background jobs or profile sync. The same exercise contracts use your selected names and fields.
- Write your solution in your usual editor, work through the expected outcomes, then open the spoiler. Copy code copies an example; the site does not execute your solution.
- Search explanations and code, including answers. Reading progress is stored in your browser and shared across languages.

The optional 12-question self-check links answers to explanations and official references. It checks specific rules; it is not a coding skill assessment. Answers are not saved when you leave the page. No account, analytics or uploaded answers.

## Topics

Types, inference, narrowing, generics, JavaScript behavior, collections, async, concurrency, validation, data ingestion, debugging and tests. Ten compiler-error walkthroughs, a workshop and a mock interview help turn explanations into code.

SQL, durable delivery, algorithm patterns and Node tooling are introductory. Frameworks, security, system design and specialist algorithms need separate preparation. This is a refresher, not a promise of passing every interview.

## Run locally

Requires Node.js 24+ and npm. From a checkout of this repository:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4173. Use `/ru/` or `/es/` for translations. Serve over HTTP rather than opening HTML files directly.

## Contribute

Corrections, clearer examples and reports of confusing exercises are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for source locations, verification and publishing instructions.

## License

[MIT](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for dependency attribution.
