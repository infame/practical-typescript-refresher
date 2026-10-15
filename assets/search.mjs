export function normalize(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/ё/g, 'е');
}
export function searchSections(sections, query) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const phrase = terms.join(' ');
  return sections
    .map((section) => {
      const title = normalize(section.title),
        lesson = normalize(section.lessonTitle),
        body = normalize(section.text),
        searchable = title + ' ' + lesson + ' ' + body;
      if (!terms.every((term) => searchable.includes(term))) return null;
      const score =
        Number(title.includes(phrase)) * 8 +
        Number(lesson.includes(phrase)) * 4 +
        terms.filter((term) => title.includes(term)).length * 2 +
        terms.filter((term) => lesson.includes(term)).length;
      return { section, score };
    })
    .filter((hit) => hit !== null)
    .sort((a, b) => b.score - a.score)
    .map((hit) => hit.section);
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
