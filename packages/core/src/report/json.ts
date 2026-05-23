import type {
  AiAuthorDetection,
  MutationSummary,
  PromptStyle,
  RunMetrics,
  ScoreResult,
  StrykerConfigDiagnostic,
  StrykerReportMetadata,
  SurvivingMutant,
  TautestJsonReport,
  TestRunner
} from '../types';
import { enrichMutants } from './insights';

export const REPORT_SCHEMA_VERSION = '1';
export const PROMPT_HARD_RULES = [
  'Do not change production code.',
  'Only edit or add test files.',
  'Every new test must pass against the original production code.',
  'Every new test must fail against the listed mutant behavior.',
  'Do not weaken existing assertions.',
  'Do not delete, skip, or mark existing tests as todo.',
  'Do not write filler tests such as expect(true).toBe(true).',
  'Do not add new dependencies.',
  'If you find a real production bug, stop and report it instead of silently rewriting implementation.'
];

export const PROMPT_VALIDATION_LOOP = [
  'Run the normal test suite.',
  'Run Tautest again.',
  'Confirm the mutation score increased or stayed strong while the listed mutant was killed.',
  'If the score does not improve or the mutant still survives, reread the prompt and adjust the test instead of changing production code.'
];

export function buildJsonReport(input: {
  summary: MutationSummary;
  score: ScoreResult;
  topMutants: SurvivingMutant[];
  createdAt?: Date;
  threshold?: number;
  scope?: {
    baseRef?: string;
    runner?: TestRunner;
    mutatePatterns?: string[];
    mutatedFiles?: string[];
  };
  metrics?: RunMetrics;
  diagnostics?: {
    strykerConfig?: StrykerConfigDiagnostic[];
  };
  aiSignals?: {
    promptStyle?: PromptStyle;
    author?: AiAuthorDetection;
    commands?: string[];
    hardRules?: string[];
    validationLoop?: string[];
  };
  stryker?: StrykerReportMetadata | null;
}): TautestJsonReport {
  const hardRules = input.aiSignals?.hardRules ?? PROMPT_HARD_RULES;
  const validationLoop = input.aiSignals?.validationLoop ?? PROMPT_VALIDATION_LOOP;

  return {
    version: REPORT_SCHEMA_VERSION,
    schemaVersion: REPORT_SCHEMA_VERSION,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    summary: {
      verdict: input.score.verdict,
      mutationScore: input.summary.score,
      threshold: input.threshold,
      total: input.summary.total,
      killed: input.summary.killed,
      survived: input.summary.survived,
      noCoverage: input.summary.noCoverage,
      timeout: input.summary.timeout,
      runtimeError: input.summary.runtimeError,
      compileError: input.summary.compileError,
      ignored: input.summary.ignored
    },
    scope: {
      baseRef: input.scope?.baseRef,
      runner: input.scope?.runner,
      mutatePatterns: input.scope?.mutatePatterns ?? [],
      mutatedFiles: input.scope?.mutatedFiles ?? uniqueFiles(input.topMutants)
    },
    metrics: input.metrics,
    diagnostics: {
      strykerConfig: input.diagnostics?.strykerConfig ?? []
    },
    aiSignals: {
      promptStyle: input.aiSignals?.promptStyle ?? 'agent',
      author: input.aiSignals?.author,
      hardRules,
      validationLoop,
      commands: input.aiSignals?.commands ?? []
    },
    surviving: enrichMutants(input.topMutants),
    stryker: input.stryker ?? input.summary.stryker ?? null
  };
}

function uniqueFiles(mutants: SurvivingMutant[]): string[] {
  return [...new Set(mutants.map((mutant) => mutant.filePath))].sort();
}
