// Maintainer-run installation control; this is not independent adoption evidence.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const destination = process.argv[2] ? path.resolve(process.argv[2]) : mkdtempSync(path.join(tmpdir(), 'tautest-onboarding-'));
const candidateTarball = process.argv[3] ? path.resolve(process.argv[3]) : undefined;
const project = path.join(destination, 'project');
if (existsSync(project)) throw new Error(`Refusing to reuse ${project}; choose a new destination.`);
mkdirSync(project, { recursive: true });
mkdirSync(path.join(project, 'src'));
mkdirSync(path.join(project, 'test'));
const steps = [];
const write = (name, content) => writeFileSync(path.join(project, name), content);
const sha256 = contents => createHash('sha256').update(contents).digest('hex');
const save = () => writeFileSync(path.join(destination, 'steps.json'), JSON.stringify({
  kind: 'maintainer-control-not-independent-adoption', startedAt, platform: process.platform,
  node: process.version, project, steps
}, null, 2) + '\n');
const startedAt = new Date().toISOString();
function run(name, command, args, allowed = [0]) {
  const start = Date.now();
  // Windows .cmd shims need a shell. Quote each argument as a PowerShell literal,
  // including git commit messages; do not join unescaped values into shell code.
  const literal = value => `'${value.replaceAll("'", "''")}'`;
  const executable = process.platform === 'win32' ? 'powershell.exe' : command;
  const invocation = process.platform === 'win32'
    ? ['-NoProfile', '-NonInteractive', '-Command', `& ${[command, ...args].map(literal).join(' ')}; exit $LASTEXITCODE`]
    : args;
  const result = spawnSync(executable, invocation, { cwd: project, encoding: 'utf8',
    timeout: 240_000, maxBuffer: 8 * 1024 * 1024 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(path.join(destination, `${name}.log`), output);
  steps.push({ name, command: [command, ...args], startedAt: new Date(start).toISOString(),
    durationMs: Date.now() - start, exitCode: result.status, signal: result.signal,
    error: result.error?.message ?? null, output: `${name}.log` });
  save();
  process.stdout.write(`${name}: exit=${result.status}, ${Date.now() - start}ms\n`);
  if (!allowed.includes(result.status) || result.error) throw new Error(`${name} failed; read ${destination}/${name}.log`);
  return output;
}

write('package.json', JSON.stringify({ name: 'tautest-clean-install-control', private: true,
  version: '0.0.0', type: 'module', packageManager: 'pnpm@10.33.1', scripts: { test: 'vitest run' } }, null, 2) + '\n');
write('.gitignore', 'node_modules/\n.tautest/\n.stryker-tmp/\n');
write('src/eligibility.ts', 'export function isEligible(age: number): boolean {\n  return age > 17;\n}\n');
write('test/eligibility.test.ts', "import { expect, it } from 'vitest';\nimport { isEligible } from '../src/eligibility';\nit('accepts an adult', () => expect(isEligible(20)).toBe(true));\nit('rejects an underage applicant', () => expect(isEligible(17)).toBe(false));\n");
write('vitest.config.ts', "import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { include: ['test/**/*.test.ts'] } });\n");
write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext',
  moduleResolution: 'Bundler', strict: true, noEmit: true }, include: ['src', 'test', 'vitest.config.ts'] }, null, 2) + '\n');
