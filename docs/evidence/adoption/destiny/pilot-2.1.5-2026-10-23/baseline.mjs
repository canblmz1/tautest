import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'project');
const expectedSha = '61954b029e818f4e534268f48e0a772495303598';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git(['rev-parse', 'HEAD']) !== expectedSha || git(['status', '--porcelain', '--untracked-files=no'])) throw new Error('Use the clean pinned disposable clone.');
if (!process.versions.node.startsWith('22.')) throw new Error('This control uses Node 22.');
const protectedFiles = ['package.json', 'package-lock.json', 'vitest.config.ts', 'stryker.config.mjs', 'tsconfig.stryker.json', 'tests/setup/test-db-path.ts', 'tests/setup/no-network.ts', 'src/lib/active-session/roster.ts', 'src/lib/active-session/roster.test.ts'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashes = Object.fromEntries(protectedFiles.map(file => [file, sha(readFileSync(path.join(root, file)))]));
const versions = Object.fromEntries(['vitest', '@stryker-mutator/core', '@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker', 'typescript'].map(name => [name, JSON.parse(readFileSync(path.join(root, 'node_modules', name, 'package.json'))).version]));
const records = [];
for (const label of ['baseline-1', 'baseline-2']) {
  const output = path.join(here, `${label}.tests.json`);
  if (existsSync(output)) throw new Error('Refusing to overwrite existing test evidence.');
  const args = [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', 'src/lib/active-session/roster.test.ts', '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${output}`];
  const startedAt = new Date().toISOString(), start = performance.now();
  const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 8_000_000, windowsHide: true });
  writeFileSync(path.join(here, `${label}.stdout.log`), run.stdout ?? '');
  writeFileSync(path.join(here, `${label}.stderr.log`), run.stderr ?? '');
  const test = run.status === 0 ? JSON.parse(readFileSync(output)) : null;
  records.push({ label, startedAt, elapsedMs: Math.round(performance.now() - start), command: { file: process.execPath, args, cwd: root }, exitCode: run.status, signal: run.signal, error: run.error?.message ?? null,
    passed: test?.numPassedTests, failed: test?.numFailedTests, tests: test?.testResults.map(file => ({ file: path.relative(root, file.name).replaceAll('\\', '/'), tests: file.assertionResults.map(t => ({ name: t.fullName, status: t.status })) })) });
  writeFileSync(path.join(here, 'baseline.json'), JSON.stringify({ kind: 'maintainer-control-not-independent-adoption', projectSha: expectedSha, node: process.version, platform: process.platform, versions, hashes, records }, null, 2));
  console.log(JSON.stringify(records.at(-1)));
  if (run.status !== 0 || run.error || !test.numPassedTests || test.numFailedTests) throw new Error('Original selected tests did not pass. No mutant result is claimed.');
}
