import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildHtmlReport, buildReliabilityHtmlReport, isReliabilityReport, type TautestJsonReport } from '@tautest/core';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { fileExists, readJsonFile, writeTextFile } from '../lib/fs';

export interface ReportOptions {
  from?: string;
  html?: boolean;
  out?: string;
}

export function runReportCommand(cwd: string, options: ReportOptions): string {
  if (options.html) {
    return runHtmlReportCommand(cwd, options);
  }

  const from = path.resolve(cwd, options.from ?? '.tautest/report.md');

  if (!fileExists(from)) {
    throw new CliError(`Markdown report not found: ${from}`, EXIT_CODES.configError, 'Run `tautest run` first or pass `--from <report.md>`.');
  }

  return readFileSync(from, 'utf8');
}

function runHtmlReportCommand(cwd: string, options: ReportOptions): string {
  const from = path.resolve(cwd, options.from ?? '.tautest/report.json');

  if (!fileExists(from)) {
    throw new CliError(`Report JSON not found: ${from}`, EXIT_CODES.configError, 'Run `tautest run` first or pass `--from <report.json>`.');
  }

  const report = readJsonFile<TautestJsonReport | unknown>(from);
  const out = path.resolve(cwd, options.out ?? path.join(path.dirname(from), 'report.html'));
  writeTextFile(out, isReliabilityReport(report) ? buildReliabilityHtmlReport(report) : buildHtmlReport(report as TautestJsonReport));

  return `HTML report written: ${path.relative(cwd, out) || out}\n`;
}
