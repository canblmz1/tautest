import type { MutationSummary, SurvivingMutant } from '../types';
import type { NormalizedMutant, NormalizedMutationReport, NormalizedMutationStatus, NormalizedReportInput } from '../runner/types';

export function normalizeMutationSummary(input: NormalizedReportInput): NormalizedMutationReport {
  const mutants = input.summary.allMutants.map(normalizeMutant);

  return {
    version: '1',
    runner: input.runner,
    scope: {
      baseRef: input.scope?.baseRef,
      changedFiles: input.scope?.changedFiles ?? [],
      mutatedFiles: input.scope?.mutatedFiles ?? uniqueFiles(mutants),
      packageName: input.scope?.packageName
    },
    summary: {
      mutationScore: input.summary.score,
      total: input.summary.total,
      killed: input.summary.killed,
      survived: input.summary.survived,
      noCoverage: input.summary.noCoverage,
      timeout: input.summary.timeout,
      runtimeError: input.summary.runtimeError,
      compileError: input.summary.compileError,
      ignored: input.summary.ignored
    },
    mutants,
    limitations: input.limitations ?? [],
    engineMetadata: input.engineMetadata
  };
}

export function mutationSummaryFromNormalized(report: NormalizedMutationReport): MutationSummary {
  const allMutants = report.mutants.map(denormalizeMutant);

  return {
    score: report.summary.mutationScore,
    total: report.summary.total,
    killed: report.summary.killed,
    survived: report.summary.survived,
    noCoverage: report.summary.noCoverage,
    timeout: report.summary.timeout,
    runtimeError: report.summary.runtimeError,
    compileError: report.summary.compileError,
    ignored: report.summary.ignored,
    survivingMutants: allMutants.filter((mutant) => mutant.status === 'Survived' || mutant.status === 'NoCoverage'),
    allMutants,
    stryker: report.runner.id === 'stryker-js' ? { frameworkName: report.runner.name, frameworkVersion: report.runner.engineVersion } : null
  };
}

export function mapEngineStatus(status: string | undefined): NormalizedMutationStatus {
  const normalized = (status ?? '').replace(/[\s_-]+/g, '').toLowerCase();

  if (normalized === 'killed') {
    return 'killed';
  }

  if (normalized === 'survived' || normalized === 'survivor') {
    return 'survived';
  }

  if (normalized === 'nocoverage' || normalized === 'notcovered') {
    return 'noCoverage';
  }

  if (normalized === 'timeout' || normalized === 'timedout') {
    return 'timeout';
  }

  if (normalized === 'compileerror' || normalized === 'nonviable') {
    return 'compileError';
  }

  if (normalized === 'runtimeerror' || normalized === 'runerror' || normalized === 'memoryerror') {
    return 'runtimeError';
  }

  if (normalized === 'ignored' || normalized === 'skipped') {
    return 'ignored';
  }

  return 'unknown';
}

function normalizeMutant(mutant: SurvivingMutant): NormalizedMutant {
  return {
    id: mutant.id,
    status: mapEngineStatus(mutant.status),
    engineStatus: mutant.status,
    filePath: mutant.filePath,
    line: mutant.line,
    column: mutant.location.start.column,
    mutatorName: mutant.mutatorName,
    original: mutant.original,
    replacement: mutant.replacement,
    description: mutant.description,
    location: mutant.location,
    coveringTests: mutant.coveringTests ?? [],
    engineMetadata: {
      coveredBy: mutant.coveredBy,
      killedBy: mutant.killedBy
    }
  };
}

function denormalizeMutant(mutant: NormalizedMutant): SurvivingMutant {
  const line = Math.max(1, mutant.line);
  const column = Math.max(0, mutant.column ?? 0);

  return {
    id: mutant.id,
    filePath: mutant.filePath,
    line,
    mutatorName: mutant.mutatorName,
    original: mutant.original ?? 'unknown',
    replacement: mutant.replacement ?? 'unknown',
    status: legacyStatus(mutant),
    description: mutant.description,
    location: mutant.location ?? {
      start: { line, column },
      end: { line, column }
    },
    coveringTests: mutant.coveringTests
  };
}

function legacyStatus(mutant: NormalizedMutant): string {
  if (mutant.engineStatus) {
    return mutant.engineStatus;
  }

  switch (mutant.status) {
    case 'killed':
      return 'Killed';
    case 'survived':
      return 'Survived';
    case 'noCoverage':
      return 'NoCoverage';
    case 'timeout':
      return 'Timeout';
    case 'compileError':
      return 'CompileError';
    case 'runtimeError':
      return 'RuntimeError';
    case 'ignored':
      return 'Ignored';
    default:
      return 'Unknown';
  }
}

function uniqueFiles(mutants: NormalizedMutant[]): string[] {
  return [...new Set(mutants.map((mutant) => mutant.filePath))].sort();
}
