import type { TestRunner } from '../types';

export type ReliabilityReportKind = 'flakiness' | 'watch' | 'scaffold' | 'time-travel' | 'chaos';

export type ReliabilityFindingSeverity = 'info' | 'low' | 'medium' | 'high';

export type ReliabilityFindingCategory =
  | 'async-await'
  | 'real-time'
  | 'nondeterminism'
  | 'shared-state'
  | 'io'
  | 'network'
  | 'database'
  | 'dependency-graph'
  | 'scaffold'
  | 'time-travel'
  | 'chaos'
  | 'generic';

export interface ReliabilityFinding {
  id: string;
  category: ReliabilityFindingCategory;
  severity: ReliabilityFindingSeverity;
  confidence: 'low' | 'medium' | 'high';
  riskScore: number;
  filePath: string;
  line?: number;
  title: string;
  evidence: string;
  remediation: string;
  tags: string[];
}

export interface ReliabilityReport {
  version: '1';
  schemaVersion: '1';
  kind: ReliabilityReportKind;
  createdAt: string;
  summary: {
    riskScore: number;
    findingCount: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  scope: {
    rootDir: string;
    runner?: TestRunner | 'pytest' | 'unknown';
    files: string[];
  };
  findings: ReliabilityFinding[];
  metadata?: Record<string, unknown>;
}

export interface FlakinessAnalysisOptions {
  cwd: string;
  paths?: string[];
  runner?: TestRunner;
  createdAt?: Date;
}

export interface WatchSelectionOptions {
  cwd: string;
  changedFiles: string[];
  sourceExtensions?: string[];
  testPattern?: RegExp;
  createdAt?: Date;
}

export interface WatchSelectionReport extends ReliabilityReport {
  kind: 'watch';
  metadata: {
    changedFiles: string[];
    affectedTests: string[];
    graphNodeCount: number;
    commandHints: string[];
    warnings: string[];
  };
}

export type ScaffoldLanguage = 'javascript' | 'typescript' | 'python';

export type ScaffoldFramework = 'vitest' | 'jest' | 'pytest';

export interface ScaffoldOptions {
  cwd: string;
  filePath: string;
  language?: ScaffoldLanguage;
  framework?: ScaffoldFramework;
}

export interface ScaffoldResult {
  language: ScaffoldLanguage;
  framework: ScaffoldFramework;
  sourcePath: string;
  suggestedTestPath: string;
  code: string;
  detected: {
    functions: string[];
    asyncFunctions: string[];
    dependencies: string[];
  };
  warnings: string[];
}

export interface TimeTravelHelperOptions {
  runner: TestRunner;
}

export interface ChaosProfile {
  name: string;
  seed: number;
  latencyMs: {
    min: number;
    max: number;
  };
  errorRate: number;
}
