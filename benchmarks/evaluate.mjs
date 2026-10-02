import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const submission = process.argv[2];
if (!submission) {
  console.error('Usage: node benchmarks/evaluate.mjs path/to/solution.ts [report.json]');
  process.exit(1);
}
const projectRoot = path.resolve(import.meta.dirname, '..');
const checkDirectory = path.join(projectRoot, 'work', 'submission-check');
await fs.mkdir(checkDirectory, { recursive: true });
const checkConfig = path.join(checkDirectory, 'tsconfig.json');
await fs.writeFile(
  checkConfig,
  JSON.stringify({
    extends: path.join(projectRoot, 'tsconfig.json'),
    include: [path.resolve(submission)],
  }),
);
const typecheck = spawnSync(
  path.join(projectRoot, 'node_modules', '.bin', 'tsc'),
  ['-p', checkConfig],
  { encoding: 'utf8', timeout: 30000 },
);
const result = spawnSync(
  process.execPath,
  ['--test', '--test-reporter=tap', '--test-timeout=4000', 'benchmarks/hidden.test.mjs'],
  {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, TS_SUBMISSION: path.resolve(submission) },
    encoding: 'utf8',
    timeout: 30000,
  },
);
const output = result.stdout || '';
const cases = [...output.matchAll(/^(ok|not ok) \d+ - (T[1-6]) ([^\n]+)/gm)].map((m) => ({
  task: Number(m[2].slice(1)),
  name: m[3],
  passed: m[1] === 'ok',
}));
const tasks = Array.from({ length: 6 }, (_, i) => {
  const selected = cases.filter((c) => c.task === i + 1);
  return {
    task: i + 1,
    passed: selected.filter((c) => c.passed).length,
    total: selected.length,
    solved: selected.length > 0 && selected.every((c) => c.passed),
  };
});
const report = {
  typecheckPassed: typecheck.status === 0,
  tasks,
  solved: tasks.filter((t) => t.solved).length,
  totalTasks: 6,
  passedCases: cases.filter((c) => c.passed).length,
  totalCases: cases.length,
  cases,
  executionFailed: Boolean(result.error) || cases.length === 0,
};
console.log(JSON.stringify(report, null, 2));
if (process.argv[3]) await fs.writeFile(process.argv[3], JSON.stringify(report, null, 2) + '\n');
if (typecheck.status !== 0) console.error(typecheck.stdout, typecheck.stderr);
if (result.stderr) console.error(result.stderr);
if (!report.typecheckPassed || report.executionFailed || report.solved < 6) process.exitCode = 1;
