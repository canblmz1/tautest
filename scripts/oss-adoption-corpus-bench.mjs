#!/usr/bin/env node
// Times Tautest against the real alternatives on one validated corpus clone. Run it right after
// scripts/oss-adoption-corpus-run.mjs, in the same container, on the clone that run left behind with status
// "ok": the same install, published toolchain, machine and project setup.
// scripts/oss-adoption-corpus-bench-docker.mjs does both steps for one corpus row.
//
//   node scripts/oss-adoption-corpus-bench.mjs --result=/out/validation/result.json --out=/out/bench \
//     [--rounds=7] [--min-rounds=3] [--time-budget-minutes=45] [--budget-minutes=10] \
//     [--timeout-minutes=20] [--cooldown-seconds=5] [--max-timeouts=2]
//
// Variants:
//   tautest           `tautest run --base <base>` with the installed published version.
//   direct-matched    Stryker with Tautest's effective config on the same line ranges. The gap to
//                     `tautest` estimates the wrapper overhead.
//   direct-defaults   Stryker with its own defaults on the same line ranges, so `vitest.related` or
//                     `jest.enableFindRelatedTests` is on (Tautest turns both off).
//   full-file         Tautest's effective config on the whole changed production files.
//   incremental-cold  full-file with `incremental: true`, starting without an incremental file.
//   incremental-warm  full-file with `incremental: true`, starting from the incremental file of a run
//                     at the PR base (what a cache from the base branch would hold).
//   incremental-rerun full-file with `incremental: true`, starting from the incremental file of a run
//                     at the PR head itself: the best case, where every result can be reused.
// Every round runs each variant once. The order follows orderFor(): a cyclic Latin square, so over seven
// rounds every variant holds every position once, and the next seven run the list reversed. A cooldown
// separates runs. Rounds go on up to --rounds, but stop after --min-rounds once the next round would
// exceed --time-budget-minutes; a variant that times out --max-timeouts times is not run again.
// The incremental variants log at info level so the number of reused mutant results can be read from the
// output. Only runs that finish count toward the timings; a run stopped by the timeout counts as the
// time it ran, and a run that fails is recorded with its exit code and output tail instead.
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism, cpus, loadavg, release, totalmem } from 'node:os';
import path from 'node:path';
import { VARIANTS, compareWithTautest, matchReports, orderFor, summarize } from './oss-adoption-corpus-bench-lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));

for (const required of ['result', 'out']) {
  if (!args[required]) {
    fail(`missing --${required}`);
  }
}

const rounds = Number(args.rounds ?? 7);
const minRounds = Number(args['min-rounds'] ?? 3);
const timeBudgetMs = Number(args['time-budget-minutes'] ?? 45) * 60_000;
const budgetMs = Number(args['budget-minutes'] ?? 10) * 60_000;
const timeoutMs = Number(args['timeout-minutes'] ?? 20) * 60_000;
const cooldownMs = Number(args['cooldown-seconds'] ?? 5) * 1000;
const maxTimeouts = Number(args['max-timeouts'] ?? 2);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 30 || !Number.isInteger(minRounds) || minRounds < 1 || minRounds > rounds || !(budgetMs > 0) || !(timeoutMs > 0) || !(timeBudgetMs > 0) || !(cooldownMs >= 0) || !Number.isInteger(maxTimeouts) || maxTimeouts < 1) {
  fail('--rounds is 1-30 and at least --min-rounds; the budget, timeout and time-budget minutes are positive; --cooldown-seconds is not negative; --max-timeouts is a positive integer');
}

const validation = JSON.parse(readFileSync(args.result, 'utf8'));
if (validation.status !== 'ok') {
  fail(`the validation run has status "${validation.status}"; benchmark only a row whose Tautest and direct Stryker results matched and repeated`);
}

const cwd = validation.workDir;
const outDir = path.resolve(args.out);
const pm = validation.install.command.split(' ')[0];
const runnerPlugin = { vitest: '@stryker-mutator/vitest-runner', jest: '@stryker-mutator/jest-runner' }[validation.runner];
const cliEntry = path.join(cwd, 'node_modules', 'tautest', 'dist', 'index.js');
const strykerBin = resolveStrykerBin(cwd);
for (const [key, value] of Object.entries(validation.setupEnv ?? {})) {
  process.env[key] = value;
}

