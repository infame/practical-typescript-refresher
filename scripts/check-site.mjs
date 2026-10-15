import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..', 'dist');
const count = (await fs.readdir(path.join(root, 'lessons'))).filter((f) =>
  /^\d+.*\.md$/.test(f),
).length;
let checked = 0,
  pagesChecked = 0;
const assetVersions = {};
for (const file of ['app.js', 'search.mjs', 'style.css', 'highlight.css']) {
  const contents = await fs.readFile(path.join(root, 'assets', file));
  assetVersions[file] = createHash('sha256').update(contents).digest('hex').slice(0, 12);
}
const app = await fs.readFile(path.join(root, 'assets/app.js'), 'utf8');
if (!app.includes(`./search.mjs?v=${assetVersions['search.mjs']}`))
  throw new Error('Unversioned or mismatched search module');
const allowedAssets = new Set([
  ...Object.keys(assetVersions),
  ...['en', 'ru', 'es'].map((lang) => `course-${lang}.js`),
]);
for (const file of await fs.readdir(path.join(root, 'assets')))
  if (!allowedAssets.has(file)) throw new Error('Unexpected published asset: ' + file);
for (const lang of ['en', 'ru', 'es']) {
  const folder = path.join(root, lang === 'en' ? '' : lang);
  const script = await fs.readFile(path.join(root, `assets/course-${lang}.js`));
  const version = createHash('sha256').update(script).digest('hex').slice(0, 12);
  const pages = (await fs.readdir(folder)).filter((f) => f.endsWith('.html'));
  if (pages.length !== count + 2) throw new Error('Wrong page count: ' + lang);
  for (const page of pages) {
    const html = await fs.readFile(path.join(folder, page), 'utf8');
    pagesChecked++;
    if (!html.includes(`assets/course-${lang}.js?v=${version}`))
      throw new Error('Unversioned or mismatched course data: ' + page);
    for (const file of ['app.js', 'style.css', 'highlight.css'])
      if (!html.includes(`assets/${file}?v=${assetVersions[file]}`))
        throw new Error('Unversioned or mismatched asset: ' + page + '/' + file);
    if (!html.includes(`html lang="${lang}"`)) throw new Error('Wrong language');
    for (const id of ['domain-select', 'language-select', 'chapter-search'])
      if (!html.includes(`id="${id}"`)) throw new Error('Missing global control ' + id);
    const chapter = !['index.html', 'practice.html'].includes(page);
    if (chapter && (html.match(/class="pager"/g) || []).length !== 2)
      throw new Error('Missing navigation');
    if (chapter && !html.includes('class="solution"')) throw new Error('Missing spoiler');
    if (chapter && !html.includes('<nav class="section-nav"'))
      throw new Error('Missing visible chapter contents');
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
