import type { MutationSummary, ScoreResult, ScoreThresholds, SurvivingMutant } from '../types';

export const DEFAULT_SCORE_THRESHOLDS: ScoreThresholds = {
  strong: 80,
  mixed: 60
};

const STATUS_PRIORITY = new Map<string, number>([
  ['Survived', 0],
  ['NoCoverage', 1],
  ['Timeout', 2],
  ['RuntimeError', 3],
  ['CompileError', 4],
  ['Killed', 5],
  ['Ignored', 6]
]);

export function getMutationVerdict(summary: MutationSummary, thresholds: ScoreThresholds = DEFAULT_SCORE_THRESHOLDS): ScoreResult {
  if (summary.score === null || summary.total === 0) {
    return {
      verdict: 'UNKNOWN',
      score: summary.score,
      reason: 'No scorable mutants were found.'
    };
  }

  if (summary.score >= thresholds.strong) {
    return {
      verdict: 'STRONG',
      score: summary.score,
      reason: `Mutation score is at or above the strong threshold (${thresholds.strong}).`
    };
  }

  if (summary.score >= thresholds.mixed) {
    return {
      verdict: 'MIXED',
      score: summary.score,
      reason: `Mutation score is between mixed (${thresholds.mixed}) and strong (${thresholds.strong}) thresholds.`
    };
  }

  return {
    verdict: 'WEAK',
    score: summary.score,
    reason: `Mutation score is below the mixed threshold (${thresholds.mixed}).`
  };
}

export function selectTopMutants(mutants: SurvivingMutant[], max = 10): SurvivingMutant[] {
  return [...mutants]
    .sort((a, b) => statusPriority(a.status) - statusPriority(b.status) || a.filePath.localeCompare(b.filePath) || a.line - b.line)
    .slice(0, max);
}

export function getActionableMutants(summary: MutationSummary): SurvivingMutant[] {
  return summary.allMutants.filter((mutant) => mutant.status === 'Survived' || mutant.status === 'NoCoverage');
}

function statusPriority(status: string): number {
  return STATUS_PRIORITY.get(status) ?? 99;
}