mkdirSync(path.join(outDir, 'configs'), { recursive: true });
mkdirSync(path.join(outDir, 'reports'), { recursive: true });
mkdirSync(path.join(cwd, '.bench'), { recursive: true });
appendFileSync(path.join(cwd, '.git', 'info', 'exclude'), '\n.bench/\n');

// The harness's direct config is Tautest's effective Stryker config. Move it out of the project
// root: Stryker loads a root `stryker.config.json` under any options it is given, so leaving it
// there would feed it into every Tautest and default-config run.
const validationConfigPath = path.join(cwd, '.bench', 'validation-direct.config.json');
renameSync(path.join(cwd, 'stryker.config.json'), validationConfigPath);
const effective = JSON.parse(readFileSync(validationConfigPath, 'utf8'));
const common = { ...effective, tempDirName: '.stryker-tmp-bench', reporters: ['json'] };
delete common.mutate;
delete common.jsonReporter;

const lineRanges = validation.mutatePatterns;
const files = [...new Set(lineRanges.map((pattern) => pattern.replace(/:\d+(?:-\d+)?$/, '')))];
const reportFile = (variant) => `.bench/report-${variant}.json`;

const configs = {
  'direct-matched': { ...common, mutate: lineRanges, jsonReporter: { fileName: reportFile('direct-matched') } },
  'direct-defaults': {
    testRunner: validation.runner,
    plugins: [runnerPlugin],
    mutate: lineRanges,
    reporters: ['json'],
    jsonReporter: { fileName: reportFile('direct-defaults') },
    // The documented mutation-only test exclusion is part of the project setup, not a Tautest
    // setting, so a hand-written config needs it too.
    ...(validation.deviations?.vitestConfigFile ? { vitest: { configFile: validation.deviations.vitestConfigFile } } : {})
  },
  'full-file': { ...common, mutate: files, jsonReporter: { fileName: reportFile('full-file') } },
  'incremental-cold': { ...common, mutate: files, incremental: true, incrementalFile: '.bench/incremental-cold.json', logLevel: 'info', jsonReporter: { fileName: reportFile('incremental-cold') } },
  'incremental-warm': { ...common, mutate: files, incremental: true, incrementalFile: '.bench/incremental-warm.json', logLevel: 'info', jsonReporter: { fileName: reportFile('incremental-warm') } },
  'incremental-rerun': { ...common, mutate: files, incremental: true, incrementalFile: '.bench/incremental-rerun.json', logLevel: 'info', jsonReporter: { fileName: reportFile('incremental-rerun') } }
};
// Each warm variant starts from a copy of the cache it measures, since Stryker rewrites the file.
const cacheFor = { 'incremental-warm': 'incremental-base.json', 'incremental-rerun': 'incremental-head.json' };
for (const [variant, config] of Object.entries(configs)) {
  writeFileSync(path.join(cwd, '.bench', `${variant}.config.json`), JSON.stringify(config, null, 2));
  copyFileSync(path.join(cwd, '.bench', `${variant}.config.json`), path.join(outDir, 'configs', `${variant}.config.json`));
}
copyFileSync(validationConfigPath, path.join(outDir, 'configs', 'tautest-effective.config.json'));

const bench = {
  repo: validation.repo,
  pr: validation.pr,
  base: validation.base,
  head: validation.head,
  runner: validation.runner,
  toolchain: validation.toolchain,
  setupEnv: validation.setupEnv ?? null,
  deviations: validation.deviations ?? null,
  installDeviations: validation.installDeviations ?? null,
  environment: {
    platform: `${process.platform} ${release()}`,
    node: process.version,
    cpus: availableParallelism(),
    cpuModel: cpus()[0]?.model,
    memoryGiB: Number((totalmem() / 2 ** 30).toFixed(1))
  },
  settings: { rounds, minRounds, timeBudgetMinutes: timeBudgetMs / 60_000, budgetMinutes: budgetMs / 60_000, timeoutMinutes: timeoutMs / 60_000, cooldownSeconds: cooldownMs / 1000, maxTimeouts },
  scope: { lineRanges, files },
  setup: {
    installMs: validation.install?.durationMs ?? null,
    installMode: validation.installMode,
    buildMs: validation.build?.durationMs ?? null,
    testToolsInstallMs: validation.installTestTools?.durationMs ?? null,
    normalTestsMs: validation.normalTests?.durationMs ?? null,
    firstTautestRunMs: validation.tautest?.durationMs ?? null,
    firstDirectRunMs: validation.directStryker?.durationMs ?? null
  },
  orders: [],
  skipped: {},
  samples: []
};

