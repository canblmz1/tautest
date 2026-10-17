import { describe, expect, it } from 'vitest';
import { groupReviewMutants, validateStrykerReviewReport } from '../src/report/review';
import { parseStrykerMutationReport } from '../src/stryker/report-parser';

function report() {
  return { files: { 'src/a.js': { source: 'a >= 1', mutants: [
    { id: '0', status: 'Survived', mutatorName: 'EqualityOperator', replacement: 'a > 1', testsCompleted: 1,
      location: { start: { line: 1, column: 1 }, end: { line: 1, column: 7 } } },
    { id: '1', status: 'NoCoverage', mutatorName: 'ConditionalExpression', replacement: 'true',
      location: { start: { line: 1, column: 1 }, end: { line: 1, column: 7 } } }
  ] } } };
}

describe('imported Stryker reports', () => {
  it('validates source spans and ids without evaluating configuration', () => {
    const input = { ...report(), config: { testRunner: 'vitest', command: 'never execute this' } };
    expect(validateStrykerReviewReport(input)).toEqual(input);
    const invalid = report();
    invalid.files['src/a.js'].mutants[0].location.end.column = 100;
    expect(() => validateStrykerReviewReport(invalid)).toThrow('Invalid source location');
    const duplicates = report();
    duplicates.files['src/a.js'].mutants[1].id = '0';
    expect(() => validateStrykerReviewReport(duplicates)).toThrow('Duplicate mutant');
    expect(() => validateStrykerReviewReport({ files: { a: {} } })).toThrow();
  });

  it('retains the zero-executed-tests integrity check', () => {
    const input = report();
    input.files['src/a.js'].mutants[0].testsCompleted = 0;
    expect(() => validateStrykerReviewReport(input)).toThrow('executed 0 tests');
  });

  it('groups shared expressions and expires manual judgments without changing raw statuses', () => {
    const summary = parseStrykerMutationReport(report());
    const [group] = groupReviewMutants(summary.allMutants, 'context-a');
    expect(group.mutants).toHaveLength(2);
    const note = { groupId: group.id, contextHash: 'context-a', decision: 'equivalent' as const, reason: 'manual explanation', reviewedAt: 'now' };
    expect(groupReviewMutants(summary.allMutants, 'context-a', [note])[0].review).toEqual(note);
    const stale = groupReviewMutants(summary.allMutants, 'context-b', [note])[0];
    expect(stale).toMatchObject({ review: null, staleReview: true });
    expect(stale.mutants.map(m => m.status)).toEqual(['Survived', 'NoCoverage']);
    expect(groupReviewMutants(summary.allMutants, null, [note])[0].review).toBeNull();
    expect(summary.score).toBe(0);
  });
});
