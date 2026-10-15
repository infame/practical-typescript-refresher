import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error: browser module has JavaScript exports, checked by behavioral tests.
import { searchSections, excerpt } from '../assets/search.mjs';
// @ts-expect-error: build helper has JavaScript exports, checked by behavioral tests.
import { renderContent, adaptDomain, domains } from '../scripts/course-content.mjs';
test('search finds body and code terms, all terms and accented input without title matching', () => {
  const sections = [
    {
      id: 's',
      title: 'Storage',
      lessonTitle: 'Events',
      text: 'A tombstone rejects old updates. Promise.all keeps positions.',
    },
    { id: 'e', title: 'Tipos', lessonTitle: 'Repaso', text: 'La versión más reciente.' },
  ];
  assert.equal(searchSections(sections, 'tombstone')[0].id, 's');
  assert.equal(searchSections(sections, 'promise.all positions').length, 1);
  assert.equal(searchSections(sections, 'promise.all missing').length, 0);
  assert.equal(searchSections(sections, 'version')[0].id, 'e');
  assert.equal(searchSections(sections, '  ').length, 0);
  assert.match(excerpt('A long prefix '.repeat(30) + 'tombstone policy', 'tombstone'), /tombstone/);
});
test('spoiler is a closed disclosure, excluded from TOC, indexed with code and followed by normal guidance', () => {
  const rendered = renderContent(
    '# Title\n\n## Practice\n\nTry it.\n\n### Spoiler\n\n```ts\nconst secret = 42;\n```\n\n## Next\n\nRead more.',
    'Spoiler',
  );
  assert.deepEqual(
    rendered.toc.map((x: { title: string }) => x.title),
    ['Practice', 'Next'],
  );
  assert.match(rendered.html, /<details class="solution">/);
  assert.doesNotMatch(rendered.html, /<details[^>]* open/);
  assert.ok(rendered.html.indexOf('</details>') < rendered.html.indexOf('id="section-2"'));
  assert.equal(
    searchSections(
      rendered.sections.map((x: object) => ({ ...x, lessonTitle: 'Title' })),
      'secret',
    ).length,
    1,
  );
});
test('search ranks a matching section title above incidental body mentions and keeps equal results stable', () => {
  const sections = [
    { id: 'body-first', title: 'Retries', lessonTitle: 'Failures', text: 'Clear the cache.' },
    { id: 'title', title: 'Async cache', lessonTitle: 'Workshop', text: 'Share pending calls.' },
    { id: 'body-second', title: 'Storage', lessonTitle: 'Data', text: 'A cache retains values.' },
  ];
  assert.deepEqual(
    searchSections(sections, 'cache').map((hit: { id: string }) => hit.id),
    ['title', 'body-first', 'body-second'],
  );
  assert.equal(searchSections(sections, 'cache pending')[0].id, 'title');
  assert.equal(searchSections(sections, 'cache absent').length, 0);
});
test('same source contract gets consistent domain identifiers and metric names', () => {
  for (const domain of domains) {
    const s = adaptDomain(
      'type EntityUpdate={entityId:string;metric:number}; type Listing={listingId:string;price:number};',
      domain,
    );
    assert.ok(s.includes(domain.type + 'Update'));
    assert.ok(s.includes(domain.idField));
    assert.ok(s.includes(domain.metric));
    assert.ok(!s.includes('Listing'));
  }
});

test('source chapter links become same-edition HTML links without changing official references', () => {
  const rendered = renderContent(
    '## Review\n\n[Chapter](./03-typescript.md) and [Official](https://www.typescriptlang.org/docs/handbook/intro.html) and `handlers[event.kind](event)`',
    'Spoiler',
  );
  assert.match(rendered.html, /href="03-typescript.html"/);
  assert.equal(
    rendered.sections[0].text.trim(),
    'Review Chapter and Official and handlers[event.kind](event)',
  );
  assert.match(
    rendered.html,
    /href="https:\/\/www.typescriptlang.org\/docs\/handbook\/intro.html"/,
  );
});
