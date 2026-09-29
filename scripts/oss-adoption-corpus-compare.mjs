// Compare mutant outcomes without relying on Stryker's run-local mutant IDs or test IDs.
// A file, mutator, source span and replacement together identify the behavior being tested.
export function compareMutantReports(left, right) {
  const leftMutants = indexMutants(left);
  const rightMutants = indexMutants(right);
  const missingFromLeft = [];
  const missingFromRight = [];
  const statusDifferences = [];

  for (const [identity, statuses] of leftMutants) {
    const other = rightMutants.get(identity);
    if (!other) {
      missingFromRight.push({ identity, statuses });
    } else if (JSON.stringify(statuses) !== JSON.stringify(other)) {
      statusDifferences.push({ identity, left: statuses, right: other });
    }
  }

  for (const [identity, statuses] of rightMutants) {
    if (!leftMutants.has(identity)) {
      missingFromLeft.push({ identity, statuses });
    }
  }

  return {
    leftCount: countMutants(leftMutants),
    rightCount: countMutants(rightMutants),
    missingFromLeft,
    missingFromRight,
    statusDifferences,
    identical: missingFromLeft.length === 0 && missingFromRight.length === 0 && statusDifferences.length === 0
  };
}

function indexMutants(report) {
  if (!report || !report.files || typeof report.files !== 'object' || Array.isArray(report.files)) {
    throw new Error('Missing Stryker mutation report files; mutant outcomes cannot be compared.');
  }

  const indexed = new Map();
  for (const [file, data] of Object.entries(report.files)) {
    if (!Array.isArray(data?.mutants)) {
      throw new Error(`Stryker report has no mutants array for ${file}.`);
    }

    for (const mutant of data.mutants) {
      const { start, end } = mutant.location ?? {};
      if (typeof mutant.mutatorName !== 'string' || typeof mutant.replacement !== 'string' || typeof mutant.status !== 'string' ||
          !Number.isInteger(start?.line) || !Number.isInteger(start?.column) || !Number.isInteger(end?.line) || !Number.isInteger(end?.column)) {
        throw new Error(`Malformed mutant in ${file}; mutant outcomes cannot be compared.`);
      }
      const identity = JSON.stringify([
        file.replaceAll('\\', '/'),
        mutant.mutatorName,
        start?.line,
        start?.column,
        end?.line,
        end?.column,
        mutant.replacement
      ]);
      const statuses = indexed.get(identity) ?? [];
      statuses.push(mutant.status);
      indexed.set(identity, statuses);
    }
  }

  for (const statuses of indexed.values()) {
    statuses.sort();
  }
  return indexed;
}

function countMutants(indexed) {
  return [...indexed.values()].reduce((sum, statuses) => sum + statuses.length, 0);
}
