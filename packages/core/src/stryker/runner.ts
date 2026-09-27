import { realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import type { RunStrykerOptions, StrykerRunResult } from '../types';
import { TautestError } from '../types';

export async function runStryker(options: RunStrykerOptions): Promise<StrykerRunResult> {
  const startedAt = new Date();
  const originalCwd = process.cwd();

  try {
    process.chdir(options.cwd);
    // Loaded on use, so init, doctor and --version still work before the project installs Stryker.
    const { Stryker } = await import('@stryker-mutator/core');
    const stryker = new Stryker(options.config);
    await stryker.runMutationTest();

    return {
      jsonReportPath: options.jsonReportPath,
      startedAt,
      endedAt: new Date()
    };
  } catch (error) {
    throw mapStrykerError(error);
  } finally {
    process.chdir(originalCwd);
    // Stryker's own cleanTempDir does not run on every failure path (for example when
    // instrumentation breaks a test before the run completes), so remove the exact
    // Tautest-owned sandbox ourselves. Never let a cleanup failure hide the run's own result.
    await cleanupStrykerTempDir(options).catch(() => undefined);
  }
}

async function cleanupStrykerTempDir(options: RunStrykerOptions): Promise<void> {
  const tempDirName = options.config.tempDirName;

  if (typeof tempDirName !== 'string' || tempDirName.length === 0) {
    return;
  }

  const cwd = path.resolve(options.cwd);
  const resolved = path.resolve(cwd, tempDirName);
  const relative = path.relative(cwd, resolved);

  // runStryker is a public @tautest/core API, so config.tempDirName is not guaranteed to be the
  // Tautest-generated `.stryker-tmp/tautest` value. Refuse to delete anything outside cwd rather
  // than trust it blindly. This lexical check alone does not catch a symlink/junction segment
  // (e.g. tempDirName: 'link/tautest' where cwd/link points elsewhere), so it is followed by a
  // realpath-based check below.
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return;
  }

  let realResolved: string;
  let realCwd: string;

  try {
    [realResolved, realCwd] = await Promise.all([realpath(resolved), realpath(cwd)]);
  } catch {
    // Target does not exist; nothing to delete.
    return;
  }

  const realRelative = path.relative(realCwd, realResolved);

  if (realRelative === '' || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    return;
  }

  await rm(realResolved, { recursive: true, force: true });
}

export function mapStrykerError(error: unknown): TautestError {
  const message = error instanceof Error ? error.message : String(error);

  if (/No tests found/i.test(message)) {
    return new TautestError('Stryker could not find tests for the selected mutation scope.', 'STRYKER_NO_TESTS', error);
  }

  if (/Cannot find module|Cannot find package|ERR_MODULE_NOT_FOUND/i.test(message)) {
    return new TautestError('Stryker failed because a required module or runner dependency was not found.', 'STRYKER_MODULE_NOT_FOUND', error);
  }

  if (/timed out|timeout/i.test(message)) {
    return new TautestError('Stryker timed out while running mutation tests.', 'STRYKER_TIMEOUT', error);
  }

  if (/ENOMEM|out of memory|heap out of memory|JavaScript heap/i.test(message)) {
    return new TautestError(
      'Stryker ran out of memory. Reduce concurrency or increase the Node.js heap size with --max-old-space-size.',
      'STRYKER_OUT_OF_MEMORY',
      error
    );
  }

  if (/failed tests in the initial test run|something went wrong in the initial test run/i.test(message)) {
    return new TautestError(
      'Stryker’s initial test run failed before mutation testing could start. Scroll up for the specific failing test Stryker reported. ' +
        'First confirm the test actually fails on the unmutated code too (run your normal test command); if it does, this is a real broken test in the PR, not a Tautest problem. ' +
        'If the normal run passes and only Stryker fails it, mutation instrumentation likely changed something the test asserts on other than behavior (bundle size, snapshot counts, timing). ' +
        'See docs/TROUBLESHOOTING.md#instrumentation-breaks-a-non-behavioral-test for an opt-in mutation-only test config that excludes that test from Stryker runs only.',
      'STRYKER_DRY_RUN_FAILED',
      error
    );
  }

  return new TautestError(`Stryker mutation run failed: ${message}`, 'STRYKER_RUN_FAILED', error);
}

