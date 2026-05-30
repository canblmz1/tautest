import { describe, expect, it } from 'vitest';
import { mapEngineStatus, mutationSummaryFromNormalized, normalizeMutationSummary } from '../src';

describe('mapEngineStatus', () => {
  it.each([
    ['Killed', 'killed'],
    ['killed', 'killed'],
    ['KILLED', 'killed'],
    ['Survived', 'survived'],
    ['survivor', 'survived'],
    ['NoCoverage', 'noCoverage'],
    ['NotCovered', 'noCoverage'],
    ['Timeout', 'timeout'],
    ['TimedOut', 'timeout'],
    ['CompileError', 'compileError'],
    ['NonViable', 'compileError'],
    ['RuntimeError', 'runtimeError'],
    ['RunError', 'runtimeError'],
    ['MemoryError', 'runtimeError'],
    ['Ignored', 'ignored'],
    ['Skipped', 'ignored']
  ] as const)('maps %s → %s', (input, expected) => {
    expect(mapEngineStatus(input)).toBe(expected);
  });

  it('returns unknown for unrecognized statuses', () => {
    expect(mapEngineStatus('pending')).toBe('unknown');
    expect(mapEngineStatus('weird-status-123')).toBe('unknown');
  });

  it('handles undefined gracefully', () => {
    expect(mapEngineStatus(undefined)).toBe('unknown');
  });

  it('handles empty string', () => {
    expect(mapEngineStatus('')).toBe('unknown');
  });
});

describe('normalizeMutationSummary round-trip', () => {
  const baseMutant = {
    id: '1',
    filePath: 'src/foo.ts',
    line: 5,
    mutatorName: 'EqualityOperator',
    original: 'a >= b',
    replacement: 'a > b',
    status: 'Survived',
    location: { start: { line: 5, column: 0 }, end: { line: 5, column: 10 } }
  };

  it('survives a normalize → denormalize round-trip', () => {
    const normalized = normalizeMutationSummary({
      runner: { id: 'stryker-js', name: 'Stryker.js', engineVersion: '9.0.0', language: 'typescript' },
      summary: {
        score: 50,
        total: 2,
        killed: 1,
        survived: 1,
        noCoverage: 0,
        timeout: 0,
        runtimeError: 0,
        compileError: 0,
        ignored: 0,
        allMutants: [baseMutant, { ...baseMutant, id: '2', status: 'Killed' }],
        survivingMutants: [baseMutant]
      }
    });

    const summary = mutationSummaryFromNormalized(normalized);

    expect(summary.score).toBe(50);
    expect(summary.killed).toBe(1);
    expect(summary.survived).toBe(1);
    expect(summary.survivingMutants).toHaveLength(1);
    expect(summary.survivingMutants[0]?.mutatorName).toBe('EqualityOperator');
  });

  it('handles missing optional fields with safe defaults', () => {
    const normalized = normalizeMutationSummary({
      runner: { id: 'stryker-js', name: 'Stryker.js', engineVersion: '9.0.0', language: 'typescript' },
      summary: {
        score: 100,
        total: 1,
        killed: 1,
        survived: 0,
        noCoverage: 0,
        timeout: 0,
        runtimeError: 0,
        compileError: 0,
        ignored: 0,
        allMutants: [{ ...baseMutant, original: undefined as unknown as string, replacement: undefined as unknown as string }],
        survivingMutants: []
      }
    });

    const summary = mutationSummaryFromNormalized(normalized);
    expect(summary.allMutants[0]?.original).toBe('unknown');
    expect(summary.allMutants[0]?.replacement).toBe('unknown');
  });
});
