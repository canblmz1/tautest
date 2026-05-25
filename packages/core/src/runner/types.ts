import type { CoveringTest, MutationLocation, MutationSummary, PackageJson, StrykerRunResult } from '../types';

export type MutationRunnerLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'unknown';

export type NormalizedMutationStatus =
  | 'killed'
  | 'survived'
  | 'noCoverage'
  | 'timeout'
  | 'compileError'
  | 'runtimeError'
  | 'ignored'
  | 'unknown';

export interface MutationRunnerMetadata {
  id: string;
  name: string;
  engineVersion?: string;
  language: MutationRunnerLanguage;
}

export interface MutationRunnerDetection {
  supported: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  limitations: NormalizedMutationLimitation[];
}

export interface NormalizedMutationLimitation {
  code: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface NormalizedMutant {
  id?: string;
  status: NormalizedMutationStatus;
  engineStatus?: string;
  filePath: string;
  line: number;
  column?: number;
  mutatorName: string;
  original?: string;
  replacement?: string;
  description?: string;
  location?: MutationLocation;
  coveringTests: CoveringTest[];
  engineMetadata?: Record<string, unknown>;
}

export interface NormalizedMutationReport {
  version: '1';
  runner: MutationRunnerMetadata;
  scope: {
    baseRef?: string;
    changedFiles: string[];
    mutatedFiles: string[];
    packageName?: string;
  };
  summary: {
    mutationScore: number | null;
    total: number;
    killed: number;
    survived: number;
    noCoverage: number;
    timeout: number;
    runtimeError: number;
    compileError: number;
    ignored: number;
  };
  mutants: NormalizedMutant[];
  limitations: NormalizedMutationLimitation[];
  engineMetadata?: Record<string, unknown>;
}

export interface MutationRunnerProjectContext {
  rootDir: string;
  packageJson?: PackageJson | null;
  files?: string[];
}

export interface MutationRunnerPlugin<TPlan = unknown, TRunResult = StrykerRunResult> {
  id: string;
  displayName: string;
  languages: MutationRunnerLanguage[];
  detect(context: MutationRunnerProjectContext): MutationRunnerDetection;
  buildPlan?(input: unknown): TPlan;
  run?(plan: TPlan): Promise<TRunResult>;
  parseReport(input: unknown): NormalizedMutationReport;
  explainLimitations?(context: MutationRunnerProjectContext): NormalizedMutationLimitation[];
}

export interface NormalizedReportInput {
  summary: MutationSummary;
  runner: MutationRunnerMetadata;
  scope?: Partial<NormalizedMutationReport['scope']>;
  limitations?: NormalizedMutationLimitation[];
  engineMetadata?: Record<string, unknown>;
}
