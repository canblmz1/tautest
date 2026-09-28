#!/usr/bin/env node
// Runs one frozen external-PR corpus entry: clones a real repo at an exact PR head SHA,
// runs its normal test suite, installs a frozen published Tautest version into that project,
// and compares it with direct Stryker using the exact config recorded in Tautest's raw report.
// This keeps both tools on the project's own runner stack; the checkout's local CLI is not used.
// Prints a JSON result row; never edits or pushes to the source repo.
//
//   node scripts/oss-adoption-corpus-run.mjs --repo=https://github.com/unjs/ohash.git \
//     --pr=196 --base=2c6e231ccfc229ab90a3e026635984f1ccd89b1d --head=a65d622c4c390061baf408b0ecdf4d5031753c69 \
//     --runner=vitest --package-manager=pnpm --tautest-version=2.0.2 [--build] [--repeat=2]
//
// --build runs `<package-manager> run build` (the repo's own build script AT THAT COMMIT, via its
// locally installed toolchain). Do not pass a specific build tool name: a repo's build tool can
// change between commits (ohash moved from unbuild to obuild), and `npx <tool>` ignores the
// commit's own devDependency version and fetches latest from the registry instead, which broke a
// real corpus run against an older ohash PR (obuild's newest release no longer matched that
// commit's config shape).
//
// This is a research/validation tool for docs/oss-adoption-corpus.md (90-day OSS adoption plan,
// Sprint 2). It never cherry-picks: run it, then record whatever it reports, including failures.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compareMutantReports } from './oss-adoption-corpus-compare.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));

for (const required of ['repo', 'base', 'head', 'runner', 'package-manager', 'tautest-version']) {
  if (!args[required]) {
    fail(`missing --${required}`);
  }
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(args['tautest-version'])) {
  fail('--tautest-version must be an exact published version, not a range or latest');
}

if (!['pnpm', 'npm', 'yarn', 'bun'].includes(args['package-manager'])) {
  fail('--package-manager must be pnpm, npm, yarn, or bun');
}

const repetitions = Number(args.repeat ?? 1);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 5) {
  fail('--repeat must be an integer from 1 to 5');
}

const runnerPlugin = { vitest: '@stryker-mutator/vitest-runner', jest: '@stryker-mutator/jest-runner' }[args.runner];

if (!runnerPlugin) {
  fail(`unsupported --runner ${args.runner} (use vitest or jest)`);
}

const workDir = mkdtempSync(path.join(tmpdir(), 'tautest-corpus-'));
const result = { repo: args.repo, pr: args.pr ?? null, base: args.base, head: args.head, runner: args.runner, tautestVersion: args['tautest-version'], repetitions, workDir };
const stepFailures = [];

