import { normalize, searchSections, excerpt } from './search.mjs';
const course = window.COURSE,
  { ui, lessons, domains } = course;
const byNumber = new Map(lessons.map((l) => [l.number, l])),
  valid = new Set(lessons.map((l) => l.id));
const params = new URLSearchParams(location.search),
  page = document.body.dataset.page;
const chapter = byNumber.get(Number(document.body.dataset.lesson));
const requestedTrack = params.get('track');
let trackKey = Object.hasOwn(course.tracks, requestedTrack) ? requestedTrack : 'refresher';
if (chapter && !course.tracks[trackKey].chapters.includes(chapter.number)) trackKey = 'refresher';
const route = course.tracks[trackKey].chapters.map((n) => byNumber.get(n));
const fill = (key, values = {}) => ui[key].replace(/\{(\w+)\}/g, (_, key) => values[key]);
let completed = [],
  last = null,
  storageWorks = true,
  storedDomain;
try {
  const stored = localStorage.getItem('learn-ts-progress-v2');
  if (stored) {
    const state = JSON.parse(stored);
    if (Array.isArray(state.completed))
      completed = [...new Set(state.completed.filter((id) => valid.has(id)))];
    if (valid.has(state.last)) last = state.last;
  } else {
    const old = JSON.parse(localStorage.getItem('learn-ts-completed-v1') || '[]');
    if (Array.isArray(old))
      completed = [...new Set(old.map((n) => byNumber.get(n)?.id).filter((id) => valid.has(id)))];
  }
  storedDomain = localStorage.getItem('learn-ts-domain-v1');
} catch {
  storageWorks = false;
}
let domain =
  domains.find((d) => d.id === params.get('domain')) ||
  domains.find((d) => d.id === storedDomain) ||
  domains[0];
const selector = document.getElementById('domain-select');
selector.value = domain.id;
function save() {
  try {
    localStorage.setItem('learn-ts-progress-v2', JSON.stringify({ completed, last }));
    localStorage.setItem('learn-ts-domain-v1', domain.id);
  } catch {
    storageWorks = false;
  }
}
if (chapter) last = chapter.id;
save();
function el(tag, text, parent) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent?.append(node);
  return node;
}
function internalLinks() {
  document.querySelectorAll('a[href]').forEach((a) => {
    const raw = a.getAttribute('href');
    if (raw.startsWith('#') || raw.startsWith('mailto:')) return;
    const url = new URL(raw, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('.html')) return;
    url.searchParams.set('domain', domain.id);
    if (requestedTrack && !url.searchParams.has('track')) url.searchParams.set('track', trackKey);
    a.href = url;
  });
}
function openSearchAnswer() {
  const query = new URLSearchParams(location.search).get('find');
  if (!query) return;
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  document.querySelectorAll('details.solution').forEach((details) => {
    if (terms.every((t) => normalize(details.textContent).includes(t))) details.open = true;
  });
}
function renderPage() {
  const rendered = course.pages[domain.id][page];
  if (rendered) {
    document.getElementById('lesson-article').innerHTML = rendered.html;
    const toc = document.getElementById('lesson-toc');
    if (toc) {
      toc.replaceChildren();
      const nav = el('nav', '', toc);
      nav.className = 'section-nav';
      nav.setAttribute('aria-label', ui.inChapter);
      el('strong', ui.inChapter, nav);
      for (const heading of rendered.toc) {
        const a = el('a', heading.title, nav);
        a.href = '#' + heading.id;
      }
    }
  }
  const name = document.getElementById('domain-name');
  if (name) name.textContent = ui[domain.id];
  const description = document.getElementById('domain-description');
  if (description) description.textContent = ui.domainDescriptions[domain.id];
  for (const [id, text] of [
    ['domain-entity', domain.type],
    ['domain-id', domain.idField],
    ['domain-metric', domain.metric],
  ]) {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  }
  const index = route.findIndex((l) => l.id === chapter?.id);
  if (chapter) {
    document.getElementById('route-label').textContent =
      `${trackKey === 'interview' ? ui.routeInterview : ui.routeRefresh} · ${index + 1}/${route.length}`;
    document.querySelectorAll('.pager').forEach((pager) => {
      const prev = route[index - 1],
        next = route[index + 1],
        p = pager.querySelector('[data-prev]'),
        n = pager.querySelector('[data-next]');
      p.href = prev?.href || 'index.html';
      p.querySelector('small').textContent = prev?.title || ui.home;
      n.href = next?.href || 'practice.html';
      n.querySelector('small').textContent = next?.title || ui.practice;
      pager.querySelector('.page-count').textContent = `${index + 1} / ${route.length}`;
    });
  }
  const resume = document.getElementById('resume-link'),
    remembered = lessons.find((l) => l.id === last);
  if (resume && remembered) {
    resume.href = remembered.href;
    resume.textContent = ui.continueLabel + ': ' + remembered.title;
  }
  internalLinks();
  openSearchAnswer();
  const url = new URL(location.href);
  url.searchParams.set('domain', domain.id);
  if (requestedTrack) url.searchParams.set('track', trackKey);
  history.replaceState(null, '', url);
}
selector.addEventListener('change', () => {
  domain = domains.find((d) => d.id === selector.value);
  save();
  renderPage();
  renderSearch();
});
document.getElementById('language-select').addEventListener('change', (event) => {
  const language = event.target.value,
    file = location.pathname.split('/').pop() || 'index.html';
  const url = new URL(
    course.base + (language === 'en' ? '' : language + '/') + file,
    location.href,
  );
  url.search = location.search;
  url.hash = location.hash;
  location.assign(url);
});
function progress() {
  const count = route.filter((l) => completed.includes(l.id)).length,
    percent = Math.round((count / route.length) * 100);
  document.getElementById('progress-label').textContent = fill('progress', {
    count,
    total: route.length,
    percent,
  });
  const bar = document.getElementById('course-progress');
  bar.max = route.length;
  bar.value = count;
  bar.textContent = percent + '%';
  document.querySelector('.storage-note').hidden = storageWorks;
  document.querySelectorAll('[data-chapter]').forEach((a) => {
    const lesson = byNumber.get(Number(a.dataset.chapter));
    const position = route.findIndex((l) => l.id === lesson.id);
    a.closest('li').hidden = position < 0;
    a.querySelector('.chapter-number').textContent = position + 1;
    const done = completed.includes(lesson.id);
    a.classList.toggle('is-done', done);
    a.querySelector('.check').textContent = '';
  });
  const chapterList = document.querySelector('.chapters');
  for (const lesson of route)
    chapterList.append(document.querySelector(`[data-chapter="${lesson.number}"]`).closest('li'));
  const button = document.getElementById('complete-button');
  if (button) {
    const done = completed.includes(chapter.id);
    button.textContent = done ? ui.unmark : ui.mark;
    button.setAttribute('aria-pressed', String(done));
    document.getElementById('completion-status').textContent = done ? ui.next : ui.tryFirst;
  }
}
document.getElementById('complete-button')?.addEventListener('click', () => {
  completed = completed.includes(chapter.id)
    ? completed.filter((id) => id !== chapter.id)
    : [...completed, chapter.id];
  save();
  progress();
});
const searchInput = document.getElementById('chapter-search'),
  searchResults = document.getElementById('search-results');
