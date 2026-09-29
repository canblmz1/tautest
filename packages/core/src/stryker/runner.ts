import type { RunStrykerOptions, StrykerRunResult } from '../types';
import { TautestError } from '../types';

// Tautest deletes no files here. The generated config sets `cleanTempDir: 'always'`, so Stryker
// removes the sandbox it created (a unique mkdtemp directory) after a failed run too, and never
// another run's. runStryker is a public API: a caller's own config is passed through unchanged.
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
  }
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

