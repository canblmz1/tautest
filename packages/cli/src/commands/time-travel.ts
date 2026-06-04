import path from 'node:path';
import { buildTimeTravelHelper, type TestRunner } from '@tautest/core';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { fileExists, writeTextFile } from '../lib/fs';

export interface TimeTravelOptions {
  runner?: TestRunner;
  setupFile?: string;
  print?: boolean;
  force?: boolean;
  json?: boolean;
}

export function runTimeTravelCommand(cwd: string, options: TimeTravelOptions): string {
  const runner = options.runner ?? 'vitest';
  const helper = buildTimeTravelHelper({ runner });
  const setupFile = path.resolve(cwd, options.setupFile ?? 'test/tautest-time-travel.ts');

  if (!options.print) {
    if (fileExists(setupFile) && !options.force) {
      throw new CliError('Time-travel setup file already exists.', EXIT_CODES.configError, `Pass --force to overwrite: ${path.relative(cwd, setupFile)}`);
    }

    writeTextFile(setupFile, helper);
  }

  if (options.json) {
    return `${JSON.stringify(
      {
        status: options.print ? 'preview' : 'written',
        runner,
        setupFile,
        code: options.print ? helper : undefined
      },
      null,
      2
    )}\n`;
  }

  if (options.print) {
    return helper;
  }

  return `Time-travel helper written: ${path.relative(cwd, setupFile) || setupFile}\n`;
}