function renderSearch() {
  const query = searchInput.value.trim();
  searchResults.replaceChildren();
  searchResults.hidden = !query;
  if (!query) return;
  const hits = searchSections(course.search[domain.id], query);
  el(
    'p',
    hits.length ? fill('searchCount', { count: hits.length }) : ui.searchEmpty,
    searchResults,
  );
  for (const hit of hits) {
    const result = el('div', '', searchResults);
    result.className = 'search-result';
    const link = el('a', hit.lessonTitle + ' — ' + hit.title, result);
    const url = new URL(hit.href, location.href);
    url.searchParams.set('domain', domain.id);
    if (requestedTrack) url.searchParams.set('track', trackKey);
    url.searchParams.set('find', query);
    url.hash = hit.id;
    link.href = url;
    el('small', excerpt(hit.text, query), result);
  }
}
searchInput.addEventListener('input', renderSearch);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    searchInput.value = '';
    renderSearch();
  }
});
const form = document.getElementById('diagnostic-form');
if (form) {
  const results = document.getElementById('diagnostic-results'),
    status = document.getElementById('diagnostic-status');
  const link = (text, href, parent, newTab = false) => {
    const a = el('a', text, parent);
    a.href = href;
    if (newTab) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    return a;
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form),
      missing = course.questions.findIndex((_, i) => !data.has('q' + i));
    if (missing >= 0) {
      results.hidden = true;
      status.textContent = fill('missing', { count: missing + 1 });
      form.elements.namedItem('q' + missing)[0].focus();
      return;
    }
    const gaps = course.questions.filter((q, i) => Number(data.get('q' + i)) !== q.answer),
      count = course.questions.length - gaps.length;
    status.textContent =
      fill('correct', {
        count,
        total: course.questions.length,
        percent: Math.round((count / course.questions.length) * 100),
      }) +
      ' ' +
      fill('gaps', { count: gaps.length });
    results.replaceChildren();
    results.hidden = false;
    el('h3', ui.resultTitle, results);
    el('p', gaps.length ? ui.reviewPlan : ui.noGaps, results);
    el('p', ui.reviewLinks, results);
    for (const q of gaps) {
      const section = el('section', '', results);
      section.className = 'gap-result';
      el('h4', q.topic, section);
      el('p', ui.rightAnswer + ': ' + q.options[q.answer] + '. ' + q.explanation, section);
      const p = el('p', '', section),
        lesson = byNumber.get(q.chapter);
      link(lesson.title, lesson.href, p, true);
      p.append(' · ');
      link(q.source, q.url, p, true);
    }
    link(ui.practiceNext, 'practice.html', results);
    const review = el('details', '', results);
    el('summary', ui.allAnswers, review);
    for (const q of course.questions) {
      el('h4', q.topic, review);
      el('p', q.options[q.answer] + '. ' + q.explanation, review);
      link(q.source, q.url, review, true);
    }
    internalLinks();
    results.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  form.addEventListener('reset', () => {
    results.replaceChildren();
    results.hidden = true;
    status.textContent = '';
  });
}
if (matchMedia('(max-width:760px)').matches) document.querySelector('.course-menu').open = false;
renderPage();
progress();
selector.disabled = false;
document.getElementById('language-select').disabled = false;
searchInput.disabled = false;
const completionButton = document.getElementById('complete-button');
if (completionButton) completionButton.disabled = false;
form?.querySelectorAll('fieldset, button').forEach((control) => {
  control.disabled = false;
});
if (location.hash) {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  target?.scrollIntoView();
}
