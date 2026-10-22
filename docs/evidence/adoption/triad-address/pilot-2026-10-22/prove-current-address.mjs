import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const tools = path.join(here, 'tools');
const require = createRequire(path.join(tools, 'package.json'));

if (process.argv[2] === '--engine') {
  const request = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  process.chdir(request.root);
  const { Stryker } = await import(pathToFileURL(require.resolve('@stryker-mutator/core')).href);
  await new Stryker(request.config).runMutationTest();
} else {
  await prove();
}

async function prove() {
  const root = path.resolve(process.argv[2]);
  const out = path.resolve(process.argv[3]);
  const expectedHead = '902dec9b1178e84dc927499705b75f083a95dd90';
  const sourceFile = 'src/shared/value-objects/address.ts';
  const existingTest = 'tests/unit/shared/value-objects.test.ts';
  const candidateFile = 'tests/unit/shared/value-objects/tautest-address-boundary.test.ts';
  const unitFile = 'vitest.triad-pilot.config.mts';
  const configFile = 'stryker.config.json';
  const cli = path.join(tools, 'node_modules/tautest/dist/index.js');
  const vitest = path.join(root, 'node_modules/vitest/vitest.mjs');
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const hashLF = text => sha(text.replace(/\r\n/g, '\n'));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const sourcePath = path.join(root, sourceFile);
  const sourceBytes = readFileSync(sourcePath);
  const source = sourceBytes.toString('utf8');
  const baseline = JSON.parse(readFileSync(path.resolve(process.argv[4] ?? path.join(here, 'baseline.json')), 'utf8'));
  check(process.versions.node.startsWith('22.'), 'Use Node22 as the project CI does.');
  check(git(['rev-parse', 'HEAD']) === expectedHead, 'This is a new proof pinned to current902dec9, not the historical SHA-guarded helper.');
  check(git(['status', '--porcelain', '--untracked-files=no']) === '', 'Use a clean disposable checkout.');
  check(baseline.projectSha === expectedHead && baseline.sourceSha256 === sha(sourceBytes)
    && baseline.records.length === 2 && baseline.records.every(r => r.exitCode === 0 && r.passed === 3), 'Two real current-source baseline runs are required first.');
  check(!existsSync(out), 'Choose a new output directory; do not overwrite evidence.');
  for (const file of [candidateFile, unitFile, configFile]) check(!existsSync(path.join(root, file)), `Refusing to overwrite ${file}.`);
  mkdirSync(out, { recursive: true });
  const protectedFiles = ['package.json', 'package-lock.json', 'vitest.workspace.mts', 'vitest.unit.config.mts', 'tests/setup-env.ts', existingTest, sourceFile];
  const protectedHashes = Object.fromEntries(protectedFiles.map(file => [file, sha(readFileSync(path.join(root, file)))]));
  const steps = [];
  const savedSteps = () => writeFileSync(path.join(out, 'steps.json'), JSON.stringify(steps, null, 2));
  async function run(label, args, expected = 0) {
    const startedAt = new Date().toISOString(), start = performance.now();
    let stdout = '', stderr = '', timedOut = false, error;
    const child = spawn(process.execPath, args, { cwd: root, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const killOwnTree = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000 });
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    };
    const timer = setTimeout(() => { timedOut = true; killOwnTree(); }, 180000);
    child.stdout.on('data', bytes => { stdout += bytes.toString(); if (stdout.length > 32e6) { error = 'stdout limit exceeded'; killOwnTree(); } });
    child.stderr.on('data', bytes => { stderr += bytes.toString(); if (stderr.length > 32e6) { error = 'stderr limit exceeded'; killOwnTree(); } });
    const result = await new Promise(resolve => {
      child.on('error', e => { error = e.message; });
      child.on('close', (exitCode, signal) => resolve({ exitCode, signal }));
    });
    clearTimeout(timer);
    writeFileSync(path.join(out, `${label}.stdout.log`), stdout);
    writeFileSync(path.join(out, `${label}.stderr.log`), stderr);
    steps.push({ label, startedAt, elapsedMs: Math.round(performance.now() - start), command: { file: process.execPath, args, cwd: root }, ...result, timedOut, error: error ?? null });
    savedSteps();
    console.log(JSON.stringify(steps.at(-1)));
    check(!timedOut && !error && result.exitCode === expected, `${label} failed; inspect logs. No kill/success claim is made.`);
    return stdout;
  }
  async function normal(label, candidate, expectedPassed, expectedFailed = 0) {
    const testOutput = path.join(out, `${label}.tests.json`);
    await run(label, [vitest, 'run', '--config', 'vitest.workspace.mts', '--project', 'unit', existingTest,
      ...(candidate ? [candidateFile] : []), '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${testOutput}`], expectedFailed ? 1 : 0);
    const result = JSON.parse(readFileSync(testOutput, 'utf8'));
    check(result.numPassedTests === expectedPassed && result.numFailedTests === expectedFailed, `${label}: unexpected executed-test counts.`);
    return result;
  }
  const version = name => JSON.parse(readFileSync(path.join(tools, 'node_modules', name, 'package.json'), 'utf8')).version;
  const versions = Object.fromEntries(['tautest', '@tautest/core', '@stryker-mutator/core', '@stryker-mutator/vitest-runner', 'vitest', 'typescript'].map(name => [name, version(name)]));
  check(versions.tautest === '2.1.4' && versions['@tautest/core'] === '2.1.4' && versions['@stryker-mutator/core'] === '10.0.0' && versions['@stryker-mutator/vitest-runner'] === '10.0.0' && versions.vitest === '4.1.11', 'Unexpected isolated tool versions.');
  const engineEntry = require.resolve('@stryker-mutator/core');
  const engineRequire = createRequire(engineEntry);
  const instrumenter = engineRequire.resolve('@stryker-mutator/instrumenter');
  const { allMutators } = await import(new URL('./mutators/mutate.js', pathToFileURL(instrumenter)).href);
  const config = {
    testRunner: 'vitest', plugins: [require.resolve('@stryker-mutator/vitest-runner')],
    mutate: [`${sourceFile}:6-6`], vitest: { configFile: unitFile, related: false },
    reporters: ['json'], coverageAnalysis: 'perTest', concurrency: 1, incremental: false,
    thresholds: { high: 80, low: 60, break: 0 }, logLevel: 'error',
    inPlace: false, tempDirName: '.stryker-tmp', cleanTempDir: 'always',
    mutator: { excludedMutations: allMutators.map(m => m.name).filter(name => name !== 'EqualityOperator') }
  };
  const fingerprint = (report, mutant) => ({ file: sourceFile, sourceSha256LF: hashLF(report.files[sourceFile].source),
    location: mutant.location, mutatorName: mutant.mutatorName, replacement: mutant.replacement });
  const targetOf = report => {
    const mutants = report.files[sourceFile]?.mutants ?? [];
    const executedScope = mutants.filter(m => m.status !== 'Ignored');
    check(executedScope.length === 3 && executedScope.every(m => m.mutatorName === 'EqualityOperator'
      && m.location.start.line === 6 && m.location.end.line === 6), 'Expected exactly3 selected line6 EqualityOperator mutants; excluded-mutator Ignored records remain raw.');
    const matches = mutants.filter(m => m.mutatorName === 'EqualityOperator' && m.replacement === 'normalized.length >= 500');
    check(matches.length === 1, 'Expected exactly one500-character boundary mutant.');
    return matches[0];
  };
  const testsFor = (raw, ids) => Object.entries(raw.testFiles ?? {}).flatMap(([file, entry]) => (entry.tests ?? [])
    .filter(test => ids?.includes(test.id)).map(test => ({ file, ...test })));
  let createdCandidate = false, createdUnit = false, createdConfig = false;
  try {
    await run('published-version', [cli, '--version']);
    writeFileSync(path.join(root, unitFile), `import unit from './vitest.unit.config.mts';\nexport default {...unit, test: {...unit.test, include: [${JSON.stringify(existingTest)}], maxWorkers: 1, fileParallelism: false}};\n`); createdUnit = true;
    writeFileSync(path.join(root, configFile), JSON.stringify(config, null, 2)); createdConfig = true;
    writeFileSync(path.join(out, 'effective-stryker.config.json'), JSON.stringify(config, null, 2));
    writeFileSync(path.join(out, 'effective-unit.before.mts'), readFileSync(path.join(root, unitFile)));
    await run('engine-selection-baseline', [vitest, 'run', '--config', unitFile, '--maxWorkers=1', '--reporter=json', `--outputFile=${path.join(out, 'engine-selection-baseline.tests.json')}`]);
    const beforePath = path.join(out, 'before.raw.json');
    const request = { root, config: { ...config, jsonReporter: { fileName: beforePath } } };
    const requestPath = path.join(out, 'direct-request.json'); writeFileSync(requestPath, JSON.stringify(request, null, 2));
    await run('direct-before', [fileURLToPath(import.meta.url), '--engine', requestPath]);
    const before = JSON.parse(readFileSync(beforePath, 'utf8')), target = targetOf(before), identity = fingerprint(before, target);
    check(target.status === 'Survived' && target.testsCompleted > 0 && target.coveredBy?.length > 0, 'No executed boundary survivor was reproduced.');
    check(identity.sourceSha256LF === hashLF(source), 'Instrumented report source does not match current source.');
    check(isDeepStrictEqual(target.location, { end: { column: 59, line: 6 }, start: { column: 36, line: 6 } }), 'Unexpected boundary source span.');
    const review = JSON.parse(await run('analyze', [cli, 'analyze', '--from', beforePath, '--runner', 'vitest', '--report-dir', path.join(out, 'review'), '--json']));
    const candidateBytes = readFileSync(path.join(here, 'address-boundary.test.ts'));
    mkdirSync(path.dirname(path.join(root, candidateFile)), { recursive: true });
    writeFileSync(path.join(root, candidateFile), candidateBytes); createdCandidate = true;
    const withCandidate = await normal('candidate-on-original', true, 5);
    const offset = pos => { let at = 0; for (let line = 1; line < pos.line; line++) { at = source.indexOf('\n', at) + 1; check(at > 0, 'Invalid location.'); } return at + pos.column - 1; };
    const start = offset(target.location.start), end = offset(target.location.end);
    check(source.slice(start, end) === 'normalized.length > 500', 'Replacement interval did not select the boundary expression.');
    const mutated = source.slice(0, start) + target.replacement + source.slice(end);
    let existingOnMutant, candidateOnMutant;
    try {
      writeFileSync(sourcePath, mutated);
      existingOnMutant = await normal('manual-mutant-existing', false, 3);
      candidateOnMutant = await normal('manual-mutant-candidate', true, 4, 1);
      const failures = candidateOnMutant.testResults.flatMap(f => f.assertionResults.filter(t => t.status === 'failed').map(t => ({ file: path.relative(root, f.name).replaceAll('\\', '/'), ...t })));
      check(failures.length === 1 && failures[0].file === candidateFile && failures[0].fullName.includes('accepts exactly 500')
        && failures[0].failureMessages.some(message => message.includes('AssertionError') && message.includes('not throw') && message.includes('Invalid address')), 'Failure must be the chosen public-behavior assertion, not infrastructure.');
      writeFileSync(path.join(out, 'manual-mutant.json'), JSON.stringify({ fingerprint: identity, originalExpression: source.slice(start, end), mutatedSourceSha256: sha(mutated), failures }, null, 2));
    } finally { writeFileSync(sourcePath, sourceBytes); }
    writeFileSync(path.join(root, unitFile), `import unit from './vitest.unit.config.mts';\nexport default {...unit, test: {...unit.test, include: [${JSON.stringify(existingTest)}, ${JSON.stringify(candidateFile)}], maxWorkers: 1, fileParallelism: false}};\n`);
    writeFileSync(path.join(out, 'effective-unit.after.mts'), readFileSync(path.join(root, unitFile)));
    const verifications = [];
    for (const label of ['verify', 'verify-repeat']) {
      const verification = JSON.parse(await run(label, [cli, 'verify', '--from', beforePath, '--file', sourceFile,
        '--mutant', target.id, '--test', candidateFile, '--runner', 'vitest', '--report-dir', path.join(out, label), '--budget', '120', '--json']));
      check(verification.status === 'verified' && verification.execution.exitCode === 0 && !verification.execution.budgetExceeded, 'Published2.1.4 did not verify the candidate.');
      const raw = JSON.parse(readFileSync(path.join(verification.paths.directory, 'mutation.json'), 'utf8')), after = targetOf(raw);
      check(after.status === 'Killed' && after.testsCompleted > 0 && isDeepStrictEqual(fingerprint(raw, after), identity), 'Target status/source/position/replacement mismatch.');
      const killers = testsFor(raw, after.killedBy);
      check(killers.some(t => t.file === candidateFile && t.name.includes('accepts exactly 500'))
        && after.statusReason?.includes('not throw') && after.statusReason.includes('Invalid address'), 'No selected-candidate behavioral assertion kill.');
      const portablePath = path.join(out, `${label}.raw.json`); writeFileSync(portablePath, JSON.stringify(raw, null, 2));
      verifications.push({ label, evidence: verification, rawReport: portablePath, fingerprint: fingerprint(raw, after), mutant: after, killers });
    }
    writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ observedAt: new Date().toISOString(), project: 'Thang4869/TriAD-Backend', issue: 'https://github.com/Thang4869/TriAD-Backend/issues/145',
      projectSha: expectedHead, node: process.version, platform: process.platform, versions, sourceFile, sourceSha256: sha(sourceBytes), sourceSha256LF: hashLF(source), projectLockSha256: protectedHashes['package-lock.json'],
      toolLockSha256: sha(readFileSync(path.join(tools, 'pnpm-lock.yaml'))), baseline, effectiveConfig: config,
      engineResolution: { projectEnginePresent: false, isolatedEngine: engineEntry, runnerPlugin: config.plugins[0], projectVitest: vitest, originalAlias: '@shared/* -> src/shared/*', globalSetup: null, buildCommand: null, related: false },
      fingerprint: identity, before: target, beforeOtherMutants: before.files[sourceFile].mutants.filter(m => m.id !== target.id), coveredBy: testsFor(before, target.coveredBy), review: { status: review.status, rawSummary: review.rawSummary, groups: review.groups.length },
      candidate: { file: candidateFile, sha256: sha(candidateBytes), passedOriginal: true, passedOriginalCount: withCandidate.numPassedTests, failedManualMutant: true }, verifications, steps, protectedHashes,
      independentTrial: false, userValidatedBenefit: false, repeatUse: false,
      limits: ['Our own current-SHA controlled pilot, not independent adoption.', 'Existing previously demonstrated boundary gap, not a new discovery.', 'Three selected EqualityOperator mutants on one line plus five raw Ignored records from explicitly excluded mutators; not repository score or current PR quality gate.', 'No integration/PostgreSQL/Redis/runtime-app claim.', 'Normal source baseline was run twice; verify-repeat here is technical repeatability, not user reuse.', 'No runtime speedup comparison.'] }, null, 2));
  } finally {
    writeFileSync(sourcePath, sourceBytes);
    if (createdCandidate) unlinkSync(path.join(root, candidateFile));
    if (createdUnit) unlinkSync(path.join(root, unitFile));
    if (createdConfig) unlinkSync(path.join(root, configFile));
    const unchanged = Object.fromEntries(protectedFiles.map(file => [file, sha(readFileSync(path.join(root, file))) === protectedHashes[file]]));
    writeFileSync(path.join(out, 'cleanup.json'), JSON.stringify({ protectedFilesUnchanged: unchanged, trackedStatus: git(['status', '--porcelain', '--untracked-files=no']), candidateRemoved: !existsSync(path.join(root, candidateFile)), configRemoved: !existsSync(path.join(root, configFile)), unitRemoved: !existsSync(path.join(root, unitFile)) }, null, 2));
    savedSteps();
    check(Object.values(unchanged).every(Boolean) && git(['status', '--porcelain', '--untracked-files=no']) === '', 'A protected project file changed.');
  }
  console.log(JSON.stringify({ status: 'verified', before: 'Survived', after: ['Killed', 'Killed'], candidateOnOriginal: 5, manualMutantFailures: 1, evidence: path.join(out, 'evidence.json'), independentTrial: false }));
}
