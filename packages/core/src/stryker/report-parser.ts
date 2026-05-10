import { readFileSync } from 'node:fs';
import type { CoveringTest, MutationLocation, MutationSummary, StrykerReportMetadata, SurvivingMutant } from '../types';

interface StrykerMutationReport {
  schemaVersion?: string;
  thresholds?: unknown;
  projectRoot?: string;
  framework?: {
    name?: string;
    version?: string;
  };
  config?: {
    testRunner?: string;
    packageManager?: string;
    coverageAnalysis?: string;
    mutate?: string[];
    reporters?: string[];
  };
  files: Record<
    string,
    {
      source: string;
      mutants: StrykerMutant[];
    }
  >;
  testFiles?: Record<
    string,
    {
      tests?: Array<{
        id: string;
        name: string;
      }>;
    }
  >;
}

interface StrykerMutant {
  id?: string;
  status: string;
  mutatorName: string;
  replacement: string;
  description?: string;
  location: MutationLocation;
  coveredBy?: string[];
  killedBy?: string[];
}

export function readStrykerJsonReport(filePath: string): MutationSummary {
  return parseStrykerMutationReport(JSON.parse(readFileSync(filePath, 'utf8')) as StrykerMutationReport);
}

export function parseStrykerMutationReport(report: StrykerMutationReport): MutationSummary {
  const allMutants = flattenMutants(report);
  const killed = countStatus(allMutants, 'Killed');
  const survived = countStatus(allMutants, 'Survived');
  const noCoverage = countStatus(allMutants, 'NoCoverage');
  const timeout = countStatus(allMutants, 'Timeout');
  const runtimeError = countStatus(allMutants, 'RuntimeError');
  const compileError = countStatus(allMutants, 'CompileError');
  const ignored = countStatus(allMutants, 'Ignored');
  const total = allMutants.length;
  const scoreBase = killed + survived + noCoverage + timeout + runtimeError + compileError;
  const detected = killed + timeout;

  return {
    score: scoreBase === 0 ? null : (detected / scoreBase) * 100,
    total,
    killed,
    survived,
    noCoverage,
    timeout,
    runtimeError,
    compileError,
    ignored,
    survivingMutants: allMutants.filter((mutant) => mutant.status === 'Survived'),
    allMutants,
    stryker: extractStrykerMetadata(report)
  };
}

export function extractOriginal(source: string, location: MutationLocation): string {
  const sourceLines = source.split(/\r?\n/);
  const startLine = location.start.line;
  const endLine = location.end.line;
  const startColumn = Math.max(0, location.start.column - 1);
  const endColumn = Math.max(startColumn, location.end.column - 1);
  const firstLine = sourceLines[startLine - 1] ?? '';

  if (startLine === endLine) {
    return firstLine.slice(startColumn, endColumn).trim() || firstLine.trim();
  }

  const selected = sourceLines.slice(startLine - 1, endLine);
  selected[0] = selected[0]?.slice(startColumn) ?? '';
  selected[selected.length - 1] = selected.at(-1)?.slice(0, endColumn) ?? '';
  return selected.join('\n').trim();
}

function flattenMutants(report: StrykerMutationReport): SurvivingMutant[] {
  const testsById = buildTestsById(report);

  return Object.entries(report.files).flatMap(([filePath, file]) =>
    file.mutants.map((mutant) => ({
      id: mutant.id,
      filePath: toPosix(filePath),
      line: mutant.location.start.line,
      mutatorName: mutant.mutatorName,
      original: extractOriginal(file.source, mutant.location),
      replacement: mutant.replacement,
      status: mutant.status,
      description: mutant.description,
      location: mutant.location,
      coveredBy: mutant.coveredBy,
      killedBy: mutant.killedBy,
      coveringTests: (mutant.coveredBy ?? []).map((id) => testsById.get(id) ?? { id, name: `Unknown test ${id}`, filePath: 'unknown' })
    }))
  );
}

function buildTestsById(report: StrykerMutationReport): Map<string, CoveringTest> {
  const testsById = new Map<string, CoveringTest>();

  for (const [filePath, testFile] of Object.entries(report.testFiles ?? {})) {
    for (const test of testFile.tests ?? []) {
      testsById.set(test.id, {
        id: test.id,
        name: test.name,
        filePath: toPosix(filePath)
      });
    }
  }

  return testsById;
}

function extractStrykerMetadata(report: StrykerMutationReport): StrykerReportMetadata {
  return {
    schemaVersion: report.schemaVersion,
    projectRoot: report.projectRoot,
    frameworkName: report.framework?.name,
    frameworkVersion: report.framework?.version,
    thresholds: report.thresholds,
    config: {
      testRunner: report.config?.testRunner,
      packageManager: report.config?.packageManager,
      coverageAnalysis: report.config?.coverageAnalysis,
      mutate: report.config?.mutate,
      reporters: report.config?.reporters
    }
  };
}

function countStatus(mutants: SurvivingMutant[], status: string): number {
  return mutants.filter((mutant) => mutant.status === status).length;
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}
