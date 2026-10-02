import fs from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const config = JSON.parse(await fs.readFile(path.join(root, 'course.json'), 'utf8'));
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, info) {
    const language = info.split(/\s+/)[0];
    return language && hljs.getLanguage(language)
      ? hljs.highlight(code, { language }).value
      : escape(code);
  },
});
const files = (await fs.readdir(path.join(root, 'lessons')))
  .filter((file) => file.endsWith('.md'))
  .sort();
const lessons = await Promise.all(
  files.map(async (file) => {
    const source = await fs.readFile(path.join(root, 'lessons', file), 'utf8');
    const title = source.match(/^# (.+)$/m)?.[1];
    const number = Number(file.split('-')[0]);
    if (!title || !Number.isInteger(number)) throw new Error(`Invalid lesson: ${file}`);
    return {
      file,
      title,
      number,
      id: file.replace('.md', ''),
      href: file.replace('.md', '.html'),
      source,
    };
  }),
);
if (new Set(lessons.map((l) => l.number)).size !== lessons.length)
  throw new Error('Duplicate chapter number');
for (const track of Object.values(config.tracks)) {
  if (
    new Set(track.chapters).size !== track.chapters.length ||
    track.chapters.some((n) => !lessons.some((l) => l.number === n))
  ) {
    throw new Error('Invalid track');
  }
}
const publicConfig = {
  title: config.title,
  tracks: config.tracks,
  lessons: lessons.map(({ source, ...lesson }) => lesson),
};
await fs.mkdir(dist, { recursive: true });
await fs.copyFile(
  path.join(root, 'node_modules/highlight.js/styles/github.css'),
  path.join(root, 'assets/highlight.css'),
);
await fs.writeFile(
  path.join(root, 'assets/course.js'),
  `window.COURSE = ${JSON.stringify(publicConfig)};\n`,
);
for (const directory of ['assets', 'lessons', 'examples', 'docs']) {
  await fs.cp(path.join(root, directory), path.join(dist, directory), { recursive: true });
}
for (const file of [
  'README.md',
  'README.ru.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
])
  await fs.copyFile(path.join(root, file), path.join(dist, file));
await fs.mkdir(path.join(dist, 'benchmarks'), { recursive: true });
await fs.copyFile(path.join(root, 'benchmarks/TASKS.md'), path.join(dist, 'benchmarks/TASKS.md'));

function pager(index, location) {
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  return `<nav class="pager" aria-label="Навигация ${location}"><a class="prev" data-prev href="${prev?.href || 'index.html'}"><span>‹ Prev</span><small>${escape(prev?.title || 'Оглавление')}</small></a><span class="page-count">${index + 1} / ${lessons.length}</span><a class="next" data-next href="${next?.href || 'index.html'}"><span>${next ? 'Next ›' : 'К оглавлению ›'}</span><small>${escape(next?.title || 'Курс завершён')}</small></a></nav>`;
}
function shell(title, content, current = 0, toc = []) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(config.description)}"><meta name="color-scheme" content="light"><title>${escape(title)} · ${escape(config.title)}</title><link rel="stylesheet" href="assets/highlight.css"><link rel="stylesheet" href="assets/style.css"><script src="assets/course.js" defer></script><script src="assets/app.js" defer></script></head><body data-lesson="${current}"><a class="skip" href="#content">К содержанию</a><header class="site-header"><a class="brand" href="index.html">${escape(config.title)}</a><span>${escape(config.description)}</span></header><div class="layout"><aside><details class="course-menu" open><summary>Оглавление курса</summary><label class="search-label" for="chapter-search">Найти главу</label><input id="chapter-search" type="search" placeholder="Типы, async, parser…" autocomplete="off"><div class="progress-box"><p id="progress-label" aria-live="polite">Пройдено 0 из ${lessons.length} глав · 0%</p><progress id="course-progress" max="${lessons.length}" value="0">0%</progress><small id="progress-scope">По завершённым главам</small><p class="storage-note" hidden>Браузер не сохраняет прогресс. Откройте курс через локальный сервер.</p></div><ol class="chapters">${lessons.map((l) => `<li><a href="${l.href}" data-chapter="${l.number}" ${current === l.number ? 'aria-current="page"' : ''}><span class="chapter-number">${l.number}</span><span>${escape(l.title)}</span><span class="check" aria-hidden="true"></span></a></li>`).join('')}</ol><p id="search-empty" hidden>Главы не найдены.</p></details></aside><main id="content" tabindex="-1">${content}</main>${toc.length ? `<nav class="local-toc" aria-label="В этой главе"><strong>В этой главе</strong>${toc.map((h) => `<a href="#${h.id}">${escape(h.title)}</a>`).join('')}</nav>` : ''}</div><footer class="site-footer">Объяснения и задания авторские. Исходники — Markdown; проверки — TypeScript и Node.</footer></body></html>`;
}
async function output(file, html) {
  // Root copies keep previously shared local/file links working. Pages uses dist only.
  await fs.writeFile(path.join(root, file), html);
  await fs.writeFile(path.join(dist, file), html);
}
for (const [index, lesson] of lessons.entries()) {
  const tokens = md.parse(lesson.source, {});
  const toc = [];
  let section = 0;
  for (const [i, token] of tokens.entries()) {
    if (token.type === 'heading_open' && token.tag === 'h2') {
      const id = `section-${++section}`;
      token.attrSet('id', id);
      toc.push({ id, title: tokens[i + 1].content });
    }
    if (token.type === 'heading_open' && token.tag === 'h3' && tokens[i + 1]?.content === 'Спойлер')
      token.attrSet('class', 'spoiler-heading');
    if (token.type === 'link_open') {
      const href = token.attrGet('href');
      if (href?.startsWith('../docs/')) token.attrSet('href', href.slice(3));
    }
  }
  const html = md.renderer.render(tokens, md.options, {});
  await output(
    lesson.href,
    shell(
      lesson.title,
      `${pager(index, 'сверху')}<div class="lesson-meta"><span>Глава ${lesson.number} из ${lessons.length}</span><a href="lessons/${lesson.file}">Markdown ↗</a></div><p class="route-label" id="route-label" hidden></p><article>${html}</article><div class="completion"><button type="button" id="complete-button" aria-pressed="false">Отметить главу пройденной</button><span id="completion-status" aria-live="polite"></span></div>${pager(index, 'снизу')}`,
      lesson.number,
      toc,
    ),
  );
}
const tracks = Object.entries(config.tracks)
  .map(([key, track]) => {
    const first = lessons.find((l) => l.number === track.chapters[0]);
    return `<section class="track"><h3>${escape(track.title)}</h3><p>${escape(track.description)}</p><p>${track.chapters.length} глав · В своём темпе</p><a class="primary-link" href="${first.href}?track=${key}">Начать маршрут</a></section>`;
  })
  .join('');
