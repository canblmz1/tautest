import type { MutationSummary, ScoreResult, SurvivingMutant, TestRunner } from '../types';
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
  title?: string;
}): string {
  const topMutants = input.topMutants ?? selectTopMutants(input.summary.survivingMutants, 10);
  const enrichedMutants = enrichMutants(topMutants);
  const mutatedFiles = input.mutatedFiles ?? uniqueFilesFromPatterns(input.mutatePatterns ?? []);

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
    `- Timeout: **${input.summary.timeout}**`,
    `- Runtime error: **${input.summary.runtimeError}**`,
    `- Compile error: **${input.summary.compileError}**`,
    '',
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
