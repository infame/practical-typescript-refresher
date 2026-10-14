import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import MarkdownIt from 'markdown-it';
import { domains, adaptDomain } from './course-content.mjs';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'work', 'snippets');
await fs.mkdir(out, { recursive: true });
const md = new MarkdownIt();
const files = (await fs.readdir(path.join(root, 'lessons'))).filter((f) => /^\d+.*\.md$/.test(f));
const generated = [];
for (const lang of ['en', 'ru', 'es']) {
  for (const file of files) {
    const source = await fs.readFile(
      path.join(root, 'lessons', ...(lang === 'en' ? [] : [lang]), file),
      'utf8',
    );
    for (const domain of domains) {
      let count = 0;
      for (const token of md.parse(adaptDomain(source, domain), {})) {
        if (token.type === 'fence' && token.info.trim() === 'ts check') {
          const target = path.join(
            out,
            `${lang}-${domain.id}-${file.replace('.md', '')}-${++count}.ts`,
          );
          await fs.writeFile(target, `export {};\n${token.content}`);
          generated.push(target);
        }
      }
    }
  }
}
if (!generated.length) throw new Error('No checked snippets found');
const config = path.join(out, 'tsconfig.json');
await fs.writeFile(
  config,
  JSON.stringify({ extends: path.join(root, 'tsconfig.json'), include: generated }, null, 2),
);
const result = spawnSync(path.join(root, 'node_modules', '.bin', 'tsc'), ['-p', config], {
  encoding: 'utf8',
});
if (result.status !== 0) {
  console.error(result.stdout, result.stderr);
  process.exit(1);
}
console.log(`Checked ${generated.length} independent Markdown snippets in strict mode.`);
