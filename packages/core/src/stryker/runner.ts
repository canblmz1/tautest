import { mkdir, mkdtemp, readdir, realpath, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import type { PartialStrykerOptions } from '@stryker-mutator/api/core';
import type { RunStrykerOptions, StrykerRunResult } from '../types';
import { TautestError } from '../types';
import { TAUTEST_STRYKER_TEMP_DIR } from './config-generator';

export async function runStryker(options: RunStrykerOptions): Promise<StrykerRunResult> {
  const startedAt = new Date();
  const originalCwd = process.cwd();
  const runDir = await createRunTempDir(options).catch(() => undefined);

  try {
    process.chdir(options.cwd);
    // Loaded on use, so init, doctor and --version still work before the project installs Stryker.
    const { Stryker } = await import('@stryker-mutator/core');
    const stryker = new Stryker(runDir ? withRunTempDir(options.config, runDir) : options.config);
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
    // instrumentation breaks a test before the run completes), so remove this run's directory
    // ourselves. Never let a cleanup failure hide the run's own result.
    if (runDir) {
      await removeRunTempDir(runDir).catch(() => undefined);
    }
  }
}

// Each run gets its own directory under Tautest's temp root, so cleanup only ever deletes what this
// run created and never a concurrent run's sandbox. runStryker is a public API: a caller-supplied
// tempDirName, an in-place run (whose backups may be the only copy of the sources), and a temp root
// reached through a symlink or junction all keep Stryker's own behavior instead.
async function createRunTempDir(options: RunStrykerOptions): Promise<string | undefined> {
  if (options.config.tempDirName !== TAUTEST_STRYKER_TEMP_DIR || options.config.inPlace) {
    return undefined;
  }

  const root = path.join(options.cwd, TAUTEST_STRYKER_TEMP_DIR);
  await mkdir(root, { recursive: true });
  const expectedRoot = path.join(await realpath(options.cwd), TAUTEST_STRYKER_TEMP_DIR);

  if ((await realpath(root)) !== expectedRoot) {
    return undefined;
  }

  await removeDeadRunDirs(expectedRoot);
  return mkdtemp(path.join(expectedRoot, `run-${process.pid}-`));
}

function withRunTempDir(config: PartialStrykerOptions, runDir: string): PartialStrykerOptions {
  return {
    ...config,
    tempDirName: `${TAUTEST_STRYKER_TEMP_DIR}/${path.basename(runDir)}`,
    // Stryker leaves only its exact tempDirName out of the sandbox copy; keep every run directory
    // under the root out of it too, or a concurrent run's sandbox would be copied into this one.
    ignorePatterns: [...(config.ignorePatterns ?? []), TAUTEST_STRYKER_TEMP_DIR]
  };
}

// A run killed before its own cleanup (for example with Ctrl+C) leaves its directory behind.
// Remove those whose process is gone, never one that may still belong to a run in progress.
async function removeDeadRunDirs(root: string): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const pid = /^run-(\d+)-/.exec(entry.name)?.[1];

    if (entry.isDirectory() && pid !== undefined && !isProcessAlive(Number(pid))) {
      await rm(path.join(root, entry.name), { recursive: true, force: true });
    }
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function removeRunTempDir(runDir: string): Promise<void> {
  // Re-check just before deleting that the path still leads to this run's own directory.
  if ((await realpath(runDir).catch(() => undefined)) === runDir) {
    await rm(runDir, { recursive: true, force: true });
  }

  const root = path.dirname(runDir);
  await rmdir(root).catch(() => undefined);
  await rmdir(path.dirname(root)).catch(() => undefined);
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

