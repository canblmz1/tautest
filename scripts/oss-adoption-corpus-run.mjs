#!/usr/bin/env node
// Runs one frozen external-PR corpus entry: clones a real repo at an exact PR head SHA,
// runs its normal test suite, runs the locally built Tautest CLI against the PR diff, then
// runs a direct Stryker run scoped to the same mutate pattern Tautest computed, so the two
// runtimes are comparable. Prints a JSON result row; never edits or pushes to the source repo.
//
//   node scripts/oss-adoption-corpus-run.mjs --repo=https://github.com/unjs/ohash.git \
//     --pr=196 --base=2c6e231ccfc229ab90a3e026635984f1ccd89b1d --head=a65d622c4c390061baf408b0ecdf4d5031753c69 \
//     --runner=vitest --package-manager=pnpm [--build]
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
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));

for (const required of ['repo', 'base', 'head', 'runner', 'package-manager']) {
  if (!args[required]) {
    fail(`missing --${required}`);
  }
}

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const cliEntry = path.join(repoRoot, 'packages', 'cli', 'dist', 'index.js');
const runnerPlugin = { vitest: '@stryker-mutator/vitest-runner', jest: '@stryker-mutator/jest-runner' }[args.runner];

if (!runnerPlugin) {
  fail(`unsupported --runner ${args.runner} (use vitest or jest)`);
}

const workDir = mkdtempSync(path.join(tmpdir(), 'tautest-corpus-'));
const result = { repo: args.repo, pr: args.pr ?? null, base: args.base, head: args.head, runner: args.runner, workDir };
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

  if ('build' in args) {
    result.build = step('build', () => run(workDir, pm, ['run', 'build']));
  }

  const stryker = pm === 'pnpm' ? ['add', '-D', '@stryker-mutator/core@10.0.0', runnerPlugin + '@10.0.0'] : ['install', '-D', '@stryker-mutator/core@10.0.0', runnerPlugin + '@10.0.0'];
  step('installStryker', () => run(workDir, pm, stryker));

  // Installing Stryker (and sometimes the install or build step) rewrites tracked files such as
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

  result.normalTests = step('normalTests', () => run(workDir, 'npx', [args.runner, 'run']));

  result.tautest = step('tautest', () => run(workDir, 'node', [cliEntry, 'run', '--base', args.base, '--json']));
  const tautestReport = JSON.parse(extractJson(result.tautest.stdout));
  const mutatePatterns = tautestReport.report?.scope?.mutatePatterns ?? tautestReport.report?.stryker?.config?.mutate ?? [];
  result.tautestSummary = tautestReport.report?.summary;
  result.tautestChangedFileCount = tautestReport.metrics?.changedFileCount;
  result.mutatePatterns = mutatePatterns;

  if (mutatePatterns.length > 0) {
    writeFileSync(
      path.join(workDir, 'stryker.config.json'),
      JSON.stringify({ testRunner: args.runner, packageManager: pm, coverageAnalysis: 'perTest', mutate: mutatePatterns, plugins: [runnerPlugin], reporters: ['json'], jsonReporter: { fileName: 'stryker-direct-report.json' } }, null, 2)
    );
    result.directStryker = step('directStryker', () => run(workDir, 'npx', ['stryker', 'run']));
    result.directStrykerReport = safeReadJson(path.join(workDir, 'stryker-direct-report.json'));
  } else {
    result.directStryker = { skipped: 'no mutate patterns from Tautest run' };
  }

  result.stepFailures = stepFailures;
  // "ok" means the harness completed; it does NOT mean every step's own test/build passed.
  // Check stepFailures (and each step's exitCode) before treating this entry as a clean run.
  result.status = stepFailures.length === 0 ? 'ok' : 'completed-with-step-failures';
} catch (error) {
  result.stepFailures = stepFailures;
  result.status = 'error';
  result.error = error instanceof Error ? error.message : String(error);
} finally {
  console.log(JSON.stringify(result, null, 2));
  log(`Left the clone at ${workDir} for inspection; delete it manually when done.`);

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
function step(name, fn) {
  const outcome = timed(fn);
  if (outcome.exitCode !== 0) {
    stepFailures.push({ step: name, exitCode: outcome.exitCode, command: outcome.command });
  }
  return outcome;
}

function run(cwd, command, argv) {
  const result = spawnSync(command, argv, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
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
