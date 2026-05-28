import type { MutationSummary, RunMetrics, ScoreResult, StrykerConfigDiagnostic, SurvivingMutant, TestRunner } from '../types';
import { selectTopMutants } from '../score/score';
import { enrichMutants } from './insights';

export function buildMarkdownReport(input: {
  summary: MutationSummary;
  score: ScoreResult;
  mutatePatterns?: string[];
  mutatedFiles?: string[];
  topMutants?: SurvivingMutant[];
  threshold?: number;
  runner?: TestRunner;
  runtimeMs?: number;
  metrics?: RunMetrics;
  strykerConfigDiagnostics?: StrykerConfigDiagnostic[];
  title?: string;
}): string {
  const topMutants = input.topMutants ?? selectTopMutants(input.summary.survivingMutants, 10);
  const enrichedMutants = enrichMutants(topMutants);
  const mutatedFiles = input.mutatedFiles ?? uniqueFilesFromPatterns(input.mutatePatterns ?? []);
  const metrics = input.metrics;
  const diagnostics = input.strykerConfigDiagnostics ?? [];

  return [
    `# ${input.title ?? 'Tautest Mutation Report'}`,
    '',
    '## Summary',
    '',
    `- Verdict: **${input.score.verdict}**`,
    `- Mutation score: **${formatScore(input.summary.score)}**`,
    ...(input.threshold === undefined ? [] : [`- Threshold: **${input.threshold.toFixed(2)}%**`]),
    `- Killed: **${input.summary.killed}**`,
    `- Survived: **${input.summary.survived}**`,
    `- No coverage: **${input.summary.noCoverage}**`,
    ...(input.runner ? [`- Runner: **${input.runner}**`] : []),
    ...(input.runtimeMs === undefined ? [] : [`- Runtime: **${formatDuration(input.runtimeMs)}**`]),
    ...(metrics?.changedFileCount === undefined ? [] : [`- Changed files inspected: **${metrics.changedFileCount}**`]),
    ...(metrics?.changedSourceFileCount === undefined ? [] : [`- Changed production files: **${metrics.changedSourceFileCount}**`]),
    ...(metrics?.changedSourceLineCount === undefined ? [] : [`- Changed production lines: **${metrics.changedSourceLineCount}**`]),
    ...(metrics?.mutatePatternCount === undefined ? [] : [`- Stryker mutate patterns: **${metrics.mutatePatternCount}**`]),
    ...formatStageMetricBullets(metrics),
    `- Timeout: **${input.summary.timeout}**`,
    `- Runtime error: **${input.summary.runtimeError}**`,
    `- Compile error: **${input.summary.compileError}**`,
    '',
    ...(diagnostics.length
      ? ['## Stryker Config Diagnostics', '', ...diagnostics.map((diagnostic) => `- **${diagnostic.key}**: ${diagnostic.message} ${diagnostic.suggestion}`), '']
      : []),
    ...(mutatedFiles.length ? ['## Mutated Files', '', ...mutatedFiles.map((filePath) => `- \`${filePath}\``), ''] : []),
    ...(input.mutatePatterns?.length
      ? ['## Stryker Mutate Scope', '', ...input.mutatePatterns.map((pattern) => `- \`${pattern}\``), '']
      : []),
    '## Top Surviving Mutants',
    '',
    enrichedMutants.length > 0
      ? '| File | Line | Mutator | Original | Replacement |\n| --- | ---: | --- | --- | --- |\n' +
          enrichedMutants
            .map((mutant) => `| \`${mutant.filePath}\` | ${mutant.line} | ${cell(mutant.mutatorName)} | ${cell(mutant.original)} | ${cell(mutant.replacement)} |`)
            .join('\n')
      : 'No surviving mutants found.',
    '',
    ...(enrichedMutants.length > 0 ? ['## Mutant Details', '', ...enrichedMutants.map(formatMutantDetails)] : []),
    ''
  ].join('\n');
}

function formatScore(score: number | null): string {
  return score === null ? 'unknown' : `${score.toFixed(2)}%`;
}

function formatStageMetricBullets(metrics: RunMetrics | undefined): string[] {
  const stageMs = metrics?.stageMs;

  if (!stageMs) {
    return [];
  }

  return [
    ...(stageMs.scopeMs === undefined ? [] : [`- Scope stage: **${formatDuration(stageMs.scopeMs)}**`]),
    ...(stageMs.configMs === undefined ? [] : [`- Config stage: **${formatDuration(stageMs.configMs)}**`]),
    ...(stageMs.mutationMs === undefined ? [] : [`- Mutation stage: **${formatDuration(stageMs.mutationMs)}**`]),
    ...(stageMs.parseMs === undefined ? [] : [`- Parse stage: **${formatDuration(stageMs.parseMs)}**`]),
    ...(stageMs.reportMs === undefined ? [] : [`- Report stage: **${formatDuration(stageMs.reportMs)}**`])
  ];
}

function cell(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\|/g, '\\|').replace(/`/g, "'");
}

function formatMutantDetails(mutant: ReturnType<typeof enrichMutants>[number], index: number): string {
  return [
    `### ${index + 1}. \`${mutant.filePath}:${mutant.line}\` ${mutant.mutatorName}`,
    '',
    `- Status: **${mutant.status}**`,
    '- Original code:',
    '',
    fenced(mutant.original),
    '',
    '- Replacement code:',
    '',
    fenced(mutant.replacement),
    '',
    '- Covering tests:',
    ...formatCoveringTests(mutant.coveringTests),
    `- Category: ${mutant.insight.category}`,
    `- Likely missing behavior: ${mutant.insight.missingBehavior}`,
    `- Why this matters: ${mutant.insight.whyThisMatters}`,
    `- Suggested test idea: ${mutant.insight.suggestedTestIdea}`,
    ''
  ].join('\n');
}

function formatCoveringTests(tests: Array<{ filePath: string; name: string }>): string[] {
  if (tests.length === 0) {
    return ['  - None reported by Stryker.'];
  }

  return tests.map((test) => `  - \`${test.filePath}\` - ${test.name}`);
}

function fenced(value: string): string {
  return ['```ts', value, '```'].join('\n');
}

function formatDuration(runtimeMs: number): string {
  return runtimeMs < 1000 ? `${runtimeMs}ms` : `${(runtimeMs / 1000).toFixed(1)}s`;
}

function uniqueFilesFromPatterns(patterns: string[]): string[] {
  return [...new Set(patterns.map((pattern) => pattern.replace(/:\d+(?:-\d+)?$/, '')))].sort();
}
