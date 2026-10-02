import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..', 'dist');
const pages = (await fs.readdir(root)).filter((f) => f.endsWith('.html'));
const lessons = (await fs.readdir(path.join(root, 'lessons'))).filter((f) => f.endsWith('.md'));
if (pages.length !== lessons.length + 1) throw new Error('Wrong page count');
let checked = 0;
for (const page of pages) {
  const html = await fs.readFile(path.join(root, page), 'utf8');
  if (page !== 'index.html' && (html.match(/class="pager"/g) || []).length !== 2)
    throw new Error(`Missing navigation: ${page}`);
  if (page !== 'index.html' && !html.includes('spoiler-heading'))
    throw new Error(`Missing spoiler: ${page}`);
  for (const [, href] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    if (/^(https?:|mailto:)/.test(href)) continue;
    const [file, fragment] = href.split('#');
    const target = path.join(root, file.split('?')[0]);
    await fs.access(target);
    if (fragment && target.endsWith('.html')) {
      const content = await fs.readFile(target, 'utf8');
      if (!content.includes(`id="${fragment}"`)) throw new Error(`Missing anchor ${href}`);
    }
    checked++;
  }
}
console.log(`Checked ${pages.length} pages, ${checked} local links/assets and chapter navigation.`);
