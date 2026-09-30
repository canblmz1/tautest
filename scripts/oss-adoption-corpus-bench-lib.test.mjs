import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ADVANTAGE,
  VARIANTS,
  compareWithTautest,
  hardStop,
  matchReports,
  median,
  orderFor,
  parseRange,
  percentile,
  positionEffect,
  restrictToRanges,
  summarize
} from './oss-adoption-corpus-bench-lib.mjs';

const sample = (variant, round, durationMs, extra = {}) => ({ variant, round, position: 1, durationMs, completed: true, timedOut: false, exitCode: 0, ...extra });
const timedOut = (variant, round, durationMs) => sample(variant, round, durationMs, { completed: false, timedOut: true, exitCode: null });
const crashed = (variant, round) => sample(variant, round, 1_000, { completed: false, exitCode: 1 });

test('median and nearest-rank percentile', () => {
  assert.equal(median([]), null);
  assert.equal(median([7]), 7);
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(percentile([], 0.9), null);
  // With five or seven samples the 90th percentile is the slowest one; with ten it is the ninth.
  assert.equal(percentile([1, 2, 3, 4, 5], 0.9), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7], 0.9), 7);
  assert.equal(percentile([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 0.9), 9);
  assert.equal(percentile([5], 0.9), 5);
});

test('orderFor: over seven rounds every variant holds every position once, and the next block is reversed', () => {
  assert.equal(VARIANTS.length, 7);
  const orders = Array.from({ length: 14 }, (_, index) => orderFor(VARIANTS, index + 1));
  for (const order of orders) {
    assert.deepEqual([...order].sort(), [...VARIANTS].sort());
  }
  for (const block of [orders.slice(0, 7), orders.slice(7)]) {
    for (let position = 0; position < 7; position++) {
      assert.deepEqual(new Set(block.map((order) => order[position])), new Set(VARIANTS), `position ${position}`);
    }
  }
  assert.deepEqual(orders[0], VARIANTS);
  assert.deepEqual(orders[7], [...VARIANTS].reverse());
  assert.notDeepEqual(orders[1], orders[0]);
  // In the forward block each variant follows its list predecessor, in the reversed block its successor.
  const follows = (order, variant) => order[(order.indexOf(variant) + 6) % 7];
  assert.equal(follows(orders[0], 'direct-matched'), 'tautest');
  assert.equal(follows(orders[7], 'direct-matched'), 'direct-defaults');
});

test('summarize: failures are excluded and a timeout counts as a lower bound', () => {
  const summary = summarize([sample('full-file', 1, 100), sample('full-file', 2, 300), timedOut('full-file', 3, 1_200), crashed('full-file', 4)]);
  assert.equal(summary.samples, 4);
  assert.equal(summary.completed, 2);
  assert.equal(summary.timedOut, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.censored, true);
  assert.equal(summary.medianMs, 300);
  assert.equal(summary.maxMs, 1_200);
  assert.equal(summarize([]).medianMs, null);
});

function rows(variant, durations) {
  return durations.map((duration, index) => sample(variant, index + 1, duration));
}

test('compareWithTautest: a clear saving is an advantage', () => {
  const samples = [...rows('tautest', [20_000, 21_000, 19_000, 20_500, 20_200]), ...rows('full-file', [60_000, 58_000, 61_000, 59_000, 62_000])];
  const result = compareWithTautest(samples, 'full-file');
  assert.equal(result.verdict, 'advantage');
  assert.equal(result.pairs, 5);
  assert.equal(result.tautestFaster, 5);
  assert.equal(result.medianTautestMs, 20_200);
  assert.equal(result.medianOtherMs, 60_000);
  assert.ok(Math.abs(result.ratio - 20_200 / 60_000) < 1e-9);
  // Same-round differences: 40 000, 37 000, 42 000, 38 500 and 41 800 ms.
  assert.equal(result.medianDiffMs, 40_000);
});

test('compareWithTautest: each of the three conditions is needed for an advantage', () => {
  // Faster by 30% but by only 6 s.
  const small = compareWithTautest([...rows('tautest', [14_000, 14_000, 14_000]), ...rows('direct-matched', [20_000, 20_000, 20_000])], 'direct-matched');
  assert.equal(small.verdict, 'no-clear-difference');
  // Saves 12 s but only 12%.
  const ratio = compareWithTautest([...rows('tautest', [88_000, 88_000, 88_000]), ...rows('full-file', [100_000, 100_000, 100_000])], 'full-file');
  assert.equal(ratio.verdict, 'no-clear-difference');
  // The medians qualify, but Tautest wins only 2 of 5 pairs.
  const pairs = compareWithTautest([...rows('tautest', [10_000, 10_000, 10_000, 90_000, 90_000]), ...rows('full-file', [50_000, 50_000, 50_000, 50_000, 50_000])], 'full-file');
  assert.equal(pairs.medianTautestMs, 10_000);
  assert.equal(pairs.tautestFaster, 3);
  assert.equal(pairs.verdict, 'no-clear-difference');
  assert.equal(ADVANTAGE.minSavingMs, 10_000);
});

test('compareWithTautest: an alternative that is clearly faster is a disadvantage', () => {
  const result = compareWithTautest([...rows('tautest', [60_000, 61_000, 59_000, 62_000, 60_500]), ...rows('direct-defaults', [30_000, 31_000, 29_000, 30_500, 30_200])], 'direct-defaults');
  assert.equal(result.verdict, 'disadvantage');
  assert.equal(result.alternativeFaster, 5);
});