const startedAt = new Date().toISOString();
try {
  bench.warmCache = { ...(await prepareBaseCache()), ...(await prepareHeadCache()) };

  const variants = VARIANTS.filter((variant) =>
    (variant !== 'incremental-warm' || bench.warmCache.usable) && (variant !== 'incremental-rerun' || bench.warmCache.headRunUsable));
  const timeouts = new Map();
  const measuringStartedAt = Date.now();
  for (let round = 1; round <= rounds; round++) {
    const roundStartedAt = Date.now();
    const order = orderFor(variants, round);
    bench.orders.push({ round, order });
    for (const [index, variant] of order.entries()) {
      if (bench.skipped[variant]) {
        continue;
      }
      if (bench.samples.length > 0 && cooldownMs > 0) {
        await sleep(cooldownMs);
      }
      const sample = await runVariant(variant);
      bench.samples.push({ round, position: index + 1, ...sample });
      log(`round ${round} position ${index + 1} ${variant}: ${sample.completed ? `${(sample.durationMs / 1000).toFixed(1)}s` : `FAILED exit ${sample.exitCode}${sample.timedOut ? ' (timeout)' : ''} after ${(sample.durationMs / 1000).toFixed(1)}s`}${sample.summary ? ` ${sample.summary.total} mutants` : ''}${sample.reused ? ` reused ${sample.reused.reused}/${sample.reused.of}` : ''}`);
      if (sample.timedOut) {
        timeouts.set(variant, (timeouts.get(variant) ?? 0) + 1);
        if (timeouts.get(variant) >= maxTimeouts) {
          bench.skipped[variant] = { afterRound: round, reason: `stopped by the ${timeoutMs / 60_000}-minute timeout in ${timeouts.get(variant)} rounds` };
          log(`${variant} is not run again: ${bench.skipped[variant].reason}`);
        }
      }
    }
    const elapsedMs = Date.now() - measuringStartedAt;
    const roundMs = Date.now() - roundStartedAt;
    if (round >= minRounds && round < rounds && elapsedMs + roundMs > timeBudgetMs) {
      bench.stoppedEarly = { afterRound: round, elapsedMs, lastRoundMs: roundMs, reason: `another round would exceed the ${timeBudgetMs / 60_000}-minute time budget` };
      log(`stopping after round ${round}: ${bench.stoppedEarly.reason}`);
      break;
    }
  }

  bench.roundsRun = Math.max(0, ...bench.samples.map((sample) => sample.round));
  bench.stats = Object.fromEntries(variants.map((variant) => [variant, summarize(bench.samples.filter((sample) => sample.variant === variant))]));
  bench.pairedVsTautest = Object.fromEntries(variants.filter((variant) => variant !== 'tautest').map((variant) => [variant, compareWithTautest(bench.samples, variant)]));
  bench.matches = matchReports(loadKeptReports(), lineRanges);
  bench.status = 'ok';
} catch (error) {
  bench.status = 'error';
  bench.error = error instanceof Error ? error.message : String(error);
} finally {
  bench.startedAt = startedAt;
  bench.finishedAt = new Date().toISOString();
  writeFileSync(path.join(outDir, 'bench.json'), `${JSON.stringify(bench, null, 2)}\n`);
  log(`wrote ${path.join(outDir, 'bench.json')}`);
  if (bench.status !== 'ok') {
    process.exitCode = 1;
  }
}