await output(
  'index.html',
  shell(
    'План подготовки',
    `<section class="intro"><p class="context">Для разработчиков, которые возвращаются к TS</p><h1>Вспомнить язык.<br>Вернуться к практике.</h1><p class="lead">${lessons.length} глав: объяснение → код → задача → Спойлер. От вывода типов до конкурентного импорта с тестами.</p><p>Вы знаете программирование, но забыли детали TypeScript? Начните с языка. Готовитесь писать код на интервью? Выберите практический маршрут.</p><a class="primary-link" id="resume-link" href="11-language-refresh.html?track=refresher">Начать с основ TypeScript</a><p class="resume-note">Прогресс сохраняется в этом браузере. Процент означает прочитанные главы, а не оценку знаний.</p></section><section><h2>Выберите маршрут</h2><div class="tracks">${tracks}</div></section><section class="overview"><h2>Все главы</h2><ol>${lessons.map((l) => `<li><a href="${l.href}"><span>${String(l.number).padStart(2, '0')}</span><strong>${escape(l.title)}</strong><span aria-hidden="true">›</span></a></li>`).join('')}</ol></section><section class="about"><h2>Как учиться</h2><p>Прежде чем читать Спойлер, проговорите решение. Затем напишите его руками. Проверьте ноль, пустой вход, повтор, неизвестную ошибку и другой порядок завершения. Вернитесь к объяснению, если тест выявил пробел.</p><p>Prev / Next следуют выбранному маршруту. Можно читать главы отдельно; исходный Markdown доступен в каждой главе. Кодовые фрагменты могут быть самостоятельными, намеренно ошибочными или требовать показанного контекста — об этом говорится рядом.</p><h2>Проверка навыка</h2><p><a href="14-workshop.html">Четыре упражнения</a>, <a href="10-mock-interview.html">mock interview</a> и <a href="docs/EVALUATION.md">отчёт оценки</a>. Тесты проверяют корректность примеров; отдельный эксперимент проверяет решения после чтения курса. Эти результаты имеют разные ограничения.</p><pre><code>npm ci\nnpm run verify\nnpm start</code></pre><p><a href="README.md">README и запуск</a> · <a href="examples/workshop.ts">Ответы практикума</a> · <a href="benchmarks/TASKS.md">Новые задачи для проверки</a> · <a href="docs/AUDIT.md">Аудит содержания</a></p><h2>Границы курса</h2><p>Основной фокус — язык, backend и работа с данными. React, DOM, decorators и разработка библиотек рассматриваются за пределами этого материала. Задания авторские; они не являются списком вопросов конкретной компании.</p></section>`,
  ),
);
console.log(`Built ${lessons.length} lessons, two tracks and dist/`);
