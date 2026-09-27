import { ZodError } from 'zod';
import { TautestError } from '@tautest/core';
import { EXIT_CODES, type ExitCode } from './exit-codes';

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: ExitCode,
    readonly suggestion?: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export function mapUnknownError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new CliError('Invalid Tautest config.', EXIT_CODES.configError, error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'), error);
  }

  if (error instanceof TautestError) {
    if (error.code.startsWith('STRYKER_')) {
      return new CliError(error.message, EXIT_CODES.strykerError, suggestionForStrykerError(error.code), error);
    }

    return new CliError(error.message, EXIT_CODES.detectionError, undefined, error);
  }

  if (error instanceof Error && /git|not a git repository|bad revision|unknown revision/i.test(error.message)) {
    return new CliError(error.message, EXIT_CODES.gitError, 'Make sure this is a Git repository and pass a valid --base ref.', error);
  }

  const message = error instanceof Error ? error.message : String(error);
  return new CliError(message, EXIT_CODES.detectionError);
}

function suggestionForStrykerError(code: string): string | undefined {
  switch (code) {
    case 'STRYKER_MODULE_NOT_FOUND':
      return 'Inspect Stryker’s missing-module line: build generated project imports or install the named dependency. Run `tautest doctor` to check runner setup.';
    case 'STRYKER_ZERO_TESTS_EXECUTED':
      return 'Run `tautest doctor` to check the Vitest/Stryker runner combination; do not trust a score from zero executed tests.';
    case 'STRYKER_TIMEOUT':
      return 'Check which step timed out, then tune `stryker.dryRunTimeoutMinutes` (initial run) or `stryker.timeoutMS` (mutant tests).';
    default:
      // Dry-run and out-of-memory errors already contain targeted guidance; a generic dependency
      // hint would mislead users whose dependencies are working correctly.
      return undefined;
  }
}

export function printCliError(error: CliError, debug = false): void {
  console.error(`Error: ${error.message}`);

  if (error.suggestion) {
    console.error(`Suggestion: ${error.suggestion}`);
  }

  if (debug && error.cause) {
    console.error('\nDebug:');
    console.error(error.cause);
  }
}