if (run('pnpm-version', 'pnpm', ['--version']).trim() !== '10.33.1') throw new Error('Use pnpm 10.33.1 for this control.');
const response = await fetch('https://registry.npmjs.org/tautest/latest', { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
const metadata = await response.json();
writeFileSync(path.join(destination, 'registry.json'), JSON.stringify({ queriedAt: new Date().toISOString(),
  source: 'https://registry.npmjs.org/tautest/latest', name: metadata.name, version: metadata.version,
  testedVersion: '2.1.4', testedVersionSelection: 'latest observed on 2026-10-22; deliberately pinned',
  latestIntegrity: metadata.dist?.integrity }, null, 2) + '\n');
run('install', 'pnpm', ['add', '-D', '--save-exact', 'tautest@2.1.4', '@stryker-mutator/core@10.0.0',
  '@stryker-mutator/vitest-runner@10.0.0', 'vitest@4.1.8', 'typescript@5.8.3']);
copyFileSync(path.join(project, 'pnpm-lock.yaml'), path.join(destination, 'published.pnpm-lock.yaml'));
const dependencies = JSON.parse(run('versions', 'pnpm', ['list', '--depth', '1', '--json']))[0].devDependencies;
for (const [name, version] of Object.entries({ tautest: '2.1.4', '@stryker-mutator/core': '10.0.0',
  '@stryker-mutator/vitest-runner': '10.0.0', vitest: '4.1.8', typescript: '5.8.3' })) {
  if (dependencies[name]?.version !== version) throw new Error(`Wrong installed ${name} version.`);
}
if (dependencies.tautest.dependencies['@tautest/core']?.version !== '2.1.4') throw new Error('Wrong installed Tautest core version.');
if (run('cli-version', 'pnpm', ['exec', 'tautest', '--version']).trim() !== '2.1.4') throw new Error('Wrong CLI version.');
run('baseline-one', 'pnpm', ['test']);
run('baseline-two', 'pnpm', ['test']);
run('git-init', 'git', ['init', '-b', 'main']);
run('git-add-base', 'git', ['add', '.']);
run('git-commit-base', 'git', ['-c', 'user.name=Tautest-control', '-c', 'user.email=control@example.invalid',
  'commit', '-m', 'Baseline passing control']);
run('git-base-sha', 'git', ['rev-parse', 'HEAD']);
run('git-branch', 'git', ['checkout', '-b', 'control/age-boundary']);
write('src/eligibility.ts', 'export function isEligible(age: number): boolean {\n  return age >= 18;\n}\n');
run('init', 'pnpm', ['exec', 'tautest', 'init', '--yes', '--runner', 'vitest', '--no-install']);
// One worker bounds the control's resource use; all other generated settings stay intact.
const config = path.join(project, 'tautest.config.ts');
const generated = readFileSync(config, 'utf8');
if (!generated.includes('incremental: false')) throw new Error('Unexpected generated configuration; inspect before continuing.');
writeFileSync(config, generated.replace('incremental: false', 'incremental: false,\n    concurrency: 1'));
run('git-add-change', 'git', ['add', '.']);
run('git-commit-change', 'git', ['-c', 'user.name=Tautest-control', '-c', 'user.email=control@example.invalid',
  'commit', '-m', 'Control boundary source change']);
run('git-head-sha', 'git', ['rev-parse', 'HEAD']);
run('diff', 'git', ['diff', '--unified=0', 'main', '--', 'src/eligibility.ts']);
run('doctor', 'pnpm', ['exec', 'tautest', 'doctor', '--json']);
const scope = JSON.parse(run('dry-run', 'pnpm', ['exec', 'tautest', 'run', '--dry-run', '--base', 'main', '--json']));
if (JSON.stringify(scope.mutatePatterns) !== '["src/eligibility.ts:2-2"]') throw new Error('Unexpected changed-line scope.');
run('mutation', 'pnpm', ['exec', 'tautest', 'run', '--base', 'main', '--json'], [0, 1]);
for (const name of ['mutation.json', 'report.json', 'report.md', 'fix-prompt.md']) {
  copyFileSync(path.join(project, '.tautest', name), path.join(destination, `before.${name}`));
}
run('unchanged-normal-suite', 'pnpm', ['test']);
run('analyze', 'pnpm', ['exec', 'tautest', 'analyze', '--from', '.tautest/mutation.json', '--runner', 'vitest', '--json']);
const raw = JSON.parse(readFileSync(path.join(destination, 'before.mutation.json'), 'utf8'));
const file = raw.files['src/eligibility.ts'];
const target = file?.mutants.find(m => m.mutatorName === 'EqualityOperator' && m.replacement === 'age > 18');
if (!target || target.status !== 'Survived' || !(target.testsCompleted > 0) || !target.coveredBy?.length) {
  throw new Error('Expected executed boundary survivor with test attribution is absent; inspect raw report.');
}
const coveringTests = Object.entries(raw.testFiles ?? {}).flatMap(([name, value]) => value.tests
  .filter(test => target.coveredBy.includes(test.id)).map(test => ({ file: name, id: test.id, name: test.name })));
if (coveringTests.length !== target.coveredBy.length) throw new Error('Unresolved covering-test identities.');
write('test/boundary.test.ts', "import { expect, it } from 'vitest';\nimport { isEligible } from '../src/eligibility';\nit('accepts the minimum eligible age of 18', () => expect(isEligible(18)).toBe(true));\n");
run('candidate-normal-suite', 'pnpm', ['test']);
const verifyArgs = ['exec', 'tautest', 'verify', '--from', '.tautest/mutation.json', '--mutant', target.id,
  '--file', 'src/eligibility.ts', '--test', 'test/boundary.test.ts', '--budget', '120', '--json'];
const publishedVerification = JSON.parse(run('verify-published', 'pnpm', verifyArgs, [0, 12]));
if (publishedVerification.status !== 'verified' && !candidateTarball) {
  throw new Error('Published verification failed; evidence retained. Supply a separately built candidate tarball to compare.');
}
if (candidateTarball) {
  run('install-candidate', 'pnpm', ['add', '-D', candidateTarball]);
  writeFileSync(path.join(destination, 'candidate-package.json'), JSON.stringify({
    kind: 'unpublished-candidate', tarballSha256: sha256(readFileSync(candidateTarball)),
    note: 'Package version is unchanged; identify this candidate by tarball hash and source commit, not version alone.'
  }, null, 2) + '\n');
  const verification = JSON.parse(run('verify-candidate', 'pnpm', verifyArgs));
  if (verification.status !== 'verified' || verification.target.replacement !== target.replacement) {
    throw new Error('Candidate did not verify the expected target.');
  }
}
// Check the observable behavior directly as well; always restore this owned fixture's source.
const sourcePath = path.join(project, 'src/eligibility.ts');
const originalSource = readFileSync(sourcePath, 'utf8');
try {
  writeFileSync(sourcePath, originalSource.replace('age >= 18', 'age > 18'));
  const failure = run('exact-replacement-assertion', 'pnpm', ['test'], [1]);
  if (!failure.includes('accepts the minimum eligible age of 18') || !failure.includes('expected false to be true')) {
    throw new Error('Replacement did not fail the expected behavior assertion.');
  }
} finally { writeFileSync(sourcePath, originalSource); }
run('restored-original-suite', 'pnpm', ['test']);
const source = readFileSync(path.join(project, 'src/eligibility.ts'));
if (source.toString() !== file.source) throw new Error('Source changed during control.');
writeFileSync(path.join(destination, 'target.json'), JSON.stringify({ sourceSha256: sha256(source), file: 'src/eligibility.ts',
  ...target, coveringTests, sourceUnchanged: true, lockfileSha256: sha256(readFileSync(path.join(project, 'pnpm-lock.yaml'))) }, null, 2) + '\n');
run('final-status', 'git', ['status', '--short']);
console.log(`Evidence retained in ${destination}`);
