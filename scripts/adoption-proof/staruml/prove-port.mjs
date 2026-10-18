import { createRequire } from 'node:module';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runStryker } from '@tautest/core';

const toolsRoot = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const root = path.resolve(process.argv[2] ?? 'project');
const out = path.join(root, '.tautest/adoption-proof');
mkdirSync(out, { recursive: true });
const cli = path.join(toolsRoot, 'node_modules/tautest/dist/index.js');
const vitest = path.join(root, 'node_modules/vitest/vitest.mjs');
const sourceFile = 'src/staruml-client.ts';
const candidate = 'tests/staruml-client.test.ts';
const source = readFileSync(path.join(root, sourceFile), 'utf8');
const originalTests = readFileSync(path.join(root, candidate), 'utf8');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (head !== '3a58d812d7c52b559ac920bf17fc0fa1cf19dcf3') throw new Error('Proof must use the inspected revision.');
const hash = value => createHash('sha256').update(value).digest('hex');
const steps = [];
function run(label, file, args) {
  const result = spawnSync(file, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  writeFileSync(path.join(out, label + '.stdout.txt'), result.stdout ?? '');
  writeFileSync(path.join(out, label + '.stderr.txt'), result.stderr ?? '');
  steps.push({ label, exitCode: result.status, error: result.error?.message });
  console.log(JSON.stringify(steps.at(-1)));
  if (result.status !== 0) throw new Error(`${label} failed: ${result.stderr || result.stdout || result.error?.message}`);
  return result.stdout;
}
const config = {
  testRunner: 'vitest', plugins: [require.resolve('@stryker-mutator/vitest-runner')],
  mutate: [sourceFile + ':38-38'], vitest: { configFile: 'vitest.tautest-pilot.config.mts', related: false },
  reporters: ['json'], coverageAnalysis: 'perTest', concurrency: 1,
  thresholds: { high: 80, low: 60, break: 0 }, logLevel: 'error',
  inPlace: false, incremental: false, tempDirName: '.stryker-tmp', cleanTempDir: 'always'
};
function retained(raw) {
  return { schemaVersion: raw.schemaVersion, framework: raw.framework, files: raw.files, testFiles: raw.testFiles,
    config: { testRunner: 'vitest', mutate: [sourceFile + ':38-38'] } };
}
function counts(raw) {
  const mutants = Object.values(raw.files).flatMap(f => f.mutants);
  return Object.fromEntries(['total', 'Killed', 'Survived', 'NoCoverage', 'Timeout', 'RuntimeError'].map(s => [s, s === 'total' ? mutants.length : mutants.filter(m => m.status === s).length]));
}
writeFileSync(path.join(root, 'vitest.tautest-pilot.config.mts'), `import original from './vitest.config.ts';\nexport default {...original, test: {...original.test, include: [${JSON.stringify(candidate)}], maxWorkers: 1, minWorkers: 1, fileParallelism: false}};\n`);
writeFileSync(path.join(root, 'stryker.config.json'), JSON.stringify(config, null, 2));
run('original-tests', process.execPath, [vitest, 'run', '--config', 'vitest.tautest-pilot.config.mts']);
await runStryker({ cwd: root, config: { ...config, jsonReporter: { fileName: path.join(out, 'before.raw.json') } }, jsonReportPath: path.join(out, 'before.raw.json') });
const before = retained(JSON.parse(readFileSync(path.join(out, 'before.raw.json'), 'utf8')));
const target = before.files[sourceFile].mutants.find(m => m.status === 'Survived' && m.mutatorName === 'LogicalOperator' && m.replacement === 'options.extPort && DEFAULT_EXT_PORT');
if (!target || !(target.testsCompleted > 0)) throw new Error('The expected executed extension-port survivor was not found.');
writeFileSync(path.join(out, 'before.mutation.json'), JSON.stringify(before, null, 2));
const analysis = JSON.parse(run('analysis', process.execPath, [cli, 'analyze', '--from', path.join(out, 'before.mutation.json'), '--runner', 'vitest', '--json']));
run('apply-tests', 'git', ['apply', '--unidiff-zero', path.join(toolsRoot, 'extension-port-tests.patch')]);
run('candidate-tests', process.execPath, [vitest, 'run', '--config', 'vitest.tautest-pilot.config.mts']);
const proof = JSON.parse(run('verified', process.execPath, [cli, 'verify', '--from', path.join(out, 'before.mutation.json'), '--mutant', target.id, '--file', sourceFile, '--test', candidate, '--budget', '120', '--json']));
if (proof.status !== 'verified') throw new Error('Candidate test did not verify the original mutant.');
const verifiedReport = JSON.parse(readFileSync(path.join(proof.paths.directory, 'mutation.json'), 'utf8'));
const killingTests = Object.entries(verifiedReport.testFiles ?? {}).flatMap(([file, record]) => record.tests.filter(t => proof.killedBy.includes(t.id)).map(t => ({file, ...t})));
if (!killingTests.some(t => t.file === candidate && t.name.includes('extension port regression'))) throw new Error('Kill must be attributed to a newly added regression test.');
await runStryker({ cwd: root, config: { ...config, jsonReporter: { fileName: path.join(out, 'after.raw.json') } }, jsonReportPath: path.join(out, 'after.raw.json') });
const after = retained(JSON.parse(readFileSync(path.join(out, 'after.raw.json'), 'utf8')));
writeFileSync(path.join(out, 'after.mutation.json'), JSON.stringify(after, null, 2));
if (readFileSync(path.join(root, sourceFile), 'utf8') !== source) throw new Error('Production source changed.');
if (counts(before).total !== 1 || counts(after).total !== 1 || counts(after).Killed !== 1) throw new Error('Unexpected scoped before/after result.');
const result = { checkedAt: new Date().toISOString(), repo: 'hqqw2h-lgtm/staruml-mcp', head, node: process.version,
  toolchain: { tautest: '2.1.0', stryker: '9.6.1', vitest: '2.1.9' }, sourceFile, candidate,
  sourceSha256: hash(source), originalTestsSha256: hash(originalTests), candidateSha256: hash(readFileSync(path.join(root, candidate), 'utf8')),
  scope: 'Only the extPort expression on line 38, with the existing 14 client tests and then the same tests plus two port regression tests. Not a repository-wide score.',
  before: counts(before), after: counts(after), target, verification: proof, killingTests, expressionGroups: analysis.groups.length,
  steps, sourceUnchanged: true, note: 'Maintainer-run proof, not external adoption. No production or dependency changes are proposed.' };
writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ before: result.before, after: result.after, status: proof.status, killingTests }));
