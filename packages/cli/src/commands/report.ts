import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { fileExists } from '../lib/fs';

export interface ReportOptions {
  from?: string;
}

export function runReportCommand(cwd: string, options: ReportOptions): string {
  const from = path.resolve(cwd, options.from ?? '.tautest/report.md');

  if (!fileExists(from)) {
    throw new CliError(`Markdown report not found: ${from}`, EXIT_CODES.configError, 'Run `tautest run` first or pass `--from <report.md>`.');
  }

  return readFileSync(from, 'utf8');
}

