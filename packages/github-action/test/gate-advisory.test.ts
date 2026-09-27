import { describe, expect, it } from 'vitest';
import { buildStepSummary } from '../src/summary';
import { buildPrComment } from '../src/pr-comment';
import { describeGateAdvisory } from '../src/gate-advisory';

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
