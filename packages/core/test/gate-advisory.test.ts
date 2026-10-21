import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeGateAdvisory } from '../src/report/insights';
import { buildMarkdownReport } from '../src/report/markdown';
import { buildTerminalSummary } from '../src/report/terminal';
import { getMutationVerdict } from '../src/score/score';
import type { MutationSummary } from '../src/types';

// Shared with packages/github-action/test/gate-advisory.test.ts, which checks its hand-mirrored copy
// against the same table, so the two implementations cannot drift apart silently.
const parityVectors = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', 'gate-advisory-vectors.json'), 'utf8')) as Array<{
  input: Parameters<typeof describeGateAdvisory>[0];
  expected: string | null;
}>;

describe('describeGateAdvisory parity table', () => {
  it.each(parityVectors)('matches the shared expectation for %j', ({ input, expected }) => {
    expect(describeGateAdvisory(input)).toBe(expected);
  });
});

// Mirrors the real-world unjs/ohash#196 finding: 1 real survivor among 8 mutants (87.5%)
// still passed the default 60% threshold, and the old copy did not say a survivor remained.
function oneSurvivorEightMutants(): MutationSummary {
  return {
    score: 87.5,
    total: 8,
    killed: 7,
    survived: 1,
    noCoverage: 0,
    timeout: 0,
    runtimeError: 0,
    compileError: 0,
    ignored: 0,
    survivingMutants: [
      {
        filePath: 'src/hash.ts',
        line: 42,
        mutatorName: 'ConditionalExpression',
        original: 'if (skip) return',
        replacement: 'if (true) return',
        status: 'Survived',
        location: { start: { line: 42, column: 5 }, end: { line: 42, column: 22 } },
        coveringTests: []
      }
    ],
    allMutants: []
  };
}

describe('describeGateAdvisory', () => {
  it('flags a passing threshold that still has a real survivor', () => {
    const advisory = describeGateAdvisory({ score: 87.5, threshold: 60, survived: 1, noCoverage: 0 });

    expect(advisory).toContain('Threshold passed; 1 surviving mutant still needs review');
    expect(advisory).toContain('not automatically a missing test');
  });

  it('pluralizes and combines survived and noCoverage counts', () => {
    const advisory = describeGateAdvisory({ score: 90, threshold: 60, survived: 2, noCoverage: 3 });

    expect(advisory).toContain('2 surviving mutants and 3 uncovered mutants still need review');
  });

  it('says nothing when there is nothing actionable', () => {
    expect(describeGateAdvisory({ score: 100, threshold: 60, survived: 0, noCoverage: 0 })).toBeNull();
  });

  it('says nothing when the score is null, even with survivors and no threshold set, since pass/fail is unknown', () => {
    expect(describeGateAdvisory({ score: null, threshold: undefined, survived: 1, noCoverage: 0 })).toBeNull();
  });

  it('says nothing when the threshold was not met, since the failing verdict already covers it', () => {
    expect(describeGateAdvisory({ score: 40, threshold: 60, survived: 3, noCoverage: 0 })).toBeNull();
  });

  it.each([0, 87.5])('keeps a neutral review advisory without an evaluated threshold at score %s', (score) => {
    const advisory = describeGateAdvisory({ score, survived: 1, noCoverage: 0 });

    expect(advisory).toContain('No threshold was evaluated; 1 surviving mutant still needs review.');
    expect(advisory).toContain('not automatically a missing test');
    expect(advisory).not.toMatch(/Threshold passed|this patch|fully covered/);
  });
});

describe('gate advisory surfaces in reports', () => {
  it.each([0, 87.5])('keeps Markdown and terminal neutral without a threshold at score %s', (value) => {
    const summary = value === 0
      ? { ...oneSurvivorEightMutants(), score: 0, total: 1, killed: 0 }
      : oneSurvivorEightMutants();
    const score = getMutationVerdict(summary);

    for (const output of [buildMarkdownReport({ summary, score }), buildTerminalSummary(summary, score)]) {
      expect(output).toContain('No threshold was evaluated; 1 surviving mutant still needs review.');
      expect(output).not.toMatch(/Threshold passed|this patch|fully covered/);
    }
  });

  it('preserves a passed explicit zero threshold in Markdown and terminal', () => {
    const summary = { ...oneSurvivorEightMutants(), score: 0, total: 1, killed: 0 };
    const score = getMutationVerdict(summary);

    for (const output of [buildMarkdownReport({ summary, score, threshold: 0 }), buildTerminalSummary(summary, score, { threshold: 0 })]) {
      expect(output).toContain('Threshold passed; 1 surviving mutant still needs review');
      expect(output).not.toContain('No threshold was evaluated');
    }
  });

  it('appears in the terminal summary for a passing threshold with a real survivor', () => {
    const summary = oneSurvivorEightMutants();
    const score = getMutationVerdict(summary);

    const terminal = buildTerminalSummary(summary, score, { threshold: 60 });

    expect(score.verdict).toBe('STRONG');
    expect(terminal).toContain('Threshold passed; 1 surviving mutant still needs review');
  });

  it('appears as a blockquote in the markdown report', () => {
    const summary = oneSurvivorEightMutants();
    const score = getMutationVerdict(summary);

    const markdown = buildMarkdownReport({ summary, score, threshold: 60 });

    expect(markdown).toContain('> Threshold passed; 1 surviving mutant still needs review');
  });

  it('does not appear when nothing survived', () => {
    const summary: MutationSummary = { ...oneSurvivorEightMutants(), survived: 0, killed: 8, score: 100, survivingMutants: [] };
    const score = getMutationVerdict(summary);

    const terminal = buildTerminalSummary(summary, score, { threshold: 60 });

    expect(terminal).not.toContain('Threshold passed;');
  });
});