// A cache from the base branch: one incremental run on the changed files as they are at the PR base,
// with the project's own build step when the row needs one, then back to the exact PR head. A failed
// base run only drops the warm variant; failing to get back to the PR head stops the benchmark.
async function prepareBaseCache() {
  const baseFiles = files.filter((file) => {
    try {
      execFileSync('git', ['cat-file', '-e', `${validation.base}:${file}`], { cwd, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });
  const dependencyFilesChanged = validation.prChangedFiles.filter((file) => /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(file));
  const prep = { usable: false, baseFiles, dependencyFilesChanged };
  if (baseFiles.length === 0) {
    prep.skipped = 'none of the changed production files exist at the PR base';
    return prep;
  }

  git(['checkout', '--quiet', validation.base]);
  try {
    if (validation.build) {
      const build = await timedRun(pm, ['run', 'build']);
      prep.baseBuild = { durationMs: build.durationMs, exitCode: build.exitCode };
    }
    if (!prep.baseBuild || prep.baseBuild.exitCode === 0) {
      const baseConfig = { ...common, mutate: baseFiles, incremental: true, incrementalFile: '.bench/incremental-base.json', logLevel: 'info', jsonReporter: { fileName: '.bench/report-incremental-base.json' } };
      writeFileSync(path.join(cwd, '.bench', 'incremental-base.config.json'), JSON.stringify(baseConfig, null, 2));
      copyFileSync(path.join(cwd, '.bench', 'incremental-base.config.json'), path.join(outDir, 'configs', 'incremental-base.config.json'));
      const baseRun = await timedRun('node', [strykerBin, 'run', '.bench/incremental-base.config.json']);
      const match = stripAnsi(baseRun.stdout + baseRun.stderr).match(/(\d+) of (\d+) mutant result\(s\) are reused/);
      prep.baseRun = { durationMs: baseRun.durationMs, exitCode: baseRun.exitCode, timedOut: baseRun.timedOut, summary: summarizeReport('.bench/report-incremental-base.json', 'incremental-base'), reused: match ? { reused: Number(match[1]), of: Number(match[2]) } : undefined, outputTail: baseRun.exitCode === 0 ? undefined : baseRun.tail };
    }
  } finally {
    // Undo anything the base build changed in tracked files before returning to the PR head.
    git(['checkout', '--quiet', '--', '.']);
    git(['checkout', '--quiet', validation.head]);
  }
  if (validation.build) {
    const rebuild = await timedRun(pm, ['run', 'build']);
    prep.headRebuild = { durationMs: rebuild.durationMs, exitCode: rebuild.exitCode };
    if (rebuild.exitCode !== 0) {
      throw new Error(`Rebuilding the PR head failed with exit ${rebuild.exitCode}.`);
    }
    // As in the harness, a build must not change the tracked tree that Tautest diffs.
    git(['checkout', '--quiet', '--', '.']);
  }
  if (git(['rev-parse', 'HEAD']).trim() !== validation.head || git(['status', '--porcelain', '--untracked-files=no']).trim() !== '') {
    throw new Error('The clone is not back at the exact PR head after the base run.');
  }
  prep.usable = prep.baseRun?.exitCode === 0 && existsSync(path.join(cwd, '.bench', 'incremental-base.json'));
  if (!prep.usable) {
    prep.skipped = prep.baseBuild?.exitCode ? 'the build at the PR base failed' : 'the incremental run at the PR base failed';
  }
  return prep;
}

// One incremental run at the PR head; its file is the cache for the rerun variant.
async function prepareHeadCache() {
  const headConfig = { ...configs['incremental-cold'], incrementalFile: '.bench/incremental-head.json', jsonReporter: { fileName: '.bench/report-incremental-head.json' } };
  writeFileSync(path.join(cwd, '.bench', 'incremental-head.config.json'), JSON.stringify(headConfig, null, 2));
  copyFileSync(path.join(cwd, '.bench', 'incremental-head.config.json'), path.join(outDir, 'configs', 'incremental-head.config.json'));
  const headRun = await timedRun('node', [strykerBin, 'run', '.bench/incremental-head.config.json']);
  return {
    headRun: { durationMs: headRun.durationMs, exitCode: headRun.exitCode, timedOut: headRun.timedOut, summary: summarizeReport('.bench/report-incremental-head.json', 'incremental-head'), outputTail: headRun.exitCode === 0 ? undefined : headRun.tail },
    headRunUsable: headRun.exitCode === 0 && existsSync(path.join(cwd, '.bench', 'incremental-head.json'))
  };
}

async function runVariant(variant) {
  const startedAt = new Date().toISOString();
  const loadBefore = loadavg()[0];
  let outcome;
  let summary;
  let reused;
  let tautestMetrics;

  if (variant === 'tautest') {
    outcome = await timedRun('node', [cliEntry, 'run', '--base', validation.base, '--json']);
    // Exit 1 is a threshold failure, a complete run all the same.
    outcome.completed = [0, 1].includes(outcome.exitCode) && !outcome.timedOut;
    try {
      const report = JSON.parse(outcome.stdout.slice(outcome.stdout.indexOf('{')));
      summary = report.report?.summary ? { total: report.report.summary.total, killed: report.report.summary.killed, survived: report.report.summary.survived, timeout: report.report.summary.timeout, noCoverage: report.report.summary.noCoverage } : undefined;
      tautestMetrics = report.metrics;
      if (report.paths?.mutationJson) {
        summarizeReport(report.paths.mutationJson, 'tautest');
      }
    } catch {
      summary = undefined;
    }
  } else {
    rmSync(path.join(cwd, configs[variant].jsonReporter.fileName), { force: true });
    if (variant === 'incremental-cold') {
      rmSync(path.join(cwd, '.bench', 'incremental-cold.json'), { force: true });
    }
    if (cacheFor[variant]) {
      copyFileSync(path.join(cwd, '.bench', cacheFor[variant]), path.join(cwd, configs[variant].incrementalFile));
    }
    outcome = await timedRun('node', [strykerBin, 'run', `.bench/${variant}.config.json`]);
    outcome.completed = outcome.exitCode === 0 && !outcome.timedOut;
    summary = summarizeReport(configs[variant].jsonReporter.fileName, variant);
    const match = stripAnsi(outcome.stdout + outcome.stderr).match(/(\d+) of (\d+) mutant result\(s\) are reused/);
    reused = match ? { reused: Number(match[1]), of: Number(match[2]) } : undefined;
  }

  if (outcome.timedOut) {
    // A killed Stryker cannot clean up after itself; remove its sandbox so it cannot slow later runs.
    for (const entry of readdirSync(cwd).filter((name) => name.startsWith('.stryker-tmp'))) {
      rmSync(path.join(cwd, entry), { recursive: true, force: true });
    }
  }

  return {
    variant,
    startedAt,
    durationMs: outcome.durationMs,
    exitCode: outcome.exitCode,
    timedOut: outcome.timedOut,
    completed: outcome.completed,
    overBudget: outcome.durationMs > budgetMs,
    loadAvg1mBefore: loadBefore,
    loadAvg1mAfter: loadavg()[0],
    summary,
    reused,
    tautestMetrics,
    outputTail: outcome.completed ? undefined : outcome.tail
  };
}

// Keeps the first report of each variant (per-file source text removed) as evidence of its scope, and
// returns the status counts. `reportPath` is relative to the clone unless it is absolute.
function summarizeReport(reportPath, variant) {
  const absolute = path.isAbsolute(reportPath) ? reportPath : path.join(cwd, reportPath);
  if (!existsSync(absolute)) {
    return undefined;
  }
  const report = JSON.parse(readFileSync(absolute, 'utf8'));
  const kept = path.join(outDir, 'reports', `${variant}.json`);
  if (!existsSync(kept)) {
    for (const file of Object.values(report.files ?? {})) delete file.source;
    for (const file of Object.values(report.testFiles ?? {})) delete file.source;
    writeFileSync(kept, JSON.stringify(report));
  }
  const mutants = Object.values(report.files ?? {}).flatMap((file) => file.mutants ?? []);
  const count = (status) => mutants.filter((mutant) => mutant.status === status).length;
  return { total: mutants.length, killed: count('Killed'), survived: count('Survived'), timeout: count('Timeout'), noCoverage: count('NoCoverage') };
}

function loadKeptReports() {
  const reports = {};
  for (const variant of VARIANTS) {
    const kept = path.join(outDir, 'reports', `${variant}.json`);
    if (existsSync(kept)) {
      reports[variant] = JSON.parse(readFileSync(kept, 'utf8'));
    }
  }
  return reports;
}

// Runs a command in its own process group so a timeout can stop the test workers it started too.
function timedRun(command, argv) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn(command, argv, { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({ exitCode: code, timedOut, durationMs: Math.round(durationMs), stdout, stderr, tail: stripAnsi(`${stdout}\n${stderr}`).slice(-3000) });
    });
  });
}

function resolveStrykerBin(projectDir) {
  const packageJson = realpathSync(path.join(projectDir, 'node_modules', '@stryker-mutator', 'core', 'package.json'));
  const { bin } = JSON.parse(readFileSync(packageJson, 'utf8'));
  return path.join(path.dirname(packageJson), typeof bin === 'string' ? bin : bin.stryker);
}

function git(argv) {
  return execFileSync('git', argv, { cwd, encoding: 'utf8' });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function log(message) {
  console.error(`[bench] ${message}`);
}

function fail(message) {
  console.error(`[bench] ${message}`);
  process.exit(1);
}
