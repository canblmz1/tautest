import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (head !== '902dec9b1178e84dc927499705b75f083a95dd90') throw new Error('Use the pinned current project SHA.');
if (existsSync(output)) throw new Error('Choose a new baseline JSON path.');
if (!process.versions.node.startsWith('22.')) throw new Error('Use Node22.');
const records = [];
for (const label of ['baseline-1', 'baseline-2']) {
  const testOutput = `${output}.${label}.tests.json`;
  if (existsSync(testOutput)) throw new Error('Refusing to overwrite test evidence.');
  const args = [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.workspace.mts', '--project', 'unit',
    'tests/unit/shared/value-objects.test.ts', '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${testOutput}`];
  const startedAt = new Date().toISOString(), start = performance.now();
  const run = spawnSync(process.execPath, args, { cwd: root, timeout: 60000, encoding: 'utf8', maxBuffer: 8e6, windowsHide: true });
  writeFileSync(`${output}.${label}.stdout.log`, run.stdout ?? '');
  writeFileSync(`${output}.${label}.stderr.log`, run.stderr ?? '');
  const result = run.status === 0 ? JSON.parse(readFileSync(testOutput, 'utf8')) : null;
  records.push({ label, startedAt, elapsedMs: Math.round(performance.now() - start), command: { file: process.execPath, args, cwd: root },
    exitCode: run.status, error: run.error?.message ?? null, passed: result?.numPassedTests, failed: result?.numFailedTests,
    tests: result?.testResults.map(f => ({ file: path.relative(root, f.name).replaceAll('\\', '/'), tests: f.assertionResults.map(t => ({ name: t.fullName, status: t.status })) })) });
  console.log(JSON.stringify(records.at(-1)));
  if (run.status !== 0 || result?.numPassedTests !== 3 || result?.numFailedTests !== 0) break;
}
const hash = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
writeFileSync(output, JSON.stringify({ node: process.version, platform: process.platform, project: 'Thang4869/TriAD-Backend', projectSha: head,
  sourceSha256: hash('src/shared/value-objects/address.ts'), lockSha256: hash('package-lock.json'),
  files: Object.fromEntries(['package.json', 'package-lock.json', 'vitest.workspace.mts', 'vitest.unit.config.mts', 'tests/setup-env.ts', 'tests/unit/shared/value-objects.test.ts', 'src/shared/value-objects/address.ts'].map(f => [f, hash(f)])), records }, null, 2));
if (records.length !== 2 || records.some(r => r.exitCode !== 0 || r.passed !== 3 || r.failed !== 0)) process.exitCode = 1;
