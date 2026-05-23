import type { PartialStrykerOptions } from '@stryker-mutator/api/core';

export type TestRunner = 'vitest' | 'jest';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type ChangedFileStatus = 'added' | 'modified' | 'renamed' | 'deleted' | 'binary';

export type MutationVerdict = 'STRONG' | 'MIXED' | 'WEAK' | 'UNKNOWN';

export type PromptStyle = 'agent' | 'human' | 'claude-code' | 'cursor' | 'codex' | 'opencode';

export interface ChangedRange {
  start: number;
  end: number;
}

export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: ChangedFileStatus;
  ranges: ChangedRange[];
  isSource: boolean;
  isTest: boolean;
  isBinary: boolean;
  warnings: string[];
}

export interface GitDiffOptions {
  cwd: string;
  baseRef: string;
  paths?: string[];
  relative?: boolean;
  sourceFileExtensions?: string[];
  testFilePattern?: RegExp;
}

export interface DiffParseOptions {
  sourceFileExtensions?: string[];
  testFilePattern?: RegExp;
}

export interface ProjectInfo {
  rootDir: string;
  packageJsonPath: string | null;
  packageJson: PackageJson | null;
  hasTypeScript: boolean;
  vitestConfigFiles: string[];
  jestConfigFiles: string[];
  monorepo: {
    detected: boolean;
    signals: string[];
  };
  tsconfig: {
    path: string | null;
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

export interface PackageJson {
  name?: string;
  version?: string;
  packageManager?: string;
  workspaces?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface PackageManagerDetection {
  packageManager: PackageManager;
  reason: string;
  lockfile?: string;
}

export interface TestRunnerDetection {
  runner: TestRunner | null;
  reason: string;
  configFile?: string;
  candidates: TestRunner[];
}

export interface AiAuthorDetection {
  author: 'codex' | 'cursor' | 'claude' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface GenerateStrykerConfigOptions {
  mutate: string[];
  jsonReportPath: string;
  testRunner: TestRunner;
  packageManager?: PackageManager;
  incremental?: boolean;
  incrementalFile?: string;
  vitestConfigFile?: string;
  jestConfigFile?: string;
  userConfig?: PartialStrykerOptions;
  concurrency?: number | string;
  timeoutMS?: number;
  dryRunTimeoutMinutes?: number;
  tsconfigFile?: string;
}

export interface StrykerConfigDiagnostic {
  severity: 'warning';
  key: string;
  message: string;
  suggestion: string;
}

export interface RunMetrics {
  runtimeMs?: number;
  changedFileCount?: number;
  changedSourceFileCount?: number;
  changedSourceLineCount?: number;
  mutatedFileCount?: number;
  mutatePatternCount?: number;
  partial?: boolean;
  partialReason?: string;
}

export interface RunStrykerOptions {
  cwd: string;
  config: PartialStrykerOptions;
  jsonReportPath: string;
}

export interface StrykerRunResult {
  jsonReportPath: string;
  startedAt: Date;
  endedAt: Date;
}

export interface MutationLocation {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

export interface CoveringTest {
  id: string;
  name: string;
  filePath: string;
}

export interface MutationInsight {
  category: 'boundary' | 'boolean' | 'arithmetic' | 'branch' | 'coverage' | 'generic';
  missingBehavior: string;
  whyThisMatters: string;
  suggestedTestIdea: string;
}

export interface SurvivingMutant {
  id?: string;
  filePath: string;
  line: number;
  mutatorName: string;
  original: string;
  replacement: string;
  status: string;
  description?: string;
  location: MutationLocation;
  coveredBy?: string[];
  killedBy?: string[];
  coveringTests?: CoveringTest[];
}

export interface ReportMutant extends SurvivingMutant {
  coveringTests: CoveringTest[];
  insight: MutationInsight;
}

export interface StrykerReportMetadata {
  schemaVersion?: string;
  projectRoot?: string;
  frameworkName?: string;
  frameworkVersion?: string;
  config?: {
    testRunner?: string;
    packageManager?: string;
    coverageAnalysis?: string;
    mutate?: string[];
    reporters?: string[];
  };
  thresholds?: unknown;
}

export interface MutationSummary {
  score: number | null;
  total: number;
  killed: number;
  survived: number;
  noCoverage: number;
  timeout: number;
  runtimeError: number;
  compileError: number;
  ignored: number;
  survivingMutants: SurvivingMutant[];
  allMutants: SurvivingMutant[];
  stryker?: StrykerReportMetadata | null;
}

export interface ScoreThresholds {
  strong: number;
  mixed: number;
}

export interface ScoreResult {
  verdict: MutationVerdict;
  score: number | null;
  reason: string;
}

export interface TautestConfig {
  baseRef: string;
  outputDir: string;
  sourceFileExtensions: string[];
  rangeCoalesceGap: number;
  testRunner: TestRunner | 'auto';
  score: ScoreThresholds & {
    topMutants: number;
  };
  stryker: {
    incremental: boolean;
    incrementalFile?: string;
    timeoutMS: number;
    dryRunTimeoutMinutes: number;
    concurrency?: number | string;
    userConfig?: PartialStrykerOptions;
  };
  prompt: {
    maxMutants: number;
    style: PromptStyle;
  };
}

export type UserTautestConfig = Partial<{
  baseRef: string;
  outputDir: string;
  sourceFileExtensions: string[];
  rangeCoalesceGap: number;
  testRunner: TestRunner | 'auto';
  score: Partial<ScoreThresholds & { topMutants: number }>;
  stryker: Partial<TautestConfig['stryker']>;
  prompt: Partial<TautestConfig['prompt']>;
}>;

export interface TautestJsonReport {
  version: '1';
  schemaVersion: '1';
  createdAt: string;
  summary: {
    verdict: MutationVerdict;
    mutationScore: number | null;
    threshold?: number;
    total: number;
    killed: number;
    survived: number;
    noCoverage: number;
    timeout: number;
    runtimeError: number;
    compileError: number;
    ignored: number;
  };
  scope: {
    baseRef?: string;
    runner?: TestRunner;
    mutatePatterns: string[];
    mutatedFiles: string[];
  };
  metrics?: RunMetrics;
  diagnostics?: {
    strykerConfig: StrykerConfigDiagnostic[];
  };
  aiSignals: {
    promptStyle: PromptStyle;
    author?: AiAuthorDetection;
    hardRules: string[];
    validationLoop: string[];
    commands: string[];
  };
  surviving: ReportMutant[];
  stryker: StrykerReportMetadata | null;
}

export class TautestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'TautestError';
  }
}