test('compareWithTautest: timeouts count as their duration, crashed runs drop the pair, missing rounds are not paired', () => {
  const samples = [
    ...rows('tautest', [30_000, 30_000, 30_000]),
    sample('full-file', 1, 1_200_000, { completed: false, timedOut: true }),
    sample('full-file', 2, 1_200_000, { completed: false, timedOut: true }),
    crashed('full-file', 3)
  ];
  const result = compareWithTautest(samples, 'full-file');
  assert.equal(result.pairs, 2);
  assert.equal(result.otherCensored, true);
  assert.equal(result.verdict, 'advantage');
  assert.equal(compareWithTautest(rows('tautest', [1, 2]), 'full-file').verdict, 'not-comparable');
});

test('hardStop: under ten minutes, or under half of the full-file run, whichever is more forgiving', () => {
  assert.equal(hardStop([...rows('tautest', [60_000]), ...rows('full-file', [70_000])]).passes, true);
  const relative = hardStop([...rows('tautest', [700_000, 700_000]), ...rows('full-file', [1_800_000, 1_800_000])]);
  assert.equal(relative.underAbsolute, false);
  assert.equal(relative.underRelative, true);
  assert.equal(relative.passes, true);
  const failing = hardStop([...rows('tautest', [900_000]), ...rows('full-file', [1_000_000])]);
  assert.equal(failing.passes, false);
  assert.equal(hardStop(rows('tautest', [900_000])).passes, false);
});

test('positionEffect: normalises by each variant\'s own median', () => {
  const samples = [];
  for (let round = 1; round <= 4; round++) {
    samples.push({ ...sample('tautest', round, 100), position: round % 2 === 1 ? 1 : 2 });
    samples.push({ ...sample('full-file', round, 1_000), position: round % 2 === 1 ? 2 : 1 });
  }
  const effect = positionEffect(samples);
  assert.deepEqual(effect.map((entry) => entry.position), [1, 2]);
  for (const entry of effect) {
    assert.equal(entry.n, 4);
    assert.equal(entry.meanRatio, 1);
  }
});

test('parseRange reads file:start-end and file:line, with backslashes normalised', () => {
  assert.deepEqual(parseRange('src/a.ts:12-30'), { file: 'src/a.ts', start: 12, end: 30 });
  assert.deepEqual(parseRange('src/a.ts:12'), { file: 'src/a.ts', start: 12, end: 12 });
  assert.deepEqual(parseRange('src\\a.ts:5-6'), { file: 'src/a.ts', start: 5, end: 6 });
  assert.equal(parseRange('src/a.ts'), null);
});

const mutant = (startLine, endLine, status, mutatorName = 'EqualityOperator', replacement = '!==') => ({
  mutatorName,
  replacement,
  status,
  location: { start: { line: startLine, column: 1 }, end: { line: endLine, column: 9 } }
});
const report = (mutants, file = 'src/a.ts') => ({ files: { [file]: { mutants } }, testFiles: {} });

test('restrictToRanges keeps only the mutants wholly inside a range', () => {
  const full = report([mutant(3, 3, 'Killed'), mutant(10, 10, 'Survived'), mutant(11, 12, 'Killed', 'BlockStatement', '{}'), mutant(19, 21, 'Killed', 'BlockStatement', '{}'), mutant(40, 40, 'Killed')]);
  const inside = restrictToRanges(full, ['src/a.ts:10-20', 'src/a.ts:40']);
  assert.deepEqual(inside.files['src/a.ts'].mutants.map((m) => m.location.start.line), [10, 11, 40]);
  assert.equal(restrictToRanges(full, ['src/other.ts:1-100']).files['src/a.ts'].mutants.length, 0);
});

test('matchReports compares the variants mutant by mutant and restricts full-file to the changed ranges', () => {
  const lineRange = report([mutant(10, 10, 'Killed'), mutant(12, 12, 'Survived', 'ArithmeticOperator', '-')]);
  const fullFile = report([mutant(3, 3, 'Killed'), mutant(10, 10, 'Killed'), mutant(12, 12, 'Survived', 'ArithmeticOperator', '-'), mutant(50, 50, 'Killed')]);
  const flipped = report([mutant(10, 10, 'Timeout'), mutant(12, 12, 'Survived', 'ArithmeticOperator', '-')]);
  const result = matchReports({ tautest: lineRange, 'direct-matched': lineRange, 'direct-defaults': flipped, 'full-file': fullFile, 'incremental-cold': fullFile }, ['src/a.ts:10-12']);

  assert.deepEqual(result.scope, { lineRangeMutants: 2, fullFileMutants: 4, fullFileInRanges: 2 });
  const pair = (left, right) => result.pairs.find((entry) => entry.left === left && entry.right === right);
  assert.equal(pair('tautest', 'direct-matched').identical, true);
  assert.equal(pair('full-file in the changed ranges', 'direct-matched').identical, true);
  assert.equal(pair('incremental-cold', 'full-file').identical, true);
  const defaults = pair('direct-defaults', 'direct-matched');
  assert.equal(defaults.identical, false);
  assert.equal(defaults.statusDifferences, 1);
  assert.deepEqual(defaults.examples[0].left, ['Timeout']);
  assert.deepEqual(defaults.examples[0].right, ['Killed']);
  assert.equal(pair('incremental-warm', 'full-file').skipped, true);
});
