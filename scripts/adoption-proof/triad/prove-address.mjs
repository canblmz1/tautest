import { createRequire } from 'node:module';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runStryker } from '@tautest/core';

const toolsRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] ?? 'project');
const out = path.join(root, '.tautest/adoption-proof');
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const cli = path.join(toolsRoot, 'node_modules/tautest/dist/index.js');
const vitest = path.join(root, 'node_modules/vitest/vitest.mjs');
const sourceFile = 'src/shared/value-objects/address.ts';
const candidate = 'tests/unit/shared/value-objects/address.test.ts';
const source = readFileSync(path.join(root, sourceFile), 'utf8');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (head !== '7e41358c9936186d5469437584845335ec255ad1') throw new Error('This proof is pinned to the inspected upstream revision.');
const hash = value => createHash('sha256').update(value).digest('hex');
const steps = [];
function run(label, file, args, expected = 0) {
  const result = spawnSync(file, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  writeFileSync(path.join(out, label + '.stdout.txt'), result.stdout ?? '');
  writeFileSync(path.join(out, label + '.stderr.txt'), result.stderr ?? '');
  steps.push({ label, exitCode: result.status, error: result.error?.message });
  console.log(JSON.stringify(steps.at(-1)));
  if (result.status !== expected) throw new Error(`${label} failed: ${result.stderr || result.stdout || result.error?.message}`);
  return result.stdout;
}
function writeVitest(include) {
  writeFileSync(path.join(root, 'vitest.tautest-pilot.config.mts'), `import unit from './vitest.unit.config.mts';\nexport default {...unit, test: {...unit.test, include: ${JSON.stringify(include)}, maxWorkers: 1, fileParallelism: false}};\n`);
}
const config = {
  testRunner: 'vitest', plugins: [require.resolve('@stryker-mutator/vitest-runner')],
  mutate: [sourceFile], vitest: { configFile: 'vitest.tautest-pilot.config.mts', related: false },
  reporters: ['json'], coverageAnalysis: 'perTest', concurrency: 1,
  thresholds: { high: 80, low: 60, break: 0 }, logLevel: 'error',
  inPlace: false, incremental: false, tempDirName: '.stryker-tmp', cleanTempDir: 'always'
};
function retained(raw) {
  return { schemaVersion: raw.schemaVersion, framework: raw.framework, files: raw.files, testFiles: raw.testFiles,
    config: { testRunner: 'vitest', mutate: [sourceFile] } };
}
function counts(raw) {
  const mutants = Object.values(raw.files).flatMap(f => f.mutants);
  return { total: mutants.length, killed: mutants.filter(m => m.status === 'Killed').length, survived: mutants.filter(m => m.status === 'Survived').length,
    noCoverage: mutants.filter(m => m.status === 'NoCoverage').length, timeout: mutants.filter(m => m.status === 'Timeout').length };
}
writeFileSync(path.join(root, 'stryker.config.json'), JSON.stringify(config, null, 2));
writeVitest(['tests/unit/shared/value-objects.test.ts']);
run('original-tests', process.execPath, [vitest, 'run', '--config', 'vitest.tautest-pilot.config.mts']);
await runStryker({ cwd: root, config: { ...config, jsonReporter: { fileName: path.join(out, 'before.raw.json') } }, jsonReportPath: path.join(out, 'before.raw.json') });
const before = retained(JSON.parse(readFileSync(path.join(out, 'before.raw.json'), 'utf8')));
const target = before.files[sourceFile].mutants.find(m => m.status === 'Survived' && m.mutatorName === 'EqualityOperator' && m.replacement === 'normalized.length >= 500');
if (!target || !(target.testsCompleted > 0)) throw new Error('The expected executed upper-bound survivor was not found.');
writeFileSync(path.join(out, 'before.mutation.json'), JSON.stringify(before, null, 2));
const analysis = JSON.parse(run('analysis', process.execPath, [cli, 'analyze', '--from', path.join(out, 'before.mutation.json'), '--runner', 'vitest', '--json']));
writeVitest(['tests/unit/shared/value-objects.test.ts', candidate]);
run('candidate-tests', process.execPath, [vitest, 'run', '--config', 'vitest.tautest-pilot.config.mts']);
const proof = JSON.parse(run('verified', process.execPath, [cli, 'verify', '--from', path.join(out, 'before.mutation.json'), '--mutant', target.id, '--file', sourceFile, '--test', candidate, '--budget', '120', '--json']));
if (proof.status !== 'verified') throw new Error('Candidate test did not verify the original mutant.');
await runStryker({ cwd: root, config: { ...config, jsonReporter: { fileName: path.join(out, 'after.raw.json') } }, jsonReportPath: path.join(out, 'after.raw.json') });
const after = retained(JSON.parse(readFileSync(path.join(out, 'after.raw.json'), 'utf8')));
writeFileSync(path.join(out, 'after.mutation.json'), JSON.stringify(after, null, 2));
if (readFileSync(path.join(root, sourceFile), 'utf8') !== source) throw new Error('Production source changed.');
const result = { checkedAt: new Date().toISOString(), repo: 'Thang4869/TriAD-Backend', head, node: process.version,
  toolchain: { tautest: '2.1.0', stryker: '10.0.0', vitest: '4.1.11' }, sourceFile, candidate,
  sourceSha256: hash(source), candidateSha256: hash(readFileSync(path.join(root, candidate), 'utf8')),
  scope: 'Full address.ts; three existing value-object tests, then the same tests plus two new address boundary tests. Not a repository-wide mutation baseline.',
  before: counts(before), after: counts(after), target, verification: proof, expressionGroups: analysis.groups.length,
  steps, sourceUnchanged: true, note: 'Maintainer-run proof on a disposable clone; not external adoption. No dependency or production-code patch is proposed.' };
writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ before: result.before, after: result.after, status: proof.status, evidence: path.join(out, 'evidence.json') }));
