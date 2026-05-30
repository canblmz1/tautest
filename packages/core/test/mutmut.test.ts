import { describe, it, expect } from 'vitest';
import { normalizeMutmutAlphaReport, createMutmutAlphaRunnerPlugin } from '../src/runner/mutmut';

describe('mutmut alpha report normalizer', () => {
  it('returns empty report for empty mutants array', () => {
    const report = normalizeMutmutAlphaReport({ mutants: [] });

    expect(report.mutants).toHaveLength(0);
    expect(report.summary.total).toBe(0);
    expect(report.summary.mutationScore).toBeNull();
    expect(report.runner.id).toBe('mutmut-alpha');
    expect(report.runner.language).toBe('python');
  });

  it('normalizes a killed mutant with all fields', () => {
    const report = normalizeMutmutAlphaReport({
      version: '2.3.0',
      mutants: [
        {
          id: '1',
          status: 'KILLED',
          filePath: 'src/discount.py',
          line: 12,
          mutatorName: 'AOD',
          original: '+',
          replacement: '-'
        }
      ]
    });

    expect(report.mutants[0]!.status).toBe('killed');
    expect(report.mutants[0]!.id).toBe('1');
    expect(report.mutants[0]!.filePath).toBe('src/discount.py');
    expect(report.mutants[0]!.line).toBe(12);
    expect(report.mutants[0]!.original).toBe('+');
    expect(report.mutants[0]!.replacement).toBe('-');
    expect(report.runner.engineVersion).toBe('2.3.0');
    expect(report.summary.killed).toBe(1);
  });

  it('normalizes a survived mutant and computes score', () => {
    const report = normalizeMutmutAlphaReport({
      mutants: [
        { status: 'SURVIVED', filePath: 'src/a.py', line: 1 },
        { status: 'KILLED', filePath: 'src/a.py', line: 2 }
      ]
    });

    expect(report.summary.survived).toBe(1);
    expect(report.summary.killed).toBe(1);
    expect(report.summary.mutationScore).toBeCloseTo(50);
  });

  it('defaults mutatorName to mutmut when not provided', () => {
    const report = normalizeMutmutAlphaReport({
      mutants: [{ status: 'SURVIVED', filePath: 'src/b.py', line: 5 }]
    });

    expect(report.mutants[0]!.mutatorName).toBe('mutmut');
  });

  it('sets coveringTests to empty array', () => {
    const report = normalizeMutmutAlphaReport({
      mutants: [{ status: 'KILLED', filePath: 'src/c.py', line: 3 }]
    });

    expect(report.mutants[0]!.coveringTests).toEqual([]);
  });

  it('sets engineMetadata source to mutmut-alpha', () => {
    const report = normalizeMutmutAlphaReport({ mutants: [] });

    expect(report.engineMetadata).toMatchObject({ source: 'mutmut-alpha' });
  });

  it('includes alpha limitations in result', () => {
    const report = normalizeMutmutAlphaReport({ mutants: [] });

    expect(report.limitations.some((l) => l.code === 'python-alpha-parser-only')).toBe(true);
    expect(report.limitations.some((l) => l.code === 'python-no-line-scope-guarantee')).toBe(true);
  });

  it('mutates scope.mutatedFiles to unique file list', () => {
    const report = normalizeMutmutAlphaReport({
      mutants: [
        { status: 'KILLED', filePath: 'src/a.py', line: 1 },
        { status: 'SURVIVED', filePath: 'src/a.py', line: 2 },
        { status: 'KILLED', filePath: 'src/b.py', line: 1 }
      ]
    });

    expect(report.scope.mutatedFiles).toEqual(['src/a.py', 'src/b.py']);
  });
});

describe('createMutmutAlphaRunnerPlugin', () => {
  it('detects Python project from pyproject.toml', () => {
    const plugin = createMutmutAlphaRunnerPlugin();
    const detection = plugin.detect({ rootDir: '/fake', files: ['pyproject.toml', 'src/main.py'] });

    expect(detection.supported).toBe(true);
    expect(detection.confidence).toBe('medium');
  });

  it('detects Python project from requirements.txt', () => {
    const plugin = createMutmutAlphaRunnerPlugin();
    const detection = plugin.detect({ rootDir: '/fake', files: ['requirements.txt'] });

    expect(detection.supported).toBe(true);
  });

  it('detects Python project from setup.py', () => {
    const plugin = createMutmutAlphaRunnerPlugin();
    const detection = plugin.detect({ rootDir: '/fake', files: ['setup.py', 'tests/test_main.py'] });

    expect(detection.supported).toBe(true);
  });

  it('returns not supported for non-Python projects', () => {
    const plugin = createMutmutAlphaRunnerPlugin();
    const detection = plugin.detect({ rootDir: '/fake', files: ['package.json', 'src/app.ts'] });

    expect(detection.supported).toBe(false);
    expect(detection.confidence).toBe('low');
  });

  it('returns not supported when files list is empty', () => {
    const plugin = createMutmutAlphaRunnerPlugin();
    const detection = plugin.detect({ rootDir: '/fake', files: [] });

    expect(detection.supported).toBe(false);
  });

  it('returns not supported when files list is absent', () => {
    const plugin = createMutmutAlphaRunnerPlugin();
    const detection = plugin.detect({ rootDir: '/fake' });

    expect(detection.supported).toBe(false);
  });

  it('parses report via parseReport', () => {
    const plugin = createMutmutAlphaRunnerPlugin();
    const report = plugin.parseReport({ mutants: [] } as Parameters<typeof plugin.parseReport>[0]);

    expect(report.runner.id).toBe('mutmut-alpha');
  });

  it('returns limitations from explainLimitations', () => {
    const plugin = createMutmutAlphaRunnerPlugin();
    const limitations = plugin.explainLimitations!({ rootDir: '/fake' });

    expect(limitations.length).toBeGreaterThan(0);
    expect(limitations[0]!.severity).toBe('warning');
  });
});
