import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[2] === '--engine') {
  const request = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  process.chdir(request.cwd);
  const require = createRequire(path.join(request.cwd, 'package.json'));
  const { Stryker } = await import(pathToFileURL(require.resolve('@stryker-mutator/core')));
  await new Stryker(request.config).runMutationTest();
} else {
  await prove();
}

async function prove() {
  const repo = path.resolve(process.argv[2] ?? 'project');
  const cwd = path.join(repo, 'packages/vimsplain');
  const out = path.resolve(process.argv[3] ?? path.join(repo, '..', 'vimgym-pilot-results'));
  const sourceFile = 'src/handlers/command.ts';
  const candidate = 'tests/tautest-ex-command-whitespace.test.ts';
  const candidatePath = path.join(cwd, candidate);
  const configPath = path.join(cwd, 'stryker.config.json');
  const cli = path.join(here, 'node_modules/tautest/dist/index.js');
  const head = 'e65d98ca48f6432779b6bf2cb677d1a9116400d8';
  const base = '2aca9c37c6a6cc9997af16c1cd48ac365f5f8307';
  const sha = value => createHash('sha256').update(value).digest('hex');
  const normalizedHash = value => sha(value.replace(/\r\n/g, '\n'));
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
  const fail = message => { throw new Error(message); };
  const check = (condition, message) => { if (!condition) fail(message); };
  check(process.versions.node.split('.')[0] === '22', 'This recorded pilot requires Node 22.');
  check(git(['rev-parse', 'HEAD']).trim() === head, 'Unexpected project SHA.');
  check(git(['status', '--porcelain', '--untracked-files=no']).trim() === '', 'Use a clean disposable clone.');
  check(!existsSync(candidatePath), 'Refusing to overwrite an existing test.');
  check(!existsSync(out), 'Choose a new output directory; evidence will not be overwritten.');
  const version = file => JSON.parse(readFileSync(file, 'utf8')).version;
  check(version(path.join(here, 'node_modules/tautest/package.json')) === '2.1.3', 'Install the pilot tool lockfile first.');
  const installed = Object.fromEntries(['vitest', '@stryker-mutator/core', '@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker']
    .map(name => [name, version(path.join(cwd, 'node_modules', name, 'package.json'))]));
  check(installed.vitest === '4.1.11' && Object.entries(installed).filter(([n]) => n !== 'vitest').every(([,v]) => v === '10.0.0'), 'Unexpected engine/runner versions.');
  mkdirSync(out, { recursive: true });
  const sourceBytes = readFileSync(path.join(cwd, sourceFile));
  const originalConfig = readFileSync(configPath);
  const steps = [];
  function run(label, args, expected = 0) {
    const started = Date.now();
    const r = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 240000, maxBuffer: 16e6, windowsHide: true });
    writeFileSync(path.join(out, label + '.stdout.txt'), r.stdout ?? '');
    writeFileSync(path.join(out, label + '.stderr.txt'), r.stderr ?? '');
    steps.push({ label, command: ['node', ...args], cwd, exitCode: r.status, elapsedMs: Date.now() - started, error: r.error?.message });
    console.log(`${label}: exit ${r.status}`);
    check(!r.error && r.status === expected, `${label} failed; inspect its logs. No behavioral claim is made.`);
    return r.stdout;
  }
  function normal(label, count) {
    const file = path.join(out, label + '.tests.json');
    run(label, [path.join(cwd, 'node_modules/vitest/vitest.mjs'), 'run', '--maxWorkers=1', '--reporter=json', `--outputFile=${file}`]);
    const result = JSON.parse(readFileSync(file, 'utf8'));
    check(result.success && result.numPassedTests === count && result.numFailedTests === 0, 'Unexpected baseline test result.');
    return result;
  }
  const sourceHash = normalizedHash(sourceBytes.toString('utf8'));
  const fingerprint = (report, mutant) => ({ file: sourceFile, sourceSha256LF: normalizedHash(report.files[sourceFile].source),
    start: { line: mutant.location.start.line, column: mutant.location.start.column },
    end: { line: mutant.location.end.line, column: mutant.location.end.column },
    mutatorName: mutant.mutatorName, replacement: mutant.replacement });
  const mutantOf = report => {
    const mutants = Object.values(report.files).flatMap(file => file.mutants);
    check(mutants.length === 1, 'Expected exactly one mutant, not a broad campaign.');
    return mutants[0];
  };
  run('published-version', [cli, '--version']);
  const baseline = normal('baseline', 372);
  const diff = execFileSync('git', ['diff', '--relative', '--unified=0', base, '--', 'src'], { cwd, encoding: 'utf8' });
  writeFileSync(path.join(out, 'real-source-diff.patch'), diff);
  const plannerConfig = path.join(out, 'tautest.planner.json');
  writeFileSync(plannerConfig, JSON.stringify({ rangeCoalesceGap: 0 }));
  const plan = JSON.parse(run('real-diff-plan', [cli, 'run', '--base', base, '--config', plannerConfig, '--dry-run', '--json']));
  writeFileSync(path.join(out, 'plan.json'), JSON.stringify(plan, null, 2));
  // The whitespace survivor predates this real diff: it is explicitly a report
  // review target, NOT a claimed changed-line finding from this planner run.
  const require = createRequire(path.join(cwd, 'package.json'));
  const engineRequire = createRequire(require.resolve('@stryker-mutator/core'));
  const instrumenter = engineRequire.resolve('@stryker-mutator/instrumenter');
  const { allMutators } = await import(new URL('./mutators/mutate.js', pathToFileURL(instrumenter)));
  const local = { ...JSON.parse(originalConfig), concurrency: 1, incremental: false,
    coverageAnalysis: 'perTest', logLevel: 'error', cleanTempDir: 'always',
    mutator: { excludedMutations: allMutators.map(m => m.name).filter(n => n !== 'MethodExpression') } };
  const beforePath = path.join(out, 'before.mutation.json');
  const request = { cwd, config: { configFile: 'stryker.config.json', mutate: [`${sourceFile}:22-22`],
    reporters: ['json'], jsonReporter: { fileName: beforePath } } };
  let createdCandidate = false;
  try {
    writeFileSync(configPath, JSON.stringify(local, null, 2) + '\n');
    writeFileSync(path.join(out, 'local-stryker-config.json'), JSON.stringify(local, null, 2));
    const requestPath = path.join(out, 'direct-request.json');
    writeFileSync(requestPath, JSON.stringify(request));
    run('before', [fileURLToPath(import.meta.url), '--engine', requestPath]);
    const before = JSON.parse(readFileSync(beforePath, 'utf8'));
    const target = mutantOf(before);
    const identity = fingerprint(before, target);
    check(identity.sourceSha256LF === sourceHash && target.mutatorName === 'MethodExpression' && target.replacement === 'cmd'
      && target.location.start.line === 22 && target.status === 'Survived' && target.testsCompleted > 0 && target.coveredBy?.length > 0,
      'The expected executed whitespace survivor was not reproduced.');
    run('analyze', [cli, 'analyze', '--from', beforePath, '--runner', 'vitest', '--report-dir', path.join(out, 'review'), '--json']);
    writeFileSync(candidatePath, readFileSync(path.join(here, 'ex-command-whitespace.test.ts')));
    createdCandidate = true;
    normal('with-candidate', 373);
    const verifications = [];
    for (const label of ['verify', 'verify-repeat']) {
      const evidence = JSON.parse(run(label, [cli, 'verify', '--from', beforePath, '--file', sourceFile, '--mutant', target.id,
        '--test', candidate, '--runner', 'vitest', '--report-dir', path.join(out, label), '--budget', '180', '--json']));
      const raw = JSON.parse(readFileSync(path.join(evidence.paths.directory, 'mutation.json'), 'utf8'));
      const after = mutantOf(raw);
      const killers = Object.entries(raw.testFiles ?? {}).flatMap(([file, entry]) => (entry.tests ?? [])
        .filter(t => after.killedBy?.includes(t.id)).map(t => ({ file, ...t })));
      check(evidence.status === 'verified' && after.status === 'Killed' && after.testsCompleted > 0
        && JSON.stringify(fingerprint(raw, after)) === JSON.stringify(identity), 'Exact target did not verify.');
      check(killers.some(t => t.file === candidate) && after.statusReason?.includes('write file'), 'No candidate behavioral assertion kill.');
      verifications.push({ label, status: evidence.status, fingerprint: fingerprint(raw, after), mutant: after, killers, evidence });
    }
    const result = { checkedAt: new Date().toISOString(), repo: 'https://github.com/oller/vimgym', issue: 'https://github.com/oller/vimgym/issues/35',
      head, base, node: process.version, packageManager: JSON.parse(readFileSync(path.join(repo, 'package.json'))).packageManager,
      lockfileSha256: sha(readFileSync(path.join(repo, 'pnpm-lock.yaml'))), toolLockfileSha256: sha(readFileSync(path.join(here, 'package-lock.json'))),
      tautest: '2.1.3', installed, sourceBytesSha256: sha(sourceBytes), sourceSha256LF: sourceHash,
      sourceUnchanged: readFileSync(path.join(cwd, sourceFile)).equals(sourceBytes),
      baseline: { passed: baseline.numPassedTests, files: baseline.testResults.map(f => ({ file: path.relative(cwd, f.name).replaceAll('\\', '/'), tests: f.assertionResults.map(t => t.fullName) })) },
      candidate: { file: candidate, sha256: sha(readFileSync(candidatePath)), passedOriginal: true, totalTests: 373 },
      fingerprint: identity, before: target, verifications, steps, independentAdoption: false,
      limits: ['Existing dashboard survivor, not a new discovery.', 'Trim22 is outside the real recent source diff.',
        'Stryker generates mutants; Tautest contribution is report explanation and exact-candidate verification.',
        'Temporary single-worker/MethodExpression-only Stryker config; original restored afterwards.',
        'No full-repo mutation score, speedup or independent use claim.'] };
    writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'verified', baseline: 372, withCandidate: 373, before: target.status, after: verifications.map(v => v.mutant.status), fingerprint: identity }));
  } finally {
    writeFileSync(configPath, originalConfig);
    if (createdCandidate) unlinkSync(candidatePath);
    check(readFileSync(path.join(cwd, sourceFile)).equals(sourceBytes), 'Production source changed.');
    writeFileSync(path.join(out, 'steps.json'), JSON.stringify(steps, null, 2));
  }
  check(git(['status', '--porcelain', '--untracked-files=no']).trim() === '', 'Tracked project files changed.');
}