try {
  log(`Cloning ${args.repo} into ${workDir}`);
  git(workDir, ['clone', '--quiet', args.repo, '.']);

  if (args.pr) {
    git(workDir, ['fetch', '--quiet', 'origin', `refs/pull/${args.pr}/head`]);
  } else {
    git(workDir, ['fetch', '--quiet', 'origin', args.head]);
  }

  git(workDir, ['checkout', '--quiet', 'FETCH_HEAD']);

  // "Frozen" means this exact SHA, not whatever the PR ref currently points to (it can move if
  // someone pushes more commits). Refuse to silently measure a different commit than recorded.
  const checkedOutHead = git(workDir, ['rev-parse', 'HEAD']).trim();
  if (checkedOutHead !== args.head) {
    throw new Error(`--head ${args.head} does not match the checked-out commit ${checkedOutHead}. The PR ref may have moved; re-verify and update --head.`);
  }

  assertReachable(workDir, args.base);

  const pm = args['package-manager'];
  result.install = step('install', () => run(workDir, pm, ['install', ...(pm === 'pnpm' ? ['--no-frozen-lockfile'] : [])]));
  requireExit(result.install, 'install');

  if ('build' in args) {
    result.build = step('build', () => run(workDir, pm, ['run', 'build']));
    requireExit(result.build, 'build');
  }

  const toolSpecs = ['tautest@' + args['tautest-version'], '@stryker-mutator/core@10.0.0', runnerPlugin + '@10.0.0'];
  result.installTestTools = step('installTestTools', () => run(workDir, pm, devInstallArgs(workDir, pm, toolSpecs)));
  requireExit(result.installTestTools, 'installTestTools');
  const cliEntry = path.join(workDir, 'node_modules', 'tautest', 'dist', 'index.js');
  result.toolchain = inspectToolchain(workDir, cliEntry, runnerPlugin, args['tautest-version']);

  // Installing test tools (and sometimes the install or build step) rewrites tracked files such as
  // package.json and the lockfile, which Tautest would then measure as part of the PR diff.
  // Restore them so the tracked tree is exactly the PR head; node_modules keeps what was installed.
  result.setupModifiedTrackedFiles = gitLines(workDir, ['diff', '--name-only']);
  if (result.setupModifiedTrackedFiles.length > 0) {
    git(workDir, ['checkout', '--', ...result.setupModifiedTrackedFiles]);
  }
  if (gitLines(workDir, ['status', '--porcelain', '--untracked-files=no']).length > 0) {
    throw new Error('Tracked files still differ from the PR head after restoring setup changes; the measured diff would not be the PR diff.');
  }
  result.prChangedFiles = gitLines(workDir, ['diff', '--name-only', args.base, 'HEAD']);

  const normalTestCommand = args['normal-test-script']
    ? [pm, ['run', args['normal-test-script']]]
    : ['npx', ['--no-install', args.runner, ...(args.runner === 'vitest' ? ['run'] : ['--runInBand'])]];
  result.normalTests = step('normalTests', () => run(workDir, normalTestCommand[0], normalTestCommand[1]));
  requireExit(result.normalTests, 'normalTests');

  // Exit 1 is a valid measured threshold failure. Other nonzero exits are setup/run errors.
  result.tautest = step('tautest', () => run(workDir, 'node', [cliEntry, 'run', '--base', args.base, '--json']), [0, 1]);
  requireExit(result.tautest, 'tautest', [0, 1]);
  const tautestReport = JSON.parse(extractJson(result.tautest.stdout));
  const mutatePatterns = tautestReport.report?.scope?.mutatePatterns ?? [];
  result.tautestSummary = tautestReport.report?.summary;
  result.tautestChangedFileCount = tautestReport.metrics?.changedFileCount;
  result.mutatePatterns = mutatePatterns;

  if (mutatePatterns.length > 0) {
    const mutationPath = tautestReport.paths?.mutationJson ?? path.join(workDir, '.tautest', 'mutation.json');
    const tautestMutationReport = safeReadJson(mutationPath);
    if (!tautestMutationReport?.config) {
      throw new Error('Tautest returned a score without a readable raw Stryker report and config.');
    }
    if (tautestMutationReport.config.incremental || tautestMutationReport.config.inPlace) {
      throw new Error('This comparison requires sandboxed, non-incremental Stryker runs; shared cache or in-place mutations would confound the result.');
    }
    const directReportPath = path.join(workDir, 'stryker-direct-report.json');
    result.tautestMutationReportPath = path.join(workDir, '.tautest', 'corpus-run-1.json');
    copyFileSync(mutationPath, result.tautestMutationReportPath);
    // Use Stryker's own effective config from Tautest's report for behavior-affecting options.
    // Never write dashboard credentials into the retained comparison config; the JSON reporter
    // is the only reporter for this run. This is not a Stryker-default benchmark.
    const directConfig = { ...tautestMutationReport.config };
    delete directConfig.dashboard;
    writeFileSync(
      path.join(workDir, 'stryker.config.json'),
      JSON.stringify({
        ...directConfig,
        mutate: mutatePatterns,
        tempDirName: '.stryker-tmp/direct-corpus',
        reporters: ['json'],
        jsonReporter: { fileName: 'stryker-direct-report.json' }
      }, null, 2)
    );
    result.directStryker = step('directStryker', () => run(workDir, 'npx', ['--no-install', 'stryker', 'run', 'stryker.config.json']));
    requireExit(result.directStryker, 'directStryker');
    const directStrykerReport = safeReadJson(directReportPath);
    result.directStrykerReportPath = directReportPath;
    result.directStrykerSummary = summarizeMutationReport(directStrykerReport);
    result.comparison = compareMutantReports(tautestMutationReport, directStrykerReport);

    result.repeatability = [];
    for (let runNumber = 2; runNumber <= repetitions; runNumber++) {
      const repeatedTests = step(`normalTests${runNumber}`, () => run(workDir, normalTestCommand[0], normalTestCommand[1]));
      requireExit(repeatedTests, `normalTests${runNumber}`);
      const repeatedRun = step(`tautest${runNumber}`, () => run(workDir, 'node', [cliEntry, 'run', '--base', args.base, '--json']), [0, 1]);
      requireExit(repeatedRun, `tautest${runNumber}`, [0, 1]);
      const repeatedOutput = JSON.parse(extractJson(repeatedRun.stdout));
      const repeatedMutationPath = repeatedOutput.paths?.mutationJson ?? mutationPath;
      const repeatedReport = safeReadJson(repeatedMutationPath);
      const repeatedSnapshotPath = path.join(workDir, '.tautest', `corpus-run-${runNumber}.json`);
      copyFileSync(repeatedMutationPath, repeatedSnapshotPath);
      const repeatedPatterns = repeatedOutput.report?.scope?.mutatePatterns ?? [];
      result.repeatability.push({
        runNumber,
        mutationReportPath: repeatedSnapshotPath,
        normalTestsDurationMs: repeatedTests.durationMs,
        tautestDurationMs: repeatedRun.durationMs,
        summary: repeatedOutput.report?.summary,
        sameMutatePatterns: JSON.stringify(repeatedPatterns) === JSON.stringify(mutatePatterns),
        comparison: compareMutantReports(tautestMutationReport, repeatedReport)
      });
    }
  } else {
    result.directStryker = { skipped: 'no mutate patterns from Tautest run' };
  }

  result.stepFailures = stepFailures;
  // A clean pair is not necessarily repeatable; --repeat checks that separately.
  const unstable = result.repeatability?.some((repeat) => !repeat.sameMutatePatterns || !repeat.comparison.identical);
  result.status = unstable ? 'unstable' : result.comparison?.identical ? 'ok' : 'completed-with-differences';
} catch (error) {
  result.stepFailures = stepFailures;
  result.status = 'error';
  result.error = error instanceof Error ? error.message : String(error);
} finally {
  log(`Left the clone at ${workDir} for inspection; delete it manually when done.`);
  console.log(JSON.stringify(result, null, 2));

  // Automation that only checks the exit code (not the JSON body) must not read this as success.
  if (result.status !== 'ok') {
    process.exitCode = 1;
  }
}

