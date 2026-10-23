import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
const head = 'dfbc0ce81a507c1f80f555b9ca5b2bd0e19d6c69';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
if (git(['rev-parse', 'HEAD']) !== head || git(['status', '--porcelain', '--untracked-files=no'])) throw new Error('Use a clean pinned disposable clone.');
if (!process.versions.node.startsWith('22.')) throw new Error('This run uses the project CI Node22 line.');
if (existsSync(out)) throw new Error('Choose a new baseline file.');
const env = { ...process.env, PUBLIC_PB_URL: 'http://127.0.0.1:8090', PUBLIC_APP_URL: 'http://127.0.0.1:5173', WAYPOINT_DEV_MODE: 'true' };
const records = [];
function run(label, args) {
  const startedAt = new Date().toISOString(), start = performance.now();
  const r = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', timeout: 90000, maxBuffer: 8e6, windowsHide: true });
  writeFileSync(`${out}.${label}.stdout.log`, r.stdout ?? ''); writeFileSync(`${out}.${label}.stderr.log`, r.stderr ?? '');
  records.push({ label, startedAt, elapsedMs: Math.round(performance.now() - start), command: { file: process.execPath, args, cwd: root }, exitCode: r.status, error: r.error?.message ?? null });
  console.log(JSON.stringify(records.at(-1))); return r;
}
const sync = run('svelte-kit-sync', [path.join(root, 'node_modules/@sveltejs/kit/svelte-kit.js'), 'sync']);
let success = sync.status === 0;
if (success) for (const label of ['baseline-1', 'baseline-2']) {
  const testsPath = `${out}.${label}.tests.json`;
  const r = run(label, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--project', 'server', 'src/lib/shell/trip-time.test.ts',
    '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${testsPath}`]);
  const report = r.status === 0 ? JSON.parse(readFileSync(testsPath, 'utf8')) : null;
  Object.assign(records.at(-1), { passed: report?.numPassedTests, failed: report?.numFailedTests,
    tests: report?.testResults.map(f => ({ file: path.relative(root, f.name).replaceAll('\\', '/'), tests: f.assertionResults.map(t => ({ name: t.fullName, status: t.status })) })) });
  if (r.status !== 0 || report?.numPassedTests !== 15 || report?.numFailedTests !== 0) { success = false; break; }
}
const hash = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
writeFileSync(out, JSON.stringify({ checkedAt: new Date().toISOString(), projectSha: head, node: process.version, platform: process.platform,
  dummyCiEnvironment: { PUBLIC_PB_URL: env.PUBLIC_PB_URL, PUBLIC_APP_URL: env.PUBLIC_APP_URL, WAYPOINT_DEV_MODE: env.WAYPOINT_DEV_MODE },
  files: Object.fromEntries(['package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'svelte.config.js', 'tsconfig.json', 'src/lib/shell/trip-time.ts', 'src/lib/shell/trip-time.test.ts'].map(file => [file, hash(file)])),
  records, success, scope: 'Only the existing server-project trip-time unit test file; no full unit suite, E2E, PocketBase, app server or mutation execution.' }, null, 2));
if (!success) process.exitCode = 1;
