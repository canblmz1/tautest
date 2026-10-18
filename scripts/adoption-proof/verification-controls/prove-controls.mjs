import { createRequire } from 'node:module';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const toolsRoot = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const root = path.resolve(process.argv[2] ?? 'project');
const out = path.join(root, '.tautest/verification-controls');
mkdirSync(out, { recursive: true });
const cli = path.join(toolsRoot, 'node_modules/tautest/dist/index.js');
const vitest = path.join(root, 'node_modules/vitest/vitest.mjs');
const sourceFile = 'src/shared/value-objects/address.ts';
const originalTests = 'tests/unit/shared/value-objects.test.ts';
const weakFile = 'tests/unit/shared/value-objects/address-empty-only.test.ts';
const positiveFile = 'tests/unit/shared/value-objects/address.test.ts';
const source = readFileSync(path.join(root, sourceFile), 'utf8');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (head !== '7e41358c9936186d5469437584845335ec255ad1') throw new Error('The proof requires its inspected revision.');
const original = readFileSync(path.resolve(toolsRoot, '../../../docs/evidence/adoption/triad-address/before.mutation.json'), 'utf8');
const inputFile = path.join(out, 'original.mutation.json');
writeFileSync(inputFile, original);
const before = JSON.parse(original);
if (before.files[sourceFile].source !== source) throw new Error('Retained report and project source differ.');
const target = before.files[sourceFile].mutants.find(m => m.status === 'Survived' && m.mutatorName === 'EqualityOperator' && m.replacement === 'normalized.length >= 500');
if (!target || !(target.testsCompleted > 0)) throw new Error('Expected executed original survivor missing.');
const hash = value => createHash('sha256').update(value).digest('hex');
const steps = [];
function run(label, args, expected = 0) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  writeFileSync(path.join(out, `${label}.stdout.txt`), r.stdout ?? '');
  writeFileSync(path.join(out, `${label}.stderr.txt`), r.stderr ?? '');
  steps.push({ label, exitCode: r.status, error: r.error?.message });
  console.log(JSON.stringify(steps.at(-1)));
  if (r.status !== expected) throw new Error(`${label} failed: ${r.stderr || r.stdout || r.error?.message}`);
  return r.stdout;
}
function suite(label, include, count) {
  writeFileSync(path.join(root, 'vitest.tautest-pilot.config.mts'), `import unit from './vitest.unit.config.mts';\nexport default {...unit, test: {...unit.test, include: ${JSON.stringify(include)}, maxWorkers: 1, fileParallelism: false}};\n`);
  const resultFile = path.join(out, `${label}.tests.json`);
  run(label, [vitest, 'run', '--config', 'vitest.tautest-pilot.config.mts', '--reporter=json', `--outputFile=${resultFile}`]);
  const result = JSON.parse(readFileSync(resultFile, 'utf8'));
  if (result.numTotalTests !== count || result.numPassedTests !== count || result.numFailedTests !== 0) throw new Error(`${label}: expected ${count} passing tests.`);
  return { total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests };
}
const config = { testRunner: 'vitest', plugins: [require.resolve('@stryker-mutator/vitest-runner')], mutate: [sourceFile],
  vitest: { configFile: 'vitest.tautest-pilot.config.mts', related: false }, reporters: ['json'], coverageAnalysis: 'perTest', concurrency: 1,
  thresholds: { high: 80, low: 60, break: 0 }, logLevel: 'error', inPlace: false, incremental: false, tempDirName: '.stryker-tmp', cleanTempDir: 'always' };
writeFileSync(path.join(root, 'stryker.config.json'), JSON.stringify(config, null, 2));
function verify(label, candidate, expected) {
  const proof = JSON.parse(run(label, [cli, 'verify', '--from', inputFile, '--mutant', target.id, '--file', sourceFile, '--test', candidate, '--budget', '120', '--json'], expected));
  const report = JSON.parse(readFileSync(path.join(proof.paths.directory, 'mutation.json'), 'utf8'));
  const actual = report.files[sourceFile].mutants.find(m => m.mutatorName === target.mutatorName && m.replacement === target.replacement &&
    m.location.start.line === target.location.start.line && m.location.start.column === target.location.start.column &&
    m.location.end.line === target.location.end.line && m.location.end.column === target.location.end.column);
  if (!actual || !(actual.testsCompleted > 0)) throw new Error(`${label}: exact target did not execute.`);
  const killingTests = Object.entries(report.testFiles ?? {}).flatMap(([file, item]) => item.tests.filter(t => actual.killedBy?.includes(t.id)).map(t => ({ file, ...t })));
  return { selectedFile: candidate, verification: proof, targetStatus: actual.status, originalId: target.id, replayedId: actual.id, testsCompleted: actual.testsCompleted, killingTests };
}
const baseline = suite('baseline', [originalTests], 3);
copyFileSync(path.join(toolsRoot, 'empty-only.test.ts'), path.join(root, weakFile));
const weakSuite = suite('weak-suite', [originalTests, weakFile], 4);
const weak = verify('weak-candidate', weakFile, 1);
if (weak.verification.status !== 'not-verified' || weak.targetStatus !== 'Survived') throw new Error('A green weak test must not count as a target kill.');
copyFileSync(path.join(toolsRoot, 'boundary.test.ts'), path.join(root, positiveFile));
const positiveSuite = suite('positive-suite', [originalTests, weakFile, positiveFile], 6);
const wrongFile = verify('wrong-file', weakFile, 1);
if (wrongFile.verification.status !== 'not-verified' || wrongFile.targetStatus !== 'Killed' || wrongFile.killingTests.some(t => t.file === weakFile) || !wrongFile.killingTests.some(t => t.file === positiveFile)) throw new Error('A kill from a different file must not count as the selected file contribution.');
const positive = verify('positive-candidate', positiveFile, 0);
if (positive.verification.status !== 'verified' || !positive.killingTests.some(t => t.file === positiveFile && t.name.includes('accepts exactly 500'))) throw new Error('The expected new boundary test must be the killer.');
if (readFileSync(path.join(root, sourceFile), 'utf8') !== source || readFileSync(inputFile, 'utf8') !== original) throw new Error('Production source or original report changed.');
const evidence = { checkedAt: new Date().toISOString(), repo: 'Thang4869/TriAD-Backend', head, node: process.version,
  toolchain: { tautest: '2.1.1', stryker: '10.0.0', vitest: '4.1.11' }, sourceFile, sourceSha256: hash(source), inputSha256: hash(original),
  baseline, weakSuite, positiveSuite, target, cases: { weak, wrongFile, positive }, sourceUnchanged: true, inputUnchanged: true, steps,
  limitation: 'Tautest attributes kills to a selected file, not to a requested individual test name. The positive file contains only newly added tests; fresh report test names are checked separately. No general new-test guarantee is claimed for files mixing old and new tests.',
  scope: 'Exact address upper-bound survivor. No full-project mutation score, agent quality comparison or external adoption is claimed.' };
writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ baseline, weakSuite, positiveSuite, cases: Object.fromEntries(Object.entries(evidence.cases).map(([k,v]) => [k,{status:v.verification.status,target:v.targetStatus,selected:v.selectedFile,killingTests:v.killingTests,originalId:v.originalId,replayedId:v.replayedId}])) }));
