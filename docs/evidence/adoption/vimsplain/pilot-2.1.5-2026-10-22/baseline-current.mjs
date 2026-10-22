import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const repo = path.resolve(process.argv[2]), output = path.resolve(process.argv[3]);
const cwd = path.join(repo, 'packages/vimsplain');
const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
if (git(['rev-parse', 'HEAD']) !== 'e65d98ca48f6432779b6bf2cb677d1a9116400d8') throw new Error('Use the pinned current Vimgym SHA.');
if (!process.versions.node.startsWith('22.')) throw new Error('Use Node22.');
if (git(['status', '--porcelain', '--untracked-files=no'])) throw new Error('Use a clean disposable project clone.');
if (existsSync(output)) throw new Error('Choose a fresh baseline JSON path.');
const records = [];
for (const label of ['baseline-1', 'baseline-2']) {
  const testsPath = `${output}.${label}.tests.json`;
  if (existsSync(testsPath)) throw new Error('Refusing to overwrite baseline evidence.');
  const args = [path.join(cwd, 'node_modules/vitest/vitest.mjs'), 'run', '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${testsPath}`];
  const startedAt = new Date().toISOString(), start = performance.now();
  const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 16e6, windowsHide: true });
  writeFileSync(`${output}.${label}.stdout.log`, r.stdout ?? ''); writeFileSync(`${output}.${label}.stderr.log`, r.stderr ?? '');
  const result = r.status === 0 ? JSON.parse(readFileSync(testsPath, 'utf8')) : null;
  records.push({ label, startedAt, elapsedMs: Math.round(performance.now() - start), command: { file: process.execPath, args, cwd }, exitCode: r.status,
    error: r.error?.message ?? null, passed: result?.numPassedTests, failed: result?.numFailedTests,
    tests: result?.testResults.map(f => ({ file: path.relative(cwd, f.name).replaceAll('\\', '/'), tests: f.assertionResults.map(t => ({ name: t.fullName, status: t.status })) })) });
  console.log(JSON.stringify({ label, exitCode: r.status, passed: result?.numPassedTests, failed: result?.numFailedTests }));
  if (r.status !== 0 || result?.numPassedTests !== 372 || result?.numFailedTests !== 0) break;
}
const files = [...new Set([...git(['ls-files', '--', 'packages/vimsplain']).split('\n'), 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'vitest.config.ts', 'AGENTS.md'])];
const source = readFileSync(path.join(cwd, 'src/handlers/command.ts'));
writeFileSync(output, JSON.stringify({ observedAt: new Date().toISOString(), projectSha: git(['rev-parse', 'HEAD']), node: process.version, platform: process.platform,
  packageCwd: 'packages/vimsplain', sourceSha256: sha(source), sourceSha256LF: sha(source.toString('utf8').replace(/\r\n/g, '\n')),
  files: Object.fromEntries(files.map(file => [file, sha(readFileSync(path.join(repo, file)))])), records,
  limits: ['Original package test selection; not the root React/Supabase app.', 'Our baseline, not independent user adoption.'] }, null, 2));
if (records.length !== 2 || records.some(r => r.exitCode !== 0 || r.passed !== 372 || r.failed !== 0)) process.exitCode = 1;
