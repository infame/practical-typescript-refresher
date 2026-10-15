import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { domains, adaptDomain, escape, renderContent } from './course-content.mjs';

const root = path.resolve(import.meta.dirname, '..'),
  dist = path.join(root, 'dist');
const siteUrl = 'https://infame.github.io/practical-typescript-refresher/';
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
for (const dir of ['lessons', 'examples', 'docs', 'content'])
  await fs.cp(path.join(root, dir), path.join(dist, dir), { recursive: true });
await fs.mkdir(path.join(dist, 'assets'));
const socialImage = await fs.readFile(path.join(root, 'assets/social-preview.png'));
const socialImageName = `social-preview-${createHash('sha256').update(socialImage).digest('hex').slice(0, 12)}.png`;
await fs.writeFile(path.join(dist, 'assets', socialImageName), socialImage);
const socialImageUrl = new URL(`assets/${socialImageName}`, siteUrl).href;
const assetVersions = {};
for (const file of ['search.mjs', 'app.js', 'style.css', 'highlight.css']) {
  let source = await fs.readFile(path.join(root, 'assets', file), 'utf8');
  if (file === 'app.js')
    source = source.replace('./search.mjs', `./search.mjs?v=${assetVersions['search.mjs']}`);
  assetVersions[file] = createHash('sha256').update(source).digest('hex').slice(0, 12);
  await fs.writeFile(path.join(dist, 'assets', file), source);
}
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
  const practice = { id: 'practice', number: 0, title: ui.practice, href: 'practice.html' };
  const byStep = new Map([...byNumber, ['practice', practice]]);
  for (const track of Object.values(config.tracks))
    if (track.steps.some((n) => !byStep.has(n))) throw new Error('Invalid route');
  const routeIds = config.tracks.refresher.steps;
  const ordered = routeIds.map((n) => byStep.get(n));
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
  const courseScript = `window.COURSE=${JSON.stringify(publicData)};\n`;
  const courseVersion = createHash('sha256').update(courseScript).digest('hex').slice(0, 12);
  await fs.writeFile(path.join(dist, `assets/course-${lang}.js`), courseScript);
  const start = byNumber.get(routeIds[0]);
  function shell(title, body, lesson = null) {
    const current = lesson?.number || 0;
    const pageUrl = new URL(`${lang === 'en' ? '' : `${lang}/`}${lesson?.href || ''}`, siteUrl)
      .href;
    const socialTitle = lesson
      ? `${title} · Practical TypeScript Refresher`
      : 'Practical TypeScript Refresher';
    const socialAlt =
      'Practical TypeScript Refresher. Explanations, coding practice and official references. EN / ES / RU.';
    const socialMeta = `<link rel="canonical" href="${pageUrl}"><meta property="og:type" content="website"><meta property="og:site_name" content="Practical TypeScript Refresher"><meta property="og:title" content="${escape(socialTitle)}"><meta property="og:description" content="${escape(ui.description)}"><meta property="og:url" content="${pageUrl}"><meta property="og:locale" content="${{ en: 'en_US', es: 'es_ES', ru: 'ru_RU' }[lang]}"><meta property="og:image" content="${socialImageUrl}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${socialAlt}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(socialTitle)}"><meta name="twitter:description" content="${escape(ui.description)}"><meta name="twitter:image" content="${socialImageUrl}"><meta name="twitter:image:alt" content="${socialAlt}">`;
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(ui.description)}"><meta name="color-scheme" content="light">${socialMeta}<title>${escape(title)} · ${ui.brand}</title><link rel="stylesheet" href="${base}assets/highlight.css?v=${assetVersions['highlight.css']}"><link rel="stylesheet" href="${base}assets/style.css?v=${assetVersions['style.css']}"><script src="${base}assets/course-${lang}.js?v=${courseVersion}" defer></script><script src="${base}assets/app.js?v=${assetVersions['app.js']}" type="module"></script></head><body data-lesson="${current}" data-page="${lesson?.id || (title === ui.practice ? 'practice' : 'home')}"><a class="skip" href="#content">${ui.skip}</a><header class="site-header"><a class="brand" href="index.html">${ui.brand}</a><div class="header-controls"><label>${ui.domain}<select id="domain-select" disabled>${domains.map((d) => `<option value="${d.id}">${ui[d.id]}</option>`).join('')}</select></label><label>${ui.language}<select id="language-select" disabled>${[
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
      )}</select></label><a href="https://github.com/infame/practical-typescript-refresher">GitHub</a></div></header><div class="layout"><aside><details class="course-menu" open><summary>${ui.contents}</summary><nav class="primary-nav"><a href="index.html#topics">${ui.topics}</a><a href="index.html#diagnostic">${ui.diagnostic}</a><a href="index.html#scope">${ui.scope}</a></nav><label class="search-label" for="chapter-search">${ui.search}</label><input id="chapter-search" disabled type="search" placeholder="${escape(ui.searchHint)}" autocomplete="off"><div id="search-results" aria-live="polite" hidden></div><div class="progress-box"><p id="progress-label" aria-live="polite"></p><progress id="course-progress" max="${ordered.length}" value="0">0%</progress><p class="storage-note" hidden>${ui.storageNote}</p></div><ol class="chapters">${ordered.map((l, i) => `<li><a href="${l.href}" data-step="${l.id}" ${lesson?.id === l.id ? 'aria-current="page"' : ''}><span class="chapter-number">${i + 1}</span><span>${escape(l.title)}</span><span class="check" aria-hidden="true"></span></a></li>`).join('')}</ol></details></aside><main id="content" tabindex="-1">${body}</main></div><footer class="site-footer"><a href="https://github.com/infame/practical-typescript-refresher">${ui.github}</a></footer></body></html>`;
  }
  async function output(file, html) {
    await fs.writeFile(path.join(directory, file), html);
    if (lang === 'en') await fs.writeFile(path.join(root, file), html);
  }
  function pager(lesson, location) {
    const index = ordered.findIndex((l) => l.id === lesson.id),
      prev = ordered[index - 1],
      next = ordered[index + 1];
    return `<nav class="pager" aria-label="${ui.navigation}"><a data-prev href="${prev?.href || 'index.html'}"><span>‹ ${ui.prev}</span><small>${escape(prev?.title || ui.home)}</small></a><span class="page-count">${index + 1} / ${ordered.length}</span><a data-next href="${next?.href || 'index.html#topics'}"><span>${next ? ui.next : ui.home} ›</span><small>${escape(next?.title || ui.finished)}</small></a></nav>`;
  }
  function completion() {
    return `<div class="completion"><button id="complete-button" type="button" disabled aria-pressed="false">${ui.mark}</button><span id="completion-status">${ui.tryFirst}</span></div>`;
  }
  function vocabulary() {
    return `<section class="domain-vocabulary"><strong>${ui.domainModel}: <span id="domain-name">${ui.catalog}</span></strong><p id="domain-description">${escape(ui.domainDescriptions.catalog)}</p><p>${ui.entity}: <code id="domain-entity">Product</code> · ID: <code id="domain-id">productId</code> · ${ui.metric}: <code id="domain-metric">price</code></p><small>${ui.terms}</small></section>`;
  }
  function toc(rendered) {
    return `<nav class="section-nav" aria-label="${ui.inChapter}"><strong>${ui.inChapter}</strong>${rendered.toc.map((h) => `<a href="#${h.id}">${escape(h.title)}</a>`).join('')}</nav>`;
  }
  for (const lesson of lessons) {
    const rendered = pages.catalog[lesson.id];
    const page = shell(
      lesson.title,
      `${pager(lesson, 'top')}<div class="lesson-meta"><span id="route-label">${ui.routeRefresh}</span><a href="${base + lesson.sourcePath}" id="markdown-link">${ui.markdown}</a></div>${vocabulary()}<div id="lesson-toc">${toc(rendered)}</div><article id="lesson-article">${rendered.html}</article>${completion()}${pager(lesson, 'bottom')}`,
      lesson,
    );
    await output(lesson.href, page);
  }
  const pract = pages.catalog.practice;
  await output(
    'practice.html',
    shell(
      ui.practice,
      `${pager(practice, 'top')}<div class="lesson-meta"><span id="route-label">${ui.routeRefresh}</span></div><h1>${ui.practice}</h1><p>${ui.practiceIntro}</p>${vocabulary()}<section class="practice-prerequisites"><h2>${ui.prerequisites}</h2><p>${[3, 1, 5, 9].map((n) => `<a href="${byNumber.get(n).href}">${escape(byNumber.get(n).title)}</a>`).join(' · ')}</p></section><article id="lesson-article">${pract.html}</article>${completion()}${pager(practice, 'bottom')}`,
      practice,
    ),
  );
  const quiz = `<section id="diagnostic"><h2>${ui.diagnostic}</h2><p>${ui.diagnosticIntro}</p><details><summary>${ui.startDiagnostic}</summary><form id="diagnostic-form">${questions.map((q, i) => `<fieldset disabled><legend>${i + 1}. ${escape(q.topic)}</legend>${renderContent('```ts\n' + q.code + '\n```', ui.solution).html}<p>${escape(q.prompt)}</p>${[...q.options, ui.unknown].map((o, j) => `<label class="answer-option"><input type="radio" name="q${i}" value="${j}">${escape(o)}</label>`).join('')}</fieldset>`).join('')}<button type="submit" disabled>${ui.showGaps}</button><button type="reset" class="secondary-button" disabled>${ui.reset}</button><p id="diagnostic-status" role="status"></p></form><div id="diagnostic-results" hidden></div></details></section>`;
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
        `<section class="track"><h3>${key === 'refresher' ? ui.routeRefresh : ui.routeInterview}</h3><p>${key === 'refresher' ? ui.routeRefreshDesc : ui.routeInterviewDesc}</p><a class="primary-link" href="${byStep.get(config.tracks[key].steps[0]).href}?track=${key}">${ui.startRoute}: ${key === 'refresher' ? ui.routeRefresh : ui.routeInterview}</a></section>`,
    )
    .join('');
  const topics = `<section id="topics"><h2>${ui.topics}</h2><p>${ui.topicsIntro}</p><div class="topic-groups">${ui.topicGroups
    .map(([title, description, chapters]) => {
      const selected = chapters.split(',').map((n) => byNumber.get(Number(n.trim())));
      if (selected.some((lesson) => !lesson)) throw new Error('Invalid topic group');
      return `<section class="topic-group"><h3>${escape(title)}</h3><p>${escape(description)}</p><ul>${selected.map((lesson) => `<li><a href="${lesson.href}">${escape(lesson.title)}</a></li>`).join('')}</ul></section>`;
    })
    .join('')}</div></section>`;
  await output(
    'index.html',
    shell(
      ui.home,
      `<section class="intro"><h1>${ui.hero.split('\n').join('<br>')}</h1><p class="lead">${ui.intro}</p><div class="entry-actions"><a class="primary-link" id="resume-link" href="${start.href}">${ui.start}</a><a href="#topics">${ui.browseTopics}</a></div></section>${topics}<section id="practice-entry"><h2>${ui.practice}</h2><p>${ui.practiceIntro}</p><a class="primary-link" href="practice.html" id="domain-practice-link">${ui.practiceNext}</a></section><section id="routes"><h2>${ui.route}</h2><div class="tracks">${tracks}</div></section>${quiz}${scope}`,
    ),
  );
}
console.log(
  `Built 3 languages × ${files.length + 2} pages; 4 domain variants; section-level content indexes.`,
);
