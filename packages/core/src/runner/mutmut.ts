import { mapEngineStatus } from '../report/normalize';
import type { MutationRunnerPlugin, NormalizedMutationReport, NormalizedMutant } from './types';

export interface MutmutAlphaReport {
  version?: string;
  mutants: Array<{
    id?: string;
    status: string;
    filePath: string;
    line: number;
    mutatorName?: string;
    original?: string;
    replacement?: string;
    description?: string;
  }>;
}

export function createMutmutAlphaRunnerPlugin(): MutationRunnerPlugin<never, never> {
  return {
    id: 'mutmut-alpha',
    displayName: 'mutmut alpha',
    languages: ['python'],
    detect(context) {
      const files = context.files ?? [];
      const hasPythonProject = files.some((file) => ['pyproject.toml', 'setup.cfg', 'setup.py', 'requirements.txt'].includes(file));

      return {
        supported: hasPythonProject,
        confidence: hasPythonProject ? 'medium' : 'low',
        reason: hasPythonProject ? 'Python project file detected.' : 'No Python project file detected.',
        limitations: pythonAlphaLimitations()
      };
    },
    parseReport(input): NormalizedMutationReport {
      return normalizeMutmutAlphaReport(input as MutmutAlphaReport);
    },
    explainLimitations: pythonAlphaLimitations
  };
}

export function normalizeMutmutAlphaReport(report: MutmutAlphaReport): NormalizedMutationReport {
  const mutants: NormalizedMutant[] = report.mutants.map((mutant) => ({
    id: mutant.id,
    status: mapEngineStatus(mutant.status),
    engineStatus: mutant.status,
    filePath: mutant.filePath,
    line: mutant.line,
    mutatorName: mutant.mutatorName ?? 'mutmut',
    original: mutant.original,
    replacement: mutant.replacement,
    description: mutant.description,
    coveringTests: [],
    engineMetadata: {
      source: 'mutmut-alpha'
    }
  }));

  return {
    version: '1',
    runner: {
      id: 'mutmut-alpha',
      name: 'mutmut alpha',
      engineVersion: report.version,
      language: 'python'
    },
    scope: {
      changedFiles: [],
      mutatedFiles: uniqueFiles(mutants)
    },
    summary: summarize(mutants),
    mutants,
    limitations: pythonAlphaLimitations(),
    engineMetadata: {
      source: 'mutmut-alpha'
    }
  };
}

function summarize(mutants: NormalizedMutant[]): NormalizedMutationReport['summary'] {
  const killed = mutants.filter((mutant) => mutant.status === 'killed').length;
  const survived = mutants.filter((mutant) => mutant.status === 'survived').length;
  const noCoverage = mutants.filter((mutant) => mutant.status === 'noCoverage').length;
  const timeout = mutants.filter((mutant) => mutant.status === 'timeout').length;
  const runtimeError = mutants.filter((mutant) => mutant.status === 'runtimeError').length;
  const compileError = mutants.filter((mutant) => mutant.status === 'compileError').length;
  const ignored = mutants.filter((mutant) => mutant.status === 'ignored').length;
  const total = mutants.length;

  return {
    mutationScore: total === ignored ? null : total === 0 ? null : (killed / Math.max(1, total - ignored)) * 100,
    total,
    killed,
    survived,
    noCoverage,
    timeout,
    runtimeError,
    compileError,
    ignored
  };
}

function pythonAlphaLimitations() {
  return [
    {
      code: 'python-alpha-parser-only',
      severity: 'warning' as const,
      message: 'mutmut support is an alpha parser prototype. Tautest does not run mutmut yet.'
    },
    {
      code: 'python-no-line-scope-guarantee',
      severity: 'warning' as const,
      message: 'Changed-line mutation scope is not guaranteed for Python alpha reports.'
    }
  ];
}

function uniqueFiles(mutants: NormalizedMutant[]): string[] {
  return [...new Set(mutants.map((mutant) => mutant.filePath))].sort();
}
