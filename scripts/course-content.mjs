import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
export const domains = [
  {
    id: 'catalog',
    type: 'Product',
    singular: 'product',
    plural: 'products',
    idField: 'productId',
    metric: 'price',
  },
  {
    id: 'analytics',
    type: 'Page',
    singular: 'page',
    plural: 'pages',
    idField: 'pageId',
    metric: 'views',
  },
  {
    id: 'jobs',
    type: 'Job',
    singular: 'job',
    plural: 'jobs',
    idField: 'jobId',
    metric: 'attempts',
  },
  {
    id: 'profiles',
    type: 'Profile',
    singular: 'profile',
    plural: 'profiles',
    idField: 'profileId',
    metric: 'reputation',
  },
];
export function adaptDomain(source, domain) {
  const capMetric = domain.metric[0].toUpperCase() + domain.metric.slice(1);
  return source
    .replaceAll('Listing', domain.type)
    .replaceAll('listing', domain.singular)
    .replaceAll('Price', capMetric)
    .replaceAll('price', domain.metric)
    .replaceAll('EntityUpdate', domain.type + 'Update')
    .replaceAll('entityId', domain.idField)
    .replaceAll('metric', domain.metric)
    .replaceAll('"MLS"', '"Primary"');
}
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, info) {
    const lang = info.split(/\s+/)[0];
    return hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : escape(code);
  },
});
const renderLink = md.renderer.rules.link_open;
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const href = token.attrGet('href');
  if (/^\.\/\d{2}-[a-z-]+\.md(?:#.*)?$/.test(href || '')) {
    token.attrSet('href', href.replace(/^\.\//, '').replace(/\.md(?=#|$)/, '.html'));
  }
  return renderLink
    ? renderLink(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options);
};
const htmlToken = (tokens, html) => {
  const t = new tokens[0].constructor('html_block', '', 0);
  t.content = html;
  return t;
};
export function renderContent(source, spoilerLabel) {
  const original = md.parse(source, {});
  const tokens = [];
  const toc = [];
  const sections = [];
  let answer = false,
    section = 0,
    current = null;
  const closeAnswer = () => {
    if (answer) {
      tokens.push(htmlToken(original, '</div></details>'));
      answer = false;
    }
  };
  for (let i = 0; i < original.length; i++) {
    const t = original[i];
    if (t.type === 'heading_open') {
      const level = Number(t.tag.slice(1)),
        text = original[i + 1].content;
      if (level <= 3) closeAnswer();
      if (level === 3 && /^(Спойлер|Spoiler)$/.test(text)) {
        tokens.push(
          htmlToken(
            original,
            `<details class="solution"><summary>${escape(spoilerLabel)}</summary><div class="answer">`,
          ),
        );
        answer = true;
        i += 2;
        continue;
      }
      if (level === 2) {
        const id = `section-${++section}`;
        t.attrSet('id', id);
        toc.push({ id, title: text });
        current = { id, title: text, text: '' };
        sections.push(current);
      }
    }
    if (current && (t.type === 'inline' || t.type === 'fence')) current.text += ' ' + t.content;
    tokens.push(t);
  }
  closeAnswer();
  return { html: md.renderer.render(tokens, md.options, {}), toc, sections };
}
