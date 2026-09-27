import { readdir, realpath, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import type { RunStrykerOptions, StrykerRunResult } from '../types';
import { TautestError } from '../types';
import { TAUTEST_STRYKER_TEMP_DIR } from './config-generator';

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

// Removes only the sandboxes Stryker creates inside Tautest's own temp directory. runStryker is a
// public API, so a caller-supplied tempDirName can name a real project folder, and an in-place
// run's backup directory may hold the only copy of the original sources: both are left to Stryker.
async function cleanupStrykerTempDir(options: RunStrykerOptions): Promise<void> {
  if (options.config.tempDirName !== TAUTEST_STRYKER_TEMP_DIR || options.config.inPlace) {
    return;
  }

  let dir: string;
  let realCwd: string;

  try {
    [dir, realCwd] = await Promise.all([realpath(path.join(options.cwd, TAUTEST_STRYKER_TEMP_DIR)), realpath(options.cwd)]);
  } catch {
    return;
  }

  // A symlink or junction anywhere along `.stryker-tmp/tautest` makes realpath land elsewhere.
  if (dir !== path.join(realCwd, TAUTEST_STRYKER_TEMP_DIR)) {
    return;
  }

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('sandbox-')) {
      await rm(path.join(dir, entry.name), { recursive: true, force: true });
    }
  }

  await rmdir(dir).catch(() => undefined);
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

