import { describe, expect, it } from 'vitest';
import { getMutationVerdict } from '../src/score/score';
import { parseStrykerMutationReport } from '../src/stryker/report-parser';

function reportWith(statuses: string[]) {
  return {
    files: {
      'src/example.ts': {
        source: 'return true;',
        mutants: statuses.map((status, index) => ({
          id: String(index),
          status,
          mutatorName: 'BooleanLiteral',
          replacement: 'false',
          location: { start: { line: 1, column: 8 }, end: { line: 1, column: 12 } },
          testsCompleted: 1
        }))
      }
    }
  };
}

// https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/
describe('Stryker valid-mutant score contract', () => {
  it.each([
    { status: 'Killed', score: 100 },
    { status: 'Timeout', score: 100 },
    { status: 'Survived', score: 0 },
    { status: 'NoCoverage', score: 0 },
    { status: 'RuntimeError', score: null },
    { status: 'CompileError', score: null },
    { status: 'Ignored', score: null },
    { status: 'Pending', score: null }
  ])('scores $status according to its documented state', ({ status, score }) => {
    expect(parseStrykerMutationReport(reportWith([status])).score).toBe(score);
  });

  it('excludes invalid mutants without dropping their diagnostics or total count', () => {
    expect(parseStrykerMutationReport(reportWith(['Killed', 'RuntimeError', 'CompileError']))).toMatchObject({
      score: 100,
      total: 3,
      killed: 1,
      runtimeError: 1,
      compileError: 1
    });
  });

  it('counts detected and undetected valid states while excluding invalid, ignored and pending states', () => {
    const summary = parseStrykerMutationReport(reportWith([
      'Killed', 'Timeout', 'Survived', 'NoCoverage', 'RuntimeError', 'CompileError', 'Ignored', 'Pending'
    ]));
    expect(summary.score).toBe(50);
    expect(summary.total).toBe(8);
    expect(summary.ignored).toBe(1);
  });

  it.each([{ statuses: [] }, { statuses: ['RuntimeError', 'CompileError'] }])('keeps an undefined score and UNKNOWN verdict when no valid mutants exist: $statuses', ({ statuses }) => {
    const summary = parseStrykerMutationReport(reportWith(statuses));
    expect(summary.score).toBeNull();
    expect(getMutationVerdict(summary).verdict).toBe('UNKNOWN');
  });
});
