import path from 'node:path';
import {
  buildReliabilityMarkdownReport,
  buildReliabilityTerminalSummary,
  buildWatchSelectionReport,
  getChangedFiles
} from '@tautest/core';
import { EXIT_CODES } from '../lib/exit-codes';
import { ensureDir, writeJsonFile, writeTextFile } from '../lib/fs';

export interface WatchOptions {
  base?: string;
  json?: boolean;
  reportDir?: string;
}

export interface WatchResult {
  exitCode: number;
  output: string;
  reportDir: string;
  jsonReportPath: string;
  markdownReportPath: string;
}

export function runWatchCommand(cwd: string, paths: string[], options: WatchOptions): WatchResult {
  const reportDir = path.resolve(cwd, options.reportDir ?? '.tautest');
  const jsonReportPath = path.join(reportDir, 'watch-report.json');
  const markdownReportPath = path.join(reportDir, 'watch-report.md');
  const changedFiles = paths.length > 0 ? paths : getChangedFiles({ cwd, baseRef: options.base ?? 'origin/main', relative: true }).map((file) => file.path);
  const report = buildWatchSelectionReport({
    cwd,
    changedFiles
  });

  ensureDir(reportDir);
  writeJsonFile(jsonReportPath, report);
  writeTextFile(markdownReportPath, buildReliabilityMarkdownReport(report));

  const output = options.json
    ? `${JSON.stringify(
        {
          status: 'watch-plan',
          report,
          paths: {
            json: jsonReportPath,
            markdown: markdownReportPath
          }
        },
        null,
        2
      )}\n`
    : [
        buildReliabilityTerminalSummary(report).trimEnd(),
        '',
        'Affected tests:',
        ...report.metadata.affectedTests.map((filePath) => `- ${filePath}`),
        ...(report.metadata.affectedTests.length === 0 ? ['- None'] : []),
        '',
        'Command hints:',
        ...report.metadata.commandHints.map((command) => `- ${command}`),
        '',
        `JSON: ${jsonReportPath}`,
        `Markdown: ${markdownReportPath}`
      ].join('\n') + '\n';

  return {
    exitCode: EXIT_CODES.ok,
    output,
    reportDir,
    jsonReportPath,
    markdownReportPath
  };
}
