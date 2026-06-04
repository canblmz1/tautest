import path from 'node:path';
import {
  analyzeFlakiness,
  buildReliabilityMarkdownReport,
  buildReliabilityTerminalSummary,
  type TestRunner
} from '@tautest/core';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { ensureDir, writeJsonFile, writeTextFile } from '../lib/fs';

export interface PredictFlakyOptions {
  runner?: TestRunner;
  json?: boolean;
  threshold?: string;
  reportDir?: string;
}

export interface PredictFlakyResult {
  exitCode: number;
  output: string;
  reportDir: string;
  jsonReportPath: string;
  markdownReportPath: string;
}

export function runPredictFlakyCommand(cwd: string, paths: string[], options: PredictFlakyOptions): PredictFlakyResult {
  const reportDir = path.resolve(cwd, options.reportDir ?? '.tautest');
  const jsonReportPath = path.join(reportDir, 'flaky-report.json');
  const markdownReportPath = path.join(reportDir, 'flaky-report.md');
  const threshold = parseOptionalRiskThreshold(options.threshold);
  const report = analyzeFlakiness({
    cwd,
    paths,
    runner: options.runner
  });

  ensureDir(reportDir);
  writeJsonFile(jsonReportPath, report);
  writeTextFile(markdownReportPath, buildReliabilityMarkdownReport(report));

  const thresholdFailed = threshold !== undefined && report.summary.riskScore >= threshold;
  const exitCode = thresholdFailed ? EXIT_CODES.thresholdFailed : EXIT_CODES.ok;
  const output = options.json
    ? `${JSON.stringify(
        {
          status: thresholdFailed ? 'risk-threshold-failed' : 'passed',
          threshold,
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
        `JSON: ${jsonReportPath}`,
        `Markdown: ${markdownReportPath}`,
        threshold === undefined ? undefined : `Threshold: ${threshold} (${thresholdFailed ? 'failed' : 'passed'})`
      ]
        .filter(Boolean)
        .join('\n') + '\n';

  return {
    exitCode,
    output,
    reportDir,
    jsonReportPath,
    markdownReportPath
  };
}

function parseOptionalRiskThreshold(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new CliError('Invalid --threshold value.', EXIT_CODES.configError, 'Use a number between 0 and 100.');
  }

  return parsed;
}
