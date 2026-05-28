import type { MutationSummary, RunMetrics, ScoreResult, StrykerConfigDiagnostic, SurvivingMutant, TestRunner } from '../types';
import { enrichMutant } from './insights';

export function buildTerminalSummary(
  summary: MutationSummary,
  score: ScoreResult,
  context: {
    threshold?: number;
    runner?: TestRunner;
    runtimeMs?: number;
    metrics?: RunMetrics;
    strykerConfigDiagnostics?: StrykerConfigDiagnostic[];
    mutatedFiles?: string[];
    topMutants?: SurvivingMutant[];
    reportPath?: string;
    jsonReportPath?: string;
    fixPromptPath?: string;
  } = {}
): string {
  const topMutants = context.topMutants?.slice(0, 3) ?? [];
  const diagnostics = context.strykerConfigDiagnostics ?? [];
  const lines = [
    `Tautest: ${score.verdict} (${formatScore(summary.score)}${context.threshold === undefined ? '' : `, threshold ${context.threshold.toFixed(2)}%`})`,
    [
      context.runner ? `Runner: ${context.runner}` : null,
      context.runtimeMs === undefined ? null : `Runtime: ${formatDuration(context.runtimeMs)}`,
      context.mutatedFiles ? `Files: ${context.mutatedFiles.length}` : null,
      context.metrics?.changedSourceLineCount === undefined ? null : `Changed lines: ${context.metrics.changedSourceLineCount}`,
      context.metrics?.mutatePatternCount === undefined ? null : `Mutate patterns: ${context.metrics.mutatePatternCount}`
    ]
      .filter(Boolean)
      .join(' | '),
    `Killed: ${summary.killed} | Survived: ${summary.survived} | No coverage: ${summary.noCoverage} | Timeout: ${summary.timeout}`
  ].filter(Boolean);

  if (context.metrics?.stageMs) {
    lines.push(formatStageTimings(context.metrics.stageMs));
  }

  if (diagnostics.length > 0) {
    lines.push('', 'Stryker config diagnostics:', ...diagnostics.slice(0, 3).map((diagnostic) => `- ${diagnostic.key}: ${diagnostic.message}`));
  }

  if (topMutants.length > 0) {
    lines.push('', 'Top surviving mutants:', ...topMutants.map(formatTopMutant));
  }

  if (context.fixPromptPath) {
    lines.push('', `Fix prompt: ${context.fixPromptPath}`);
  }

  if (context.reportPath) {
    lines.push(`Report: ${context.reportPath}`);
  }

  if (context.jsonReportPath) {
    lines.push(`JSON: ${context.jsonReportPath}`);
  }

  return lines.slice(0, 25).join('\n');
}

function formatTopMutant(mutant: SurvivingMutant): string {
  const enriched = enrichMutant(mutant);
  return `- ${mutant.filePath}:${mutant.line} ${mutant.mutatorName} - ${enriched.insight.missingBehavior}`;
}

function formatStageTimings(stageMs: NonNullable<RunMetrics['stageMs']>): string {
  const parts = [
    stageMs.scopeMs === undefined ? null : `scope ${formatDuration(stageMs.scopeMs)}`,
    stageMs.configMs === undefined ? null : `config ${formatDuration(stageMs.configMs)}`,
    stageMs.mutationMs === undefined ? null : `mutation ${formatDuration(stageMs.mutationMs)}`,
    stageMs.parseMs === undefined ? null : `parse ${formatDuration(stageMs.parseMs)}`,
    stageMs.reportMs === undefined ? null : `report ${formatDuration(stageMs.reportMs)}`
  ].filter(Boolean);

  return parts.length > 0 ? `Stages: ${parts.join(' | ')}` : 'Stages: unknown';
}

function formatScore(score: number | null): string {
  return score === null ? 'unknown' : `${score.toFixed(2)}%`;
}

function formatDuration(runtimeMs: number): string {
  return runtimeMs < 1000 ? `${runtimeMs}ms` : `${(runtimeMs / 1000).toFixed(1)}s`;
}
