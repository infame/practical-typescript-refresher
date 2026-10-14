import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
// @ts-expect-error: JavaScript build helper is exercised through its output.
import { adaptDomain, domains } from '../scripts/course-content.mjs';

const root = path.resolve(import.meta.dirname, '..');
async function counterexample(
  file: string,
  lang: string,
  domain: { id: string },
  expression: string,
) {
  const folder = path.join(root, 'lessons', ...(lang === 'en' ? [] : [lang]));
  const source = await fs.readFile(path.join(folder, file), 'utf8');
  const code = /#### [^\n]+\n\n```ts check\n([\s\S]*?)\n```/.exec(source)?.[1];
  assert.ok(code, `Counterexample missing in ${lang}/${file}`);
  const script =
    adaptDomain(code, domain) + `\nexport default ${expression};\n// ${lang}/${domain.id}/${file}`;
  const javascript = stripTypeScriptTypes(script);
  const module = await import(
    'data:text/javascript;base64,' + Buffer.from(javascript).toString('base64')
  );
  return module.default;
}

test('the published entity-key counterexample actually discards a legitimate newer update in every edition/domain', async () => {
  for (const lang of ['en', 'ru', 'es'])
    for (const domain of domains) {
      const wrong = await counterexample('01-collections.md', lang, domain, 'wrong');
      assert.deepEqual(
        wrong.map((event: { version: number }) => event.version),
        [1],
      );
    }
});
test('the published assertion counterexample actually leaves a string in the numeric field', async () => {
  for (const lang of ['en', 'ru', 'es'])
    for (const domain of domains) {
      assert.equal(await counterexample('03-typescript.md', lang, domain, 'total'), 'free1');
    }
});
test('the published race counterexample actually completes its losing operation after rejection', async () => {
  for (const lang of ['en', 'ru', 'es'])
    for (const domain of domains) {
      assert.equal(
        await counterexample('04-async.md', lang, domain, 'await demonstrateRace()'),
        true,
      );
    }
});
test('the published eager-start counterexample starts all work before the consumer waits', async () => {
  for (const lang of ['en', 'ru', 'es'])
    for (const domain of domains) {
      assert.deepEqual(
        await counterexample('05-concurrency.md', lang, domain, 'await demonstrateEagerStart()'),
        [1, 2, 3],
      );
    }
});
test('the published PATCH counterexample ignores a clear and mutates the caller through a shared array', async () => {
  for (const lang of ['en', 'ru', 'es'])
    for (const domain of domains) {
      const value = await counterexample('14-workshop.md', lang, domain, '({ current, wrong })');
      assert.equal(value.wrong[domain.metric], 10);
      assert.deepEqual(value.current.tags, ['old', 'new']);
      assert.equal(value.current.tags, value.wrong.tags);
    }
});
