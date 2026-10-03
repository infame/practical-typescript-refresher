import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..', 'dist');
const count = (await fs.readdir(path.join(root, 'lessons'))).filter((f) =>
  /^\d+.*\.md$/.test(f),
).length;
let checked = 0,
  pagesChecked = 0;
for (const lang of ['en', 'ru', 'es']) {
  const folder = path.join(root, lang === 'en' ? '' : lang);
  const pages = (await fs.readdir(folder)).filter((f) => f.endsWith('.html'));
  if (pages.length !== count + 2) throw new Error('Wrong page count: ' + lang);
  for (const page of pages) {
    const html = await fs.readFile(path.join(folder, page), 'utf8');
    pagesChecked++;
    if (!html.includes(`html lang="${lang}"`)) throw new Error('Wrong language');
    for (const id of ['domain-select', 'language-select', 'chapter-search'])
      if (!html.includes(`id="${id}"`)) throw new Error('Missing global control ' + id);
    const chapter = !['index.html', 'practice.html'].includes(page);
    if (chapter && (html.match(/class="pager"/g) || []).length !== 2)
      throw new Error('Missing navigation');
    if (chapter && !html.includes('class="solution"')) throw new Error('Missing spoiler');
    if (page === 'practice.html' && html.includes('lesson-toc'))
      throw new Error('Unnecessary practice TOC');
    for (const [, href] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [file, fragment] = href.split('#');
      const target = path.resolve(folder, file.split('?')[0]);
      if (!target.startsWith(root + path.sep)) throw new Error('Escaped build directory');
      await fs.access(target);
      if (fragment && target.endsWith('.html')) {
        const contents = await fs.readFile(target, 'utf8');
        if (!contents.includes(`id="${fragment}"`)) throw new Error('Missing anchor ' + href);
      }
      checked++;
    }
  }
}
console.log(`Checked ${pagesChecked} localized pages and ${checked} links/assets.`);