function timed(fn) {
  const startedAt = Date.now();
  const outcome = fn();
  return { ...outcome, durationMs: Date.now() - startedAt };
}

// Runs a named step, timing it and recording a non-zero exit code as a step failure instead of
// silently letting the overall result read "ok". spawnSync never throws on a failing command, so
// without this a failed normal test run or failed build would otherwise go unnoticed.
function step(name, fn, acceptedExitCodes = [0]) {
  const outcome = timed(fn);
  if (!acceptedExitCodes.includes(outcome.exitCode)) {
    stepFailures.push({ step: name, exitCode: outcome.exitCode, command: outcome.command });
  }
  return outcome;
}

function requireExit(outcome, name, acceptedExitCodes = [0]) {
  if (!acceptedExitCodes.includes(outcome.exitCode)) {
    throw new Error(`${name} failed with exit ${outcome.exitCode}; refusing to produce a mutation comparison.`);
  }
}

function devInstallArgs(cwd, pm, specs) {
  if (pm === 'pnpm') {
    return ['add', '-D', ...(existsSync(path.join(cwd, 'pnpm-workspace.yaml')) ? ['-w'] : []), '--ignore-scripts', ...specs];
  }
  if (pm === 'npm') {
    return ['install', '--save-dev', '--ignore-scripts', ...specs];
  }
  return ['add', '--dev', ...specs];
}

