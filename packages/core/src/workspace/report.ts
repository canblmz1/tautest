import type { WorkspacePackageRunResult, WorkspaceRunReport } from '../types';

export function buildWorkspaceRunReport(input: {
  baseRef: string;
  packageManager: WorkspaceRunReport['packageManager'];
  workspaceRoot: string;
  reportDir: string;
  packages: WorkspacePackageRunResult[];
  warnings?: string[];
  createdAt?: Date;
}): WorkspaceRunReport {
  const summary = {
    selected: input.packages.length,
    passed: input.packages.filter((item) => item.status === 'passed').length,
    thresholdFailed: input.packages.filter((item) => item.status === 'threshold-failed').length,
    noOp: input.packages.filter((item) => item.status === 'no-op').length,
    errors: input.packages.filter((item) => item.status === 'error').length
  };

  return {
    version: '1',
    schemaVersion: '1',
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    status: workspaceStatus(summary),
    baseRef: input.baseRef,
    packageManager: input.packageManager,
    workspaceRoot: input.workspaceRoot,
    reportDir: input.reportDir,
    summary,
    packages: input.packages,
    warnings: input.warnings ?? []
  };
}

export function buildWorkspaceMarkdownReport(report: WorkspaceRunReport): string {
  return [
    `# Tautest Workspace Report: ${report.status}`,
    '',
    `Base ref: \`${report.baseRef}\``,
    `Package manager: \`${report.packageManager ?? 'unknown'}\``,
    `Workspace root: \`${report.workspaceRoot}\``,
    `Report dir: \`${report.reportDir}\``,
    '',
    '## Summary',
    '',
    '| Selected | Passed | Threshold failed | No-op | Errors |',
    '| ---: | ---: | ---: | ---: | ---: |',
    `| ${report.summary.selected} | ${report.summary.passed} | ${report.summary.thresholdFailed} | ${report.summary.noOp} | ${report.summary.errors} |`,
    '',
    '## Packages',
    '',
    '| Package | Path | Status | Score | Killed | Survived | No coverage | Reasons | Message | Report |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |',
    ...report.packages.map(packageRow),
    '',
    '## Warnings',
    '',
    ...(report.warnings.length > 0 ? report.warnings.map((warning) => `- ${escapeMarkdown(warning)}`) : ['- None']),
    ''
  ].join('\n');
}

function workspaceStatus(summary: WorkspaceRunReport['summary']): WorkspaceRunReport['status'] {
  if (summary.errors > 0) {
    return 'workspace-error';
  }

  if (summary.thresholdFailed > 0) {
    return 'workspace-threshold-failed';
  }

  if (summary.passed === 0 && summary.noOp >= 0) {
    return 'workspace-no-op';
  }

  return 'workspace-passed';
}

function packageRow(result: WorkspacePackageRunResult): string {
  const score = result.summary?.mutationScore;
  const reportPath = result.paths?.report ? `\`${escapeMarkdown(result.paths.report)}\`` : '';
  const reasons = result.reasons.length > 0 ? result.reasons.map(escapeMarkdown).join('<br>') : '';
  const message = result.message ? escapeMarkdown(result.message) : '';

  return [
    escapeMarkdown(result.name ?? result.path),
    `\`${escapeMarkdown(result.path)}\``,
    result.status,
    score === undefined || score === null ? '' : score.toFixed(2),
    String(result.summary?.killed ?? ''),
    String(result.summary?.survived ?? ''),
    String(result.summary?.noCoverage ?? ''),
    reasons,
    message,
    reportPath
  ].join(' | ').replace(/^/, '| ').replace(/$/, ' |');
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
