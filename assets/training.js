(() => {
  const { training, lessons } = window.COURSE;
  const selector = document.getElementById('domain-select');
  if (selector) {
    let stored;
    try {
      stored = localStorage.getItem('learn-ts-domain-v1');
    } catch {}
    const requested = new URLSearchParams(location.search).get('domain') || stored;
    selector.value = training.domains.some((d) => d.id === requested)
      ? requested
      : training.domains[0].id;
    function selectDomain() {
      const domain = training.domains.find((d) => d.id === selector.value);
      document.getElementById('domain-summary').textContent = domain.summary;
      const link = document.getElementById('domain-practice-link');
      if (link) {
        link.href = `practice.html?domain=${domain.id}`;
        link.textContent = `Практика: ${domain.title}`;
      }
      document.querySelectorAll('[data-domain]').forEach((el) => {
        el.hidden = el.dataset.domain !== domain.id;
      });
      try {
        localStorage.setItem('learn-ts-domain-v1', domain.id);
      } catch {}
      if (location.pathname.endsWith('practice.html')) {
        const url = new URL(location.href);
        url.searchParams.set('domain', domain.id);
        history.replaceState(null, '', url);
      }
    }
    selector.addEventListener('change', selectDomain);
    selectDomain();
  }
  const form = document.getElementById('diagnostic-form');
  if (!form) return;
  const results = document.getElementById('diagnostic-results');
  const status = document.getElementById('diagnostic-status');
  function element(tag, text, parent) {
    const el = document.createElement(tag);
    el.textContent = text;
    parent.append(el);
    return el;
  }
  function link(text, href, parent) {
    const el = element('a', text, parent);
    el.href = href;
    return el;
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const missing = training.questions.findIndex((_, i) => !data.has(`q${i}`));
    if (missing >= 0) {
      results.hidden = true;
      status.textContent = `Ответьте на вопрос ${missing + 1} или выберите «Не знаю».`;
      form.elements.namedItem(`q${missing}`)[0].focus();
      return;
    }
    const gaps = training.questions.filter((q, i) => Number(data.get(`q${i}`)) !== q.answer);
    const correct = training.questions.length - gaps.length;
    status.textContent = `Верных ответов: ${correct} из ${training.questions.length} · ${Math.round((correct / training.questions.length) * 100)}%. Тем для повторения: ${gaps.length}.`;
    results.replaceChildren();
    results.hidden = false;
    element('h3', gaps.length ? 'Ваш план повторения' : 'Базовые вопросы разобраны', results);
    element(
      'p',
      gaps.length
        ? 'Начните с этих тем. После чтения объясните правило своими словами и напишите новую вариацию задачи.'
        : 'Теперь проверьте написание кода в выбранной области: узнавание правильного ответа и самостоятельное решение — разные навыки.',
      results,
    );
    for (const q of gaps) {
      const section = element('section', '', results);
      section.className = 'gap-result';
      element('h4', q.topic, section);
      element('p', `Правильный ответ: ${q.options[q.answer]}. ${q.explanation}`, section);
      const lesson = lessons.find((l) => l.number === q.chapter);
      const p = element('p', '', section);
      link(lesson.title, lesson.href, p);
      p.append(' · ');
      link(q.source, q.url, p);
    }
    const practice = element('p', '', results);
    link('Закрепить в практической задаче', `practice.html?domain=${selector.value}`, practice);
    const review = element('details', '', results);
    element('summary', 'Разбор всех вопросов', review);
    for (const q of training.questions) {
      element('h4', q.topic, review);
      element('p', `${q.options[q.answer]}. ${q.explanation}`, review);
      link(q.source, q.url, review);
    }
    results.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  form.addEventListener('reset', () => {
    results.replaceChildren();
    results.hidden = true;
    status.textContent = '';
  });
})();