function inspectToolchain(cwd, cliEntry, runnerPlugin, expectedVersion) {
  if (!existsSync(cliEntry)) {
    throw new Error(`Installed Tautest CLI is missing: ${cliEntry}`);
  }
  const cliPackage = readJson(path.join(cwd, 'node_modules', 'tautest', 'package.json'));
  const corePath = resolveDependencyPackage(cliEntry, '@tautest/core');
  const corePackage = readJson(corePath);
  const strykerPath = resolveDependencyPackage(corePath, '@stryker-mutator/core');
  const strykerPackage = readJson(strykerPath);
  const runnerPath = realpathSync(path.join(cwd, 'node_modules', runnerPlugin, 'package.json'));
  const runnerPackage = readJson(runnerPath);
  const testFrameworkPath = resolveDependencyPackage(runnerPath, args.runner);
  const testFramework = readJson(testFrameworkPath);
  const projectFrameworkPath = realpathSync(path.join(cwd, 'node_modules', args.runner, 'package.json'));
  const projectFramework = readJson(projectFrameworkPath);

  if (cliPackage.version !== expectedVersion || corePackage.version !== expectedVersion || cliPackage.dependencies?.['@tautest/core'] !== expectedVersion) {
    throw new Error(`Tautest/core version mismatch: requested ${expectedVersion}, CLI ${cliPackage.version}, CLI dependency ${cliPackage.dependencies?.['@tautest/core']}, resolved core ${corePackage.version}.`);
  }
  if (strykerPackage.version !== '10.0.0' || runnerPackage.version !== '10.0.0') {
    throw new Error(`Stryker/runner mismatch: expected 10.0.0, loaded ${strykerPackage.version}/${runnerPackage.version}.`);
  }
  if (testFramework.version !== projectFramework.version) {
    throw new Error(`${args.runner} version mismatch: Stryker runner loads ${testFramework.version}, project loads ${projectFramework.version}.`);
  }

  return {
    node: process.version,
    platform: process.platform,
    tautest: { version: cliPackage.version, path: realpathSync(cliEntry) },
    core: { version: corePackage.version, path: corePath },
    stryker: { version: strykerPackage.version, path: strykerPath },
    runner: { version: runnerPackage.version, path: runnerPath },
    testFramework: { version: testFramework.version, path: testFrameworkPath, projectPath: projectFrameworkPath }
  };
}

function resolveDependencyPackage(fromFile, dependency) {
  let current = path.dirname(realpathSync(fromFile));
  while (true) {
    const candidate = path.join(current, 'node_modules', dependency, 'package.json');
    if (existsSync(candidate)) {
      return realpathSync(candidate);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not resolve ${dependency} from ${fromFile}; the installed toolchain is not verified.`);
    }
    current = parent;
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function summarizeMutationReport(report) {
  if (!report?.files) {
    throw new Error('Direct Stryker finished without a readable mutation report.');
  }
  const mutants = Object.values(report.files).flatMap((file) => file.mutants ?? []);
  return {
    total: mutants.length,
    statuses: Object.fromEntries([...new Set(mutants.map((mutant) => mutant.status))].map((status) => [status, mutants.filter((mutant) => mutant.status === status).length])),
    framework: report.framework ? { name: report.framework.name, version: report.framework.version } : null
  };
}

function run(cwd, command, argv) {
  const result = spawnSync(command, argv, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 10 * 1024 * 1024 });
  return { command: [command, ...argv].join(' '), exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
}

function git(cwd, argv) {
  return execFileSync('git', argv, { cwd, encoding: 'utf8' });
}

function gitLines(cwd, argv) {
  return git(cwd, argv)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function assertReachable(cwd, sha) {
  execFileSync('git', ['cat-file', '-e', sha], { cwd });
}

function extractJson(stdout) {
  const start = stdout.indexOf('{');
  if (start === -1) {
    throw new Error(`Tautest produced no JSON output:\n${stdout}`);
  }
  return stdout.slice(start);
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function log(message) {
  console.error(`[corpus] ${message}`);
}

function fail(message) {
  console.error(`[corpus] ${message}`);
  process.exit(1);
}
