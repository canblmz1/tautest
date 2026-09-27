import { describe, expect, it, vi } from 'vitest';
import { mapStrykerError, TautestError } from '@tautest/core';
import { mapUnknownError, printCliError } from '../src/lib/errors';
import { EXIT_CODES } from '../src/lib/exit-codes';

describe('Stryker CLI error suggestions', () => {
  it('does not add a dependency hint to an initial-test-run failure', () => {
    const mapped = mapUnknownError(mapStrykerError(new Error('ConfigError: There were failed tests in the initial test run.')));

    expect(mapped.exitCode).toBe(EXIT_CODES.strykerError);
    expect(mapped.message).toContain('First confirm the test actually fails on the unmutated code');
    expect(mapped.suggestion).toBeUndefined();

    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      printCliError(mapped);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Suggestion:'));
    } finally {
      log.mockRestore();
    }
  });

  it('gives missing modules a specific hint', () => {
    const mapped = mapUnknownError(mapStrykerError(new Error('Cannot find module @stryker-mutator/vitest-runner')));

    expect(mapped.exitCode).toBe(EXIT_CODES.strykerError);
    expect(mapped.suggestion).toContain('tautest doctor');
    expect(mapped.suggestion).toContain('generated project imports');
  });

  it('points timeouts to the supported configuration limits', () => {
    const mapped = mapUnknownError(mapStrykerError(new Error('Stryker timed out')));

    expect(mapped.exitCode).toBe(EXIT_CODES.strykerError);
    expect(mapped.suggestion).toContain('stryker.dryRunTimeoutMinutes');
    expect(mapped.suggestion).toContain('stryker.timeoutMS');
    expect(mapped.suggestion).not.toContain('tautest doctor');
  });

  it('does not append a dependency hint to out-of-memory or generic run errors', () => {
    for (const error of [new Error('JavaScript heap out of memory'), new Error('Stryker worker crashed')]) {
      const mapped = mapUnknownError(mapStrykerError(error));
      expect(mapped.exitCode).toBe(EXIT_CODES.strykerError);
      expect(mapped.suggestion).toBeUndefined();
    }
  });

  it('keeps a doctor hint for a zero-tests-executed safety stop', () => {
    const mapped = mapUnknownError(new TautestError('A mutant executed 0 tests.', 'STRYKER_ZERO_TESTS_EXECUTED'));

    expect(mapped.exitCode).toBe(EXIT_CODES.strykerError);
    expect(mapped.suggestion).toContain('tautest doctor');
  });
});
