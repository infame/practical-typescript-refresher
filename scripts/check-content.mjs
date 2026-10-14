import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const read = async (file) => fs.readFile(path.join(root, file), 'utf8');
const json = async (file) => JSON.parse(await read(file));
const ui = await json('content/ui.json');
const questions = await json('content/questions.en.json');
const files = (await fs.readdir(path.join(root, 'lessons'))).filter((file) =>
  /^\d+.*\.md$/.test(file),
);
for (const lang of ['en', 'ru', 'es']) {
  assert.deepEqual(
    Object.keys(ui[lang]).sort(),
    Object.keys(ui.en).sort(),
    `Missing UI keys: ${lang}`,
  );
  const localized = await json(`content/questions.${lang}.json`);
  assert.equal(localized.length, questions.length, `Question count: ${lang}`);
  for (let i = 0; i < questions.length; i++) {
    const a = questions[i],
      b = localized[i];
    assert.equal(b.answer, a.answer, `Changed answer: ${lang}/${i}`);
    assert.equal(b.chapter, a.chapter, `Changed chapter: ${lang}/${i}`);
    assert.equal(b.options.length, a.options.length, `Changed option count: ${lang}/${i}`);
    assert.equal(b.url, a.url, `Changed reference: ${lang}/${i}`);
  }
  const prefix = lang === 'en' ? 'lessons' : `lessons/${lang}`;
  for (const file of files) {
    const source = await read(`${prefix}/${file}`);
    assert.ok(source.startsWith('# '));
    const canonical = await read(`lessons/${file}`);
    assert.equal(
      (source.match(/^## /gm) || []).length,
      (canonical.match(/^## /gm) || []).length,
      `Section/anchor parity: ${lang}/${file}`,
    );
  }
  const tooling = await read(`${prefix}/13-tooling.md`);
  assert.equal((tooling.match(/^### \d+\. /gm) || []).length, 10, `Compiler cases: ${lang}`);
  const workshop = await read(`${prefix}/14-workshop.md`);
  assert.equal(
    (workshop.match(/\]\(\.\/\d{2}-[a-z-]+\.md\)/g) || []).length,
    15,
    `Review-sheet links: ${lang}`,
  );
}
for (const file of [
  'course.json',
  'training.json',
  'docs/evaluation-results.json',
  'content/questions.en.json',
  'content/practice.en.md',
  'docs/AUDIT.md',
  'docs/EVALUATION.md',
  'docs/LAUNCH.md',
  'docs/PLAN.md',
  ...files.map((file) => `lessons/${file}`),
]) {
  assert.ok(!/[\u0400-\u04ff]/.test(await read(file)), `Non-English canonical source: ${file}`);
}
assert.ok(!/[\u0400-\u04ff]/.test(JSON.stringify(ui.en)), 'Non-English canonical UI');
console.log(
  `Checked canonical English sources, ${files.length} chapters in 3 editions, UI/question parity, 10 repairs and 15 review links per edition.`,
);
