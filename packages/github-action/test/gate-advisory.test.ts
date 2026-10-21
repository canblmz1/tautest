import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildStepSummary } from '../src/summary';
import { buildPrComment } from '../src/pr-comment';
import { describeGateAdvisory } from '../src/gate-advisory';

// The same table checks @tautest/core's original, so this hand-mirrored copy cannot drift silently.
const parityVectors = JSON.parse(
  readFileSync(path.join(__dirname, '..', '..', 'core', 'test', 'fixtures', 'gate-advisory-vectors.json'), 'utf8')
) as Array<{ input: Parameters<typeof describeGateAdvisory>[0]; expected: string | null }>;

describe('describeGateAdvisory parity table (github-action)', () => {
  it.each(parityVectors)('matches the shared expectation for %j', ({ input, expected }) => {
    expect(describeGateAdvisory(input)).toBe(expected);
  });
});

// Mirrors the real-world unjs/ohash#196 finding: 1 real survivor among 8 mutants (87.5%)
// still passed the default 60% threshold without saying a survivor remained.
describe('describeGateAdvisory (github-action)', () => {
  it('flags a passing threshold that still has a real survivor', () => {
    expect(describeGateAdvisory({ score: 87.5, threshold: 60, survived: 1, noCoverage: 0 })).toContain(
      'Threshold passed; 1 surviving mutant still needs review'
    );
  });

  it('says nothing when the threshold was not met', () => {
    expect(describeGateAdvisory({ score: 40, threshold: 60, survived: 3, noCoverage: 0 })).toBeNull();
  });

  it('says nothing when the score is null, even with survivors and no threshold set', () => {
    expect(describeGateAdvisory({ score: null, threshold: undefined, survived: 1, noCoverage: 0 })).toBeNull();
  });

  it('also treats an absent Action score as unknown', () => {
    expect(describeGateAdvisory({ score: undefined, survived: 1, noCoverage: 0 })).toBeNull();
  });
});

describe('unevaluated threshold in Action outputs', () => {
  it.each([0, 87.5])('keeps comment and step summary neutral without a threshold at score %s', (score) => {
    const summary = { verdict: score === 0 ? 'WEAK' : 'STRONG', mutationScore: score, killed: score === 0 ? 0 : 7, survived: 1, noCoverage: 0 };
    const outputs = [
      buildPrComment({ ...summary, score, topMutants: [] }),
      buildStepSummary({ status: 'review', report: { summary, surviving: [] } })
    ];

    for (const output of outputs) {
      expect(output).toContain('No threshold was evaluated; 1 surviving mutant still needs review.');
      expect(output).not.toMatch(/Threshold passed|this patch as fully covered/);
    }
  });

  it('preserves an explicitly passed zero threshold in comment and step summary', () => {
    const summary = { verdict: 'WEAK', mutationScore: 0, killed: 0, survived: 1, noCoverage: 0 };
    const outputs = [
      buildPrComment({ ...summary, score: 0, threshold: 0, topMutants: [] }),
      buildStepSummary({ status: 'passed', threshold: 0, report: { summary, surviving: [] } })
    ];

    for (const output of outputs) {
      expect(output).toContain('Threshold passed; 1 surviving mutant still needs review');
      expect(output).not.toContain('No threshold was evaluated');
    }
  });
});

describe('PR comment gate advisory', () => {
  it('shows the advisory when the threshold passed but a survivor remains', () => {
    const comment = buildPrComment({
      score: 87.5,
      threshold: 60,
      verdict: 'STRONG',
      killed: 7,
      survived: 1,
      noCoverage: 0,
      topMutants: []
    });

    expect(comment).toContain('Threshold passed; 1 surviving mutant still needs review');
  });

  it('omits the advisory when there are no survivors', () => {
    const comment = buildPrComment({
      score: 100,
      threshold: 60,
      verdict: 'STRONG',
      killed: 8,
      survived: 0,
      noCoverage: 0,
      topMutants: []
    });

    expect(comment).not.toContain('Threshold passed;');
  });
});

describe('Step summary gate advisory', () => {
  it('shows the advisory when the threshold passed but a survivor remains', () => {
    const summary = buildStepSummary({
      status: 'passed',
      threshold: 60,
      report: {
        summary: { verdict: 'STRONG', mutationScore: 87.5, killed: 7, survived: 1, noCoverage: 0 },
        surviving: []
      }
    });

    expect(summary).toContain('Threshold passed; 1 surviving mutant still needs review');
  });
});
