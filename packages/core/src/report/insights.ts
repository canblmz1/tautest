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
      category: 'coverage',
      missingBehavior: `The code path around ${mutant.filePath}:${mutant.line} is not executed by the current test suite.`,
      whyThisMatters: 'This production branch was not executed by the current test suite, so behavior can change without any failing test.',
      suggestedTestIdea: `Add a focused test that calls the code path around ${mutant.filePath}:${mutant.line} and asserts the observable result.`
    };
  }

  // Must run before the text heuristics below: Stryker's ConditionalExpression mutator replaces a
  // condition with a `true`/`false` literal, which isBooleanMutation (and, for comparisons,
  // isBoundaryMutation) would otherwise claim, so this category was never reached.
  if (mutant.mutatorName === 'ConditionalExpression') {
    return {
      category: 'branch',
      missingBehavior: 'One branch direction may be forced without the current tests failing. Confirm both directions actually produce different observable results before treating this as a gap.',
      whyThisMatters:
        'A branch condition can be forced to true or false without the current tests noticing, but if both directions lead to the same observable outcome, this is an equivalent mutant rather than a gap.',
      suggestedTestIdea:
        'If the branch not currently taken changes the observable result, add one test for it and one nearby case for the other branch. If both directions behave the same, this is likely an equivalent mutant.'
    };
  }

  if (isBoundaryMutation(mutant)) {
    const boundary = findBoundaryValue(mutant.original, mutant.replacement);
    return {
      category: 'boundary',
      missingBehavior: boundary
        ? `The exact boundary value ${boundary} may not be protected by a test that distinguishes the original expression from the mutant. Confirm the two sides actually produce different results before treating this as a gap.`
        : 'The comparison boundary may not be protected by tests on both sides of the decision point. Confirm the two sides actually produce different results before treating this as a gap.',
      whyThisMatters:
        'A comparison boundary can move by one value while existing tests still pass, but some boundary shifts (for example a redundant guard) never change the observable result and are equivalent mutants rather than gaps.',
      suggestedTestIdea: boundary
        ? `If ${boundary} and its neighbor produce different observable results, add a boundary test for the exact value ${boundary}. If they behave the same either way, this is likely an equivalent mutant; consider a documented Stryker ignore instead of writing a test.`
        : 'If the two sides of the boundary produce different observable results, add tests for the exact boundary value and the nearest value on each side. If they behave the same, this is likely an equivalent mutant.'
    };
  }

  if (isBooleanMutation(mutant)) {
    return {
      category: 'boolean',
      missingBehavior: 'At least one true/false combination may not be asserted by the current tests. Confirm that combination actually changes the observable result before treating this as a gap.',
      whyThisMatters:
        'Boolean logic changed, which often means a truth-table case is missing from the tests, but some boolean mutations (for example flipping a condition that always evaluates the same way in practice) never change the observable result.',
      suggestedTestIdea:
        'If you can find inputs where the missing true/false combination changes the observable result, add a table-driven test for it. If it never changes the result, this is likely an equivalent mutant.'
    };
  }

  if (isArithmeticMutation(mutant)) {
    return {
      category: 'arithmetic',
      missingBehavior: 'A concrete numeric result may not be asserted strongly enough to catch this operator change. Confirm the two operators actually disagree for some real input.',
      whyThisMatters:
        'Arithmetic operator changes often keep types valid while producing subtly wrong business values, but some (for example on an input that is always 0 or 1) produce identical results and are equivalent mutants.',
      suggestedTestIdea:
        'If you can find concrete non-zero inputs where the original and replacement operator disagree, add an assertion with the exact expected numeric result. If they always agree, this is likely an equivalent mutant.'
    };
  }

  return {
    category: 'generic',
    missingBehavior: 'This mutant survived the current tests. It may point to a missing test, or it may be an equivalent mutant that does not change observable behavior.',
    whyThisMatters: 'A surviving mutant is not automatically a missing test — confirm the original and replacement code actually disagree on some observable output before treating this as a gap.',
    suggestedTestIdea:
      'If you can find an input where the original and replacement code produce different observable results, add the smallest assertion that passes on the original and fails on the replacement. If no such input exists, this is likely an equivalent mutant; consider a documented Stryker ignore instead of writing a test.'
  };
}

// Mirrored by hand in packages/github-action/src/gate-advisory.ts, which cannot depend on this
// package. Mirror any change there too, and vice versa.
export function describeGateAdvisory(input: { score: number | null; threshold?: number; survived: number; noCoverage: number }): string | null {
  const actionable = input.survived + input.noCoverage;

  if (actionable === 0 || input.score === null) {
    return null;
  }

  const thresholdPassed = input.threshold === undefined || input.score >= input.threshold;

  if (!thresholdPassed) {
    return null;
  }

  const parts = [
    input.survived > 0 ? `${input.survived} surviving mutant${input.survived === 1 ? '' : 's'}` : null,
    input.noCoverage > 0 ? `${input.noCoverage} uncovered mutant${input.noCoverage === 1 ? '' : 's'}` : null
  ].filter((part): part is string => part !== null);
  const verb = actionable === 1 ? 'needs' : 'need';

  return (
    `Threshold passed; ${parts.join(' and ')} still ${verb} review before treating this patch as fully covered. ` +
    'A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change.'
  );
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
