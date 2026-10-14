import fs from 'node:fs/promises';
import path from 'node:path';
import { domains, adaptDomain, escape, renderContent } from './course-content.mjs';

const root = path.resolve(import.meta.dirname, '..'),
  dist = path.join(root, 'dist');
const config = JSON.parse(await fs.readFile(path.join(root, 'course.json'), 'utf8'));
const translations = JSON.parse(await fs.readFile(path.join(root, 'content/ui.json'), 'utf8'));
const files = (await fs.readdir(path.join(root, 'lessons')))
  .filter((f) => /^\d+.*\.md$/.test(f))
  .sort();
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });
await fs.copyFile(
  path.join(root, 'node_modules/highlight.js/styles/github.css'),
  path.join(root, 'assets/highlight.css'),
);
for (const dir of ['assets', 'lessons', 'examples', 'docs', 'content'])
  await fs.cp(path.join(root, dir), path.join(dist, dir), { recursive: true });
for (const f of [
  'README.md',
  'README.ru.md',
  'README.es.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
])
  await fs.copyFile(path.join(root, f), path.join(dist, f));
await fs.mkdir(path.join(dist, 'benchmarks'));
await fs.copyFile(path.join(root, 'benchmarks/TASKS.md'), path.join(dist, 'benchmarks/TASKS.md'));
for (const lang of ['en', 'ru', 'es']) {
  const ui = translations[lang],
    base = lang === 'en' ? '' : '../',
    directory = lang === 'en' ? dist : path.join(dist, lang);
  await fs.mkdir(directory, { recursive: true });
  const lessons = await Promise.all(
    files.map(async (file) => {
      const sourcePath = lang === 'en' ? `lessons/${file}` : `lessons/${lang}/${file}`;
      const source = await fs.readFile(path.join(root, sourcePath), 'utf8');
      const title = source.match(/^# (.+)$/m)[1],
        number = Number(file.slice(0, 2));
      return {
        number,
        id: file.slice(0, -3),
        file,
        href: file.replace('.md', '.html'),
        title,
        sourcePath,
        source,
      };
    }),
  );
  const byNumber = new Map(lessons.map((l) => [l.number, l]));
  for (const track of Object.values(config.tracks))
    if (track.chapters.some((n) => !byNumber.has(n))) throw new Error('Invalid route');
  const routeIds = config.tracks.refresher.chapters;
  const ordered = routeIds.map((n) => byNumber.get(n));
  const questions = JSON.parse(
    await fs.readFile(path.join(root, `content/questions.${lang}.json`), 'utf8'),
  );
  for (const q of questions)
    if (
      !byNumber.has(q.chapter) ||
      !Number.isInteger(q.answer) ||
      q.answer < 0 ||
      q.answer >= q.options.length
    )
      throw new Error('Invalid question');
  const practiceSource = await fs.readFile(path.join(root, `content/practice.${lang}.md`), 'utf8');
  const pages = {},
    search = {};
  for (const domain of domains) {
    pages[domain.id] = {};
    search[domain.id] = [];
    for (const lesson of lessons) {
      const rendered = renderContent(adaptDomain(lesson.source, domain), ui.solution);
      pages[domain.id][lesson.id] = rendered;
      search[domain.id].push(
        ...rendered.sections.map((s) => ({
          ...s,
          lessonTitle: lesson.title,
          href: lesson.href,
          chapter: lesson.number,
        })),
      );
    }
    const rendered = renderContent(
      adaptDomain(practiceSource.replace(/^# .+\n/, ''), domain),
      ui.solution,
    );
    pages[domain.id].practice = rendered;
    search[domain.id].push(
      ...rendered.sections.map((s) => ({
        ...s,
        lessonTitle: ui.practice,
        href: 'practice.html',
        chapter: 0,
      })),
    );
  }
  const publicData = {
    lang,
    base,
    ui,
    domains,
    questions,
    lessons: lessons.map(({ source, ...l }) => l),
    tracks: config.tracks,
    pages,
    search,
  };
  await fs.writeFile(
    path.join(dist, `assets/course-${lang}.js`),
    `window.COURSE=${JSON.stringify(publicData)};\n`,
  );
  const start = byNumber.get(routeIds[0]);
  function shell(title, body, lesson = null) {
    const current = lesson?.number || 0;
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(ui.description)}"><meta name="color-scheme" content="light"><title>${escape(title)} · ${ui.brand}</title><link rel="stylesheet" href="${base}assets/highlight.css"><link rel="stylesheet" href="${base}assets/style.css"><script src="${base}assets/course-${lang}.js" defer></script><script src="${base}assets/app.js" type="module"></script></head><body data-lesson="${current}" data-page="${lesson?.id || (title === ui.practice ? 'practice' : 'home')}"><a class="skip" href="#content">${ui.skip}</a><header class="site-header"><a class="brand" href="index.html">${ui.brand}</a><div class="header-controls"><label>${ui.domain}<select id="domain-select">${domains.map((d) => `<option value="${d.id}">${ui[d.id]}</option>`).join('')}</select></label><label>${ui.language}<select id="language-select">${[
      ['en', 'English'],
      ['ru', 'Русский'],
      ['es', 'Español'],
    ]
      .map(
        ([code, name]) =>
          `<option value="${code}" ${code === lang ? 'selected' : ''}>${name}</option>`,
      )
      .join(
        '',
      )}</select></label><a href="https://github.com/infame/practical-typescript-refresher">GitHub</a></div></header><div class="layout"><aside><details class="course-menu" open><summary>${ui.contents}</summary><nav class="primary-nav"><a href="index.html#diagnostic">${ui.diagnostic}</a><a href="practice.html">${ui.practice}</a><a href="index.html#scope">${ui.scope}</a></nav><label class="search-label" for="chapter-search">${ui.search}</label><input id="chapter-search" type="search" placeholder="${escape(ui.searchHint)}" autocomplete="off"><div id="search-results" aria-live="polite" hidden></div><div class="progress-box"><p id="progress-label" aria-live="polite"></p><progress id="course-progress" max="${lessons.length}" value="0">0%</progress><p class="storage-note" hidden>${ui.storageNote}</p></div><ol class="chapters">${ordered.map((l, i) => `<li><a href="${l.href}" data-chapter="${l.number}" ${current === l.number ? 'aria-current="page"' : ''}><span class="chapter-number">${i + 1}</span><span>${escape(l.title)}</span><span class="check" aria-hidden="true"></span></a></li>`).join('')}</ol></details></aside><main id="content" tabindex="-1">${body}</main></div><footer class="site-footer"><a href="https://github.com/infame/practical-typescript-refresher">${ui.github}</a></footer></body></html>`;
  }
  async function output(file, html) {
    await fs.writeFile(path.join(directory, file), html);
    if (lang === 'en') await fs.writeFile(path.join(root, file), html);
  }
  function pager(lesson, location) {
    const index = ordered.findIndex((l) => l.number === lesson.number),
      prev = ordered[index - 1],
      next = ordered[index + 1];
    return `<nav class="pager" aria-label="${ui.navigation}"><a data-prev href="${prev?.href || 'index.html'}"><span>‹ ${ui.prev}</span><small>${escape(prev?.title || ui.home)}</small></a><span class="page-count">${index + 1} / ${lessons.length}</span><a data-next href="${next?.href || 'practice.html'}"><span>${ui.next} ›</span><small>${escape(next?.title || ui.practice)}</small></a></nav>`;
  }
  function vocabulary() {
    return `<section class="domain-vocabulary"><strong>${ui.domainModel}: <span id="domain-name">${ui.catalog}</span></strong><p>${ui.entity}: <code id="domain-entity">Product</code> · ID: <code id="domain-id">productId</code> · ${ui.metric}: <code id="domain-metric">price</code></p><small>${ui.terms}</small></section>`;
  }
  function toc(rendered) {
    return `<nav class="local-toc" aria-label="${ui.inChapter}"><strong>${ui.inChapter}</strong>${rendered.toc.map((h) => `<a href="#${h.id}">${escape(h.title)}</a>`).join('')}</nav>`;
  }
  for (const lesson of lessons) {
    const rendered = pages.catalog[lesson.id];
    const page = shell(
      lesson.title,
      `${pager(lesson, 'top')}<div class="lesson-meta"><span id="route-label">${ui.routeRefresh}</span><a href="${base + lesson.sourcePath}" id="markdown-link">${ui.markdown}</a></div>${vocabulary()}<div id="lesson-toc">${toc(rendered)}</div><article id="lesson-article">${rendered.html}</article><div class="completion"><button id="complete-button" type="button" aria-pressed="false">${ui.mark}</button><span id="completion-status">${ui.tryFirst}</span></div>${pager(lesson, 'bottom')}<p><a href="practice.html">${ui.practiceNext}</a></p>`,
      lesson,
    );
    await output(lesson.href, page);
  }
  const pract = pages.catalog.practice;
  await output(
    'practice.html',
    shell(
      ui.practice,
      `<h1>${ui.practice}</h1><p>${ui.practiceIntro}</p>${vocabulary()}<section class="practice-prerequisites"><h2>${ui.prerequisites}</h2><p>${[3, 1, 5, 9].map((n) => `<a href="${byNumber.get(n).href}">${escape(byNumber.get(n).title)}</a>`).join(' · ')}</p></section><article id="lesson-article">${pract.html}</article><p><a href="${base}content/practice.${lang}.md">${ui.markdown}</a> · <a href="${base}examples/training-core.ts">TypeScript</a></p><a class="primary-link" href="${byNumber.get(10).href}">${escape(byNumber.get(10).title)}</a>`,
    ),
  );
  const quiz = `<section id="diagnostic"><h2>${ui.diagnostic}</h2><p>${ui.diagnosticIntro}</p><details><summary>${ui.startDiagnostic}</summary><form id="diagnostic-form">${questions.map((q, i) => `<fieldset><legend>${i + 1}. ${escape(q.topic)}</legend>${renderContent('```ts\n' + q.code + '\n```', ui.solution).html}<p>${escape(q.prompt)}</p>${[...q.options, ui.unknown].map((o, j) => `<label class="answer-option"><input type="radio" name="q${i}" value="${j}">${escape(o)}</label>`).join('')}</fieldset>`).join('')}<button type="submit">${ui.showGaps}</button><button type="reset" class="secondary-button">${ui.reset}</button><p id="diagnostic-status" role="status"></p></form><div id="diagnostic-results" hidden></div></details></section>`;
  const scope = `<section id="scope"><h2>${ui.scope}</h2><p>${ui.scopeIntro}</p><table><thead><tr><th>${ui.trained}</th><th>${ui.sources}</th></tr></thead><tbody>${ui.coverage
    .slice(0, 2)
    .map(
      ([a, b]) =>
        `<tr><td>${a}</td><td>${b
          .split(',')
          .map((n) => byNumber.get(Number(n.trim())))
          .map((l) => `<a href="${l.href}">${escape(l.title)}</a>`)
          .join(' · ')}</td></tr>`,
    )
    .join(
      '',
    )}</tbody></table><h3>${ui.introduced}</h3><p>${ui.coverage[2][0]}. ${[7, 8, 13].map((n) => `<a href="${byNumber.get(n).href}">${escape(byNumber.get(n).title)}</a>`).join(' · ')}</p><h3>${ui.outside}</h3><p>${ui.coverage[3][0]}</p><p><a href="https://www.typescriptlang.org/docs/handbook/intro.html">TypeScript Handbook</a> · <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript">MDN JavaScript</a> · <a href="https://nodejs.org/api/">Node.js</a></p></section>`;
  const tracks = ['refresher', 'interview']
    .map(
      (key) =>
        `<section class="track"><h3>${key === 'refresher' ? ui.routeRefresh : ui.routeInterview}</h3><p>${key === 'refresher' ? ui.routeRefreshDesc : ui.routeInterviewDesc}</p><a class="primary-link" href="${byNumber.get(config.tracks[key].chapters[0]).href}?track=${key}">${ui.startRoute}</a></section>`,
    )
    .join('');
  await output(
    'index.html',
    shell(
      ui.home,
      `<section class="intro"><h1>${ui.hero.split('\n').join('<br>')}</h1><p class="lead">${ui.intro}</p><a class="primary-link" href="#diagnostic">${ui.diagnostic}</a> <a id="resume-link" href="${start.href}">${ui.start}</a><p>${ui.domainNote}</p></section><section class="journey"><h2>${ui.journey}</h2><ol>${[ui.journey1, ui.journey2, ui.journey3, ui.journey4].map((s) => `<li>${s.replace(/^\d\. /, '')}</li>`).join('')}</ol></section>${quiz}<section><h2>${ui.route}</h2><div class="tracks">${tracks}</div></section><section><h2>${ui.practice}</h2><p>${ui.practiceIntro}</p><a class="primary-link" href="practice.html" id="domain-practice-link">${ui.practiceNext}</a></section>${scope}`,
    ),
  );
}
console.log(
  `Built 3 languages × ${files.length + 2} pages; 4 domain variants; section-level content indexes.`,
);
