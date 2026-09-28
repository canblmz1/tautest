import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareMutantReports } from './oss-adoption-corpus-compare.mjs';

function report(mutants) {
  return { files: { 'src/value.ts': { mutants } } };
}

function mutant(status, overrides = {}) {
  return {
    id: `run-specific-${status}`,
    mutatorName: 'EqualityOperator',
    location: { start: { line: 1, column: 1 }, end: { line: 1, column: 3 } },
    replacement: '===',
    status,
    ...overrides
  };
}

test('ignores run-local IDs but catches a status change on the same mutant', () => {
  const result = compareMutantReports(report([mutant('Killed')]), report([mutant('Survived')]));
  assert.equal(result.identical, false);
  assert.equal(result.leftCount, 1);
  assert.equal(result.rightCount, 1);
  assert.equal(result.statusDifferences.length, 1);
  assert.deepEqual(result.statusDifferences[0].left, ['Killed']);
  assert.deepEqual(result.statusDifferences[0].right, ['Survived']);
});

test('detects different mutant scopes even when both runs have the same count', () => {
  const left = report([mutant('Killed', { replacement: '===' })]);
  const right = report([mutant('Killed', { replacement: '!==' })]);
  const result = compareMutantReports(left, right);
  assert.equal(result.identical, false);
  assert.equal(result.missingFromLeft.length, 1);
  assert.equal(result.missingFromRight.length, 1);
});

test('preserves duplicate mutant identities and ignores report order', () => {
  const left = report([mutant('Killed'), mutant('Survived')]);
  const right = report([mutant('Survived'), mutant('Killed')]);
  const result = compareMutantReports(left, right);
  assert.equal(result.identical, true);
  assert.equal(result.leftCount, 2);
});

test('rejects a missing report instead of reporting a false agreement', () => {
  assert.throws(() => compareMutantReports(null, report([])), /Missing Stryker mutation report/);
});

test('rejects malformed mutant identities instead of silently matching undefined fields', () => {
  assert.throws(() => compareMutantReports(report([mutant('Killed', { location: undefined })]), report([])), /Malformed mutant/);
});
