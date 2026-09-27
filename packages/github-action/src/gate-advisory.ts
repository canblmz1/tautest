// Intentional duplicate of packages/core/src/report/insights.ts#describeGateAdvisory: this package
// does not depend on @tautest/core, so the two must be kept in sync by hand. Mirror any change here
// there too, and vice versa.
export function describeGateAdvisory(input: { score: number | null | undefined; threshold?: number; survived: number; noCoverage: number }): string | null {
  const score = input.score ?? null;
  const actionable = input.survived + input.noCoverage;

  if (actionable === 0 || score === null) {
    return null;
  }

  const thresholdPassed = input.threshold === undefined || score >= input.threshold;

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
