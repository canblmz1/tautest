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
      return new CliError(error.message, EXIT_CODES.strykerError, 'Run `tautest doctor` and verify Stryker/Vitest dependencies are installed.', error);
    }

    return new CliError(error.message, EXIT_CODES.detectionError, undefined, error);
  }

  if (error instanceof Error && /git|not a git repository|bad revision|unknown revision/i.test(error.message)) {
    return new CliError(error.message, EXIT_CODES.gitError, 'Make sure this is a Git repository and pass a valid --base ref.', error);
  }

  const message = error instanceof Error ? error.message : String(error);
  return new CliError(message, EXIT_CODES.detectionError);
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

