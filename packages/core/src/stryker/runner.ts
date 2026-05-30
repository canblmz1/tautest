import { Stryker } from '@stryker-mutator/core';
import type { RunStrykerOptions, StrykerRunResult } from '../types';
import { TautestError } from '../types';

export async function runStryker(options: RunStrykerOptions): Promise<StrykerRunResult> {
  const startedAt = new Date();
  const originalCwd = process.cwd();

  try {
    process.chdir(options.cwd);
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

  if (/Cannot find module|ERR_MODULE_NOT_FOUND/i.test(message)) {
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

  return new TautestError(`Stryker mutation run failed: ${message}`, 'STRYKER_RUN_FAILED', error);
}

