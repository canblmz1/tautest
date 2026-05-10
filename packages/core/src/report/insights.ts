import type { MutationInsight, ReportMutant, SurvivingMutant } from '../types';

export function enrichMutant(mutant: SurvivingMutant): ReportMutant {
  return {
    ...mutant,
    coveringTests: mutant.coveringTests ?? [],
    insight: buildMutationInsight(mutant)
  };
}

export function enrichMutants(mutants: SurvivingMutant[]): ReportMutant[] {
  return mutants.map(enrichMutant);
}

export function buildMutationInsight(mutant: SurvivingMutant): MutationInsight {
  if (mutant.status === 'NoCoverage') {
    return {
      whyThisMatters: 'This production branch was not executed by the current test suite, so behavior can change without any failing test.',
      suggestedTestIdea: `Add a focused test that calls the code path around ${mutant.filePath}:${mutant.line} and asserts the observable result.`
    };
  }

  if (isBoundaryMutation(mutant)) {
    const boundary = findBoundaryValue(mutant.original, mutant.replacement);
    return {
      whyThisMatters: 'A comparison boundary can move by one value while existing tests still pass.',
      suggestedTestIdea: boundary
        ? `Add a boundary test for the exact value ${boundary} and assert the expected behavior before and after that boundary.`
        : 'Add tests for the exact boundary value and the nearest value on each side.'
    };
  }

  if (isBooleanMutation(mutant)) {
    return {
      whyThisMatters: 'Boolean logic changed, which usually means one truth-table case is missing from the tests.',
      suggestedTestIdea: 'Add a table-driven test covering the missing true/false combination that distinguishes the original expression from the mutant.'
    };
  }

  if (isArithmeticMutation(mutant)) {
    return {
      whyThisMatters: 'Arithmetic operator changes often keep types valid while producing subtly wrong business values.',
      suggestedTestIdea: 'Add an assertion with concrete non-zero inputs and the exact expected numeric result.'
    };
  }

  if (mutant.mutatorName === 'ConditionalExpression') {
    return {
      whyThisMatters: 'A branch condition can be forced to true or false without the current tests noticing.',
      suggestedTestIdea: 'Add one test for the branch that should be taken and one nearby case for the branch that should not be taken.'
    };
  }

  return {
    whyThisMatters: 'The mutant survived, so the current tests do not fully specify this observable behavior.',
    suggestedTestIdea: 'Add the smallest behavior-focused assertion that would pass on the original code and fail on this replacement.'
  };
}

function isBoundaryMutation(mutant: SurvivingMutant): boolean {
  return mutant.mutatorName === 'EqualityOperator' || /[<>]=?/.test(mutant.original) || /[<>]=?/.test(mutant.replacement);
}

function isBooleanMutation(mutant: SurvivingMutant): boolean {
  return /Boolean|Logical/i.test(mutant.mutatorName) || /&&|\|\||\btrue\b|\bfalse\b/.test(`${mutant.original} ${mutant.replacement}`);
}

function isArithmeticMutation(mutant: SurvivingMutant): boolean {
  return /Arithmetic/i.test(mutant.mutatorName) || /[+\-*/%]/.test(mutant.original) || /[+\-*/%]/.test(mutant.replacement);
}

function findBoundaryValue(...values: string[]): string | null {
  for (const value of values) {
    const match = value.match(/[<>]=?\s*(-?\d+(?:\.\d+)?)/);

    if (match) {
      return match[1];
    }
  }

  return null;
}
