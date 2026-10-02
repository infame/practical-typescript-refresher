(() => {
  const course = window.COURSE;
  if (!course) return;
  const valid = new Set(course.lessons.map((l) => l.id));
  const byNumber = new Map(course.lessons.map((l) => [l.number, l]));
  const key = 'learn-ts-progress-v2';
  let completed = [];
  let last = null;
  let storageWorks = true;
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const state = JSON.parse(stored);
      if (Array.isArray(state.completed))
        completed = [...new Set(state.completed.filter((id) => valid.has(id)))];
      if (typeof state.last === 'string' && valid.has(state.last)) last = state.last;
    } else {
      const old = JSON.parse(localStorage.getItem('learn-ts-completed-v1') || '[]');
      if (Array.isArray(old))
        completed = [...new Set(old.map((n) => byNumber.get(n)?.id).filter((id) => valid.has(id)))];
    }
  } catch {
    storageWorks = false;
  }
  const chapter = byNumber.get(Number(document.body.dataset.lesson));
  const requestedTrack = new URLSearchParams(location.search).get('track');
  const track = Object.hasOwn(course.tracks, requestedTrack) ? course.tracks[requestedTrack] : null;
  const route = track ? track.chapters.map((n) => byNumber.get(n)) : course.lessons;
  const currentIndex = route.findIndex((l) => l.id === chapter?.id);
  const suffix = track ? `?track=${encodeURIComponent(requestedTrack)}` : '';
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify({ completed, last }));
    } catch {
      storageWorks = false;
    }
  }
  if (chapter) last = chapter.id;
  save();
  const resume = document.getElementById('resume-link');
  const remembered = course.lessons.find((l) => l.id === last);
  if (resume && remembered) {
    resume.href = remembered.href;
    resume.textContent = `Продолжить: ${remembered.title}`;
  }
  if (track && currentIndex >= 0) {
    const label = document.getElementById('route-label');
    label.hidden = false;
    label.textContent = `${track.title} · Шаг ${currentIndex + 1} из ${route.length}`;
    document.querySelectorAll('.pager').forEach((pager) => {
      const prev = route[currentIndex - 1],
        next = route[currentIndex + 1];
      const p = pager.querySelector('[data-prev]'),
        n = pager.querySelector('[data-next]');
      p.href = prev ? prev.href + suffix : 'index.html';
      p.querySelector('small').textContent = prev?.title || 'Оглавление';
      n.href = next ? next.href + suffix : 'index.html';
      n.querySelector('small').textContent = next?.title || 'Маршрут завершён';
      n.querySelector('span').textContent = next ? 'Next ›' : 'К оглавлению ›';
      pager.querySelector('.page-count').textContent = `${currentIndex + 1} / ${route.length}`;
    });
    document.querySelectorAll('[data-chapter]').forEach((link) => {
      if (track.chapters.includes(Number(link.dataset.chapter))) link.href += suffix;
    });
  }
  const button = document.getElementById('complete-button');
  function render() {
    const scoped = track ? route : course.lessons;
    const count = scoped.filter((l) => completed.includes(l.id)).length;
    const percent = Math.round((count / scoped.length) * 100);
    document.getElementById('progress-label').textContent =
      `Пройдено ${count} из ${scoped.length} глав · ${percent}%`;
    const progress = document.getElementById('course-progress');
    progress.max = scoped.length;
    progress.value = count;
    progress.textContent = `${percent}%`;
    document.getElementById('progress-scope').textContent = track
      ? `Маршрут: ${track.title}`
      : 'По всем завершённым главам';
    document.querySelectorAll('[data-chapter]').forEach((link) => {
      const done = completed.includes(byNumber.get(Number(link.dataset.chapter)).id);
      link.classList.toggle('is-done', done);
      if (done)
        link.setAttribute(
          'aria-label',
          `${link.dataset.chapter}. ${link.querySelectorAll('span')[1].textContent}. Пройдено`,
        );
      else link.removeAttribute('aria-label');
    });
    document.querySelector('.storage-note').hidden = storageWorks;
    if (button) {
      const done = completed.includes(chapter.id);
      button.textContent = done
        ? '✓ Глава пройдена — отменить отметку'
        : 'Отметить главу пройденной';
      button.setAttribute('aria-pressed', String(done));
      document.getElementById('completion-status').textContent = done
        ? 'Можно переходить дальше.'
        : 'Отметьте после собственной попытки и разбора ответа.';
    }
  }
  button?.addEventListener('click', () => {
    completed = completed.includes(chapter.id)
      ? completed.filter((id) => id !== chapter.id)
      : [...completed, chapter.id];
    save();
    render();
  });
  document.getElementById('chapter-search').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLocaleLowerCase('ru');
    let visible = 0;
    document.querySelectorAll('.chapters li').forEach((item) => {
      const match = item.textContent.toLocaleLowerCase('ru').includes(query);
      item.hidden = !match;
      if (match) visible++;
    });
    document.getElementById('search-empty').hidden = visible > 0;
  });
  if (matchMedia('(max-width:760px)').matches) document.querySelector('.course-menu').open = false;
  render();
})();
