export function normalize(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/ё/g, 'е');
}
export function searchSections(sections, query) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return sections.filter((s) =>
    terms.every((t) => normalize(s.title + ' ' + s.text + ' ' + s.lessonTitle).includes(t)),
  );
}
export function excerpt(text, query, length = 160) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const term = normalize(query.trim()).split(/\s+/)[0];
  const index = normalize(cleaned).indexOf(term);
  const start = Math.max(0, index - 40);
  return (
    (start ? '…' : '') +
    cleaned.slice(start, start + length) +
    (start + length < cleaned.length ? '…' : '')
  );
}
