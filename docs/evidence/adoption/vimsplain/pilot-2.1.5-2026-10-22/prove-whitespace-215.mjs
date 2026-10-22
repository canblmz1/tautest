import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, realpathSync } from 'node:fs';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[2] === '--engine') {
  const request = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  process.chdir(request.cwd);
  const require = createRequire(path.join(request.cwd, 'package.json'));
  const { Stryker } = await import(pathToFileURL(require.resolve('@stryker-mutator/core')).href);
  await new Stryker(request.config).runMutationTest();
} else {
  await prove();
}

async function prove() {
  const repo = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
  const baseline = JSON.parse(readFileSync(path.resolve(process.argv[4]), 'utf8'));
  const cwd = path.join(repo, 'packages/vimsplain');
  const sourceFile = 'src/handlers/command.ts', candidateFile = 'tests/tautest-ex-command-whitespace.test.ts';
  const sourcePath = path.join(cwd, sourceFile), configPath = path.join(cwd, 'stryker.config.json');
  const cli = path.join(here, 'tools/node_modules/tautest/dist/index.js');
  const vitest = path.join(cwd, 'node_modules/vitest/vitest.mjs');
  const head = 'e65d98ca48f6432779b6bf2cb677d1a9116400d8';
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const hashLF = text => sha(text.replace(/\r\n/g, '\n'));
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const version = file => JSON.parse(readFileSync(file, 'utf8')).version;
  check(process.versions.node.startsWith('22.'), 'Use Node22.');
  check(git(['rev-parse', 'HEAD']) === head && !git(['status', '--porcelain', '--untracked-files=no']), 'Use a clean pinned disposable clone.');
  check(!existsSync(out) && !existsSync(path.join(cwd, candidateFile)), 'Do not overwrite output or an existing candidate.');
  const sourceBytes = readFileSync(sourcePath), source = sourceBytes.toString('utf8'), originalConfig = readFileSync(configPath);
  check(baseline.projectSha === head && baseline.sourceSha256 === sha(sourceBytes) && baseline.records.length === 2
    && baseline.records.every(r => r.exitCode === 0 && r.passed === 372 && r.failed === 0), 'First obtain two passing original-package baselines.');
  for (const [file, hash] of Object.entries(baseline.files)) check(sha(readFileSync(path.join(repo, file))) === hash, `Baseline file changed: ${file}`);
  const installed = Object.fromEntries(['vitest', '@stryker-mutator/core', '@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker', 'typescript']
    .map(name => [name, version(path.join(cwd, 'node_modules', name, 'package.json'))]));
  check(installed.vitest === '4.1.11' && installed['@stryker-mutator/core'] === '10.0.0' && installed['@stryker-mutator/vitest-runner'] === '10.0.0'
    && installed['@stryker-mutator/typescript-checker'] === '10.0.0', 'Keep the project lockfile versions.');
  const realCli = realpathSync(cli), cliVersion = version(path.join(here, 'tools/node_modules/tautest/package.json'));
  const coreManifest = path.resolve(path.dirname(realCli), '../../@tautest/core/package.json');
  const coreVersion = version(coreManifest);
  check(cliVersion === '2.1.5' && coreVersion === '2.1.5' && realCli.includes('tautest@2.1.5'), 'Use the published2.1.5 registry toolchain, not historical2.1.3 or a candidate build.');
  mkdirSync(out, { recursive: true });
  const steps = [], saveSteps = () => writeFileSync(path.join(out, 'steps.json'), JSON.stringify(steps, null, 2));
  async function run(label, args, expected = 0) {
    const startedAt = new Date().toISOString(), start = performance.now();
    let stdout = '', stderr = '', timedOut = false, error;
    const child = spawn(process.execPath, args, { cwd, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const killOwnTree = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { timeout: 10000, windowsHide: true });
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    };
    const timer = setTimeout(() => { timedOut = true; killOwnTree(); }, 240000);
    child.stdout.on('data', bytes => { stdout += bytes.toString(); if (stdout.length > 32e6) { error = 'stdout limit'; killOwnTree(); } });
    child.stderr.on('data', bytes => { stderr += bytes.toString(); if (stderr.length > 32e6) { error = 'stderr limit'; killOwnTree(); } });
    const result = await new Promise(resolve => { child.on('error', e => { error = e.message; }); child.on('close', (exitCode, signal) => resolve({ exitCode, signal })); });
    clearTimeout(timer); writeFileSync(path.join(out, `${label}.stdout.log`), stdout); writeFileSync(path.join(out, `${label}.stderr.log`), stderr);
    steps.push({ label, startedAt, elapsedMs: Math.round(performance.now() - start), command: { file: process.execPath, args, cwd }, ...result, timedOut, error: error ?? null });
    saveSteps(); console.log(JSON.stringify(steps.at(-1)));
    check(!timedOut && !error && result.exitCode === expected, `${label} failed; no behavioral kill/success is claimed.`);
    return stdout;
  }
  async function normal(label, expectedPassed, expectedFailed = 0) {
    const testOutput = path.join(out, `${label}.tests.json`);
    await run(label, [vitest, 'run', '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${testOutput}`], expectedFailed ? 1 : 0);
    const result = JSON.parse(readFileSync(testOutput, 'utf8'));
    check(result.numPassedTests === expectedPassed && result.numFailedTests === expectedFailed, `${label}: unexpected executed-test counts.`);
    return result;
  }
  const require = createRequire(path.join(cwd, 'package.json'));
  const projectEngine = require.resolve('@stryker-mutator/core');
  const engineRequire = createRequire(projectEngine), instrumenter = engineRequire.resolve('@stryker-mutator/instrumenter');
  const { allMutators } = await import(new URL('./mutators/mutate.js', pathToFileURL(instrumenter)).href);
  const local = { ...JSON.parse(originalConfig), concurrency: 1, incremental: false, coverageAnalysis: 'perTest', logLevel: 'error', cleanTempDir: 'always',
    mutator: { excludedMutations: allMutators.map(m => m.name).filter(name => name !== 'MethodExpression') } };
  const identity = (report, mutant) => ({ file: sourceFile, sourceSha256LF: hashLF(report.files[sourceFile].source), location: mutant.location, mutatorName: mutant.mutatorName, replacement: mutant.replacement });
  const targetOf = report => {
    const all = Object.values(report.files).flatMap(file => file.mutants), selected = all.filter(m => m.status !== 'Ignored');
    check(selected.length === 1 && selected[0].mutatorName === 'MethodExpression' && selected[0].location.start.line === 22 && selected[0].location.end.line === 22,
      'This experiment permits one selected line22 MethodExpression mutant only.');
    return selected[0];
  };
  const testsFor = (report, ids) => Object.entries(report.testFiles ?? {}).flatMap(([file, entry]) => (entry.tests ?? []).filter(t => ids?.includes(t.id)).map(t => ({ file, ...t })));
  let createdCandidate = false;
  try {
    const observedVersion = (await run('published-version', [cli, '--version'])).trim();
    check(observedVersion === '2.1.5', 'Actual CLI version is not2.1.5.');
    writeFileSync(configPath, JSON.stringify(local, null, 2));
    writeFileSync(path.join(out, 'local-stryker.config.json'), JSON.stringify(local, null, 2));
    const beforePath = path.join(out, 'before.raw.json'), request = { cwd, config: { configFile: 'stryker.config.json', mutate: [`${sourceFile}:22-22`], reporters: ['json'], jsonReporter: { fileName: beforePath } } };
    const requestPath = path.join(out, 'direct-request.json'); writeFileSync(requestPath, JSON.stringify(request, null, 2));
    await run('direct-before', [fileURLToPath(import.meta.url), '--engine', requestPath]);
    const before = JSON.parse(readFileSync(beforePath, 'utf8')), target = targetOf(before), fingerprint = identity(before, target);
    check(target.status === 'Survived' && target.testsCompleted > 0 && target.coveredBy?.length > 0 && target.replacement === 'cmd'
      && fingerprint.sourceSha256LF === hashLF(source), 'No executed matching whitespace survivor.');
    check(isDeepStrictEqual(target.location, { end: { column: 29, line: 22 }, start: { column: 19, line: 22 } }), 'Unexpected exact source interval.');
    const review = JSON.parse(await run('analyze', [cli, 'analyze', '--from', beforePath, '--runner', 'vitest', '--report-dir', path.join(out, 'review'), '--json']));
    const candidateBytes = readFileSync(path.join(here, 'ex-command-whitespace.test.ts'));
    writeFileSync(path.join(cwd, candidateFile), candidateBytes); createdCandidate = true;
    await normal('candidate-on-original', 373);
    const offset = p => { let at = 0; for (let line = 1; line < p.line; line++) { at = source.indexOf('\n', at) + 1; check(at > 0, 'Invalid location.'); } return at + p.column - 1; };
    const start = offset(target.location.start), end = offset(target.location.end);
    check(source.slice(start, end) === 'cmd.trim()', 'The replacement interval is not the original public command normalization.');
    const mutated = source.slice(0, start) + target.replacement + source.slice(end);
    let failures;
    try {
      // The candidate is temporarily absent for the existing-suite manual-mutant control.
      unlinkSync(path.join(cwd, candidateFile)); createdCandidate = false;
      writeFileSync(sourcePath, mutated);
      await normal('manual-mutant-existing', 372);
      writeFileSync(path.join(cwd, candidateFile), candidateBytes); createdCandidate = true;
      const result = await normal('manual-mutant-candidate', 372, 1);
      failures = result.testResults.flatMap(file => file.assertionResults.filter(t => t.status === 'failed').map(t => ({ file: path.relative(cwd, file.name).replaceAll('\\', '/'), ...t })));
      check(failures.length === 1 && failures[0].file === candidateFile && failures[0].fullName.includes('whitespace-padded')
        && failures[0].failureMessages.some(text => text.includes('AssertionError') && text.includes('write file') && text.includes('run ex command')), 'The candidate must fail through the expected behavior assertion.');
      writeFileSync(path.join(out, 'manual-mutant.json'), JSON.stringify({ fingerprint, originalExpression: source.slice(start, end), mutatedSourceSha256: sha(mutated), failures }, null, 2));
    } finally { writeFileSync(sourcePath, sourceBytes); }
    const verifications = [];
    for (const label of ['verify', 'verify-repeat']) {
      const evidence = JSON.parse(await run(label, [cli, 'verify', '--from', beforePath, '--file', sourceFile, '--mutant', target.id,
        '--test', candidateFile, '--runner', 'vitest', '--report-dir', path.join(out, label), '--budget', '180', '--json']));
      check(evidence.status === 'verified' && evidence.execution.exitCode === 0 && !evidence.execution.budgetExceeded, 'Published2.1.5 did not verify the exact target.');
      const raw = JSON.parse(readFileSync(path.join(evidence.paths.directory, 'mutation.json'), 'utf8')), after = targetOf(raw), killers = testsFor(raw, after.killedBy);
      check(after.status === 'Killed' && after.testsCompleted > 0 && isDeepStrictEqual(identity(raw, after), fingerprint), 'Source/location/mutator/replacement mismatch.');
      check(killers.some(t => t.file === candidateFile && t.name.includes('whitespace-padded')) && after.statusReason?.includes('write file') && after.statusReason.includes('run ex command'), 'No named candidate behavioral assertion kill.');
      writeFileSync(path.join(out, `${label}.raw.json`), JSON.stringify(raw, null, 2));
      verifications.push({ label, evidence, fingerprint: identity(raw, after), mutant: after, killers });
    }
    const packageMetadata = {};
    for (const name of ['tautest', '@tautest/core']) {
      const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/2.1.5`, response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      check(response.ok, `Registry metadata unavailable for ${name}.`); const metadata = await response.json(); check(metadata.version === '2.1.5', 'Registry version mismatch.');
      const integrityMatchesToolLock = readFileSync(path.join(here, 'tools/pnpm-lock.yaml'), 'utf8').includes(metadata.dist.integrity);
      check(integrityMatchesToolLock, 'Registry integrity does not match the installed tool lockfile.');
      packageMetadata[name] = { url, queriedAt: new Date().toISOString(), version: metadata.version, dist: metadata.dist, integrityMatchesToolLock };
    }
    writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ observedAt: new Date().toISOString(), project: 'oller/vimgym', issue: 'https://github.com/oller/vimgym/issues/35', projectSha: head,
      node: process.version, platform: process.platform, projectPackageManager: 'pnpm@10.34.6', toolPackageManager: 'pnpm@10.33.1', baseline, cliVersion, coreVersion, cliPath: cli, realCliPath: realCli, cliSha256: sha(readFileSync(realCli)), coreManifest, installed,
      projectLockSha256: sha(readFileSync(path.join(repo, 'pnpm-lock.yaml'))), toolLockSha256: sha(readFileSync(path.join(here, 'tools/pnpm-lock.yaml'))), packageMetadata,
      engineResolution: { projectEngine, projectRunner: require.resolve('@stryker-mutator/vitest-runner'), projectChecker: require.resolve('@stryker-mutator/typescript-checker'), configFile: 'stryker.config.json', vitestConfig: 'vitest.config.ts', related: 'project default (not overridden)', globalSetup: null, buildCommand: null, importedSource: '../src/index.js -> src/handlers/command.ts', usesDist: false },
      fingerprint, before: target, coveredBy: testsFor(before, target.coveredBy), review: { status: review.status, rawSummary: review.rawSummary, groups: review.groups.length }, candidate: { file: candidateFile, sha256: sha(candidateBytes), originalPassed: 373, existingOnManualMutantPassed: 372, withCandidateOnManualMutant: { passed: 372, failed: 1, failures } },
      verifications, steps, independentTrial: false, userValidatedBenefit: false, repeatUse: false,
      limits: ['Published CLI/core2.1.5 and project Stryker10; historical2.1.3 assets unchanged.', 'Existing baseline report debt, not a new finding on an active source-changing PR.', 'One selected MethodExpression on line22; not a repository score or quality gate.', 'No root app, Supabase, general monorepo, dependency-upgrade or performance claim.', 'verify-repeat is our technical repeatability, not user reuse.'] }, null, 2));
  } finally {
    writeFileSync(sourcePath, sourceBytes); writeFileSync(configPath, originalConfig);
    if (createdCandidate) unlinkSync(path.join(cwd, candidateFile));
    const protectedFilesUnchanged = Object.fromEntries(Object.entries(baseline.files).map(([file, hash]) => [file, sha(readFileSync(path.join(repo, file))) === hash]));
    const trackedStatus = git(['status', '--porcelain', '--untracked-files=no']);
    writeFileSync(path.join(out, 'cleanup.json'), JSON.stringify({ protectedFilesUnchanged, trackedStatus, candidateRemoved: !existsSync(path.join(cwd, candidateFile)) }, null, 2)); saveSteps();
    check(Object.values(protectedFilesUnchanged).every(Boolean) && !trackedStatus, 'An original project file changed.');
  }
  console.log(JSON.stringify({ status: 'verified', baseline: [372, 372], candidateOnOriginal: 373, manualMutantExisting: 372,
    manualMutantWithCandidate: { passed: 372, failed: 1 }, before: 'Survived', after: ['Killed', 'Killed'], cli: cliVersion, core: coreVersion, independentTrial: false }));
}
