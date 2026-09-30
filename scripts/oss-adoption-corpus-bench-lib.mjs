// Pure helpers of the corpus benchmark (scripts/oss-adoption-corpus-bench.mjs) and its report
// (scripts/oss-adoption-corpus-bench-report.mjs), kept apart so the statistics, the ordering and the
// matching rules can be tested. The thresholds below are the ones declared in docs/oss-adoption-benchmark.md
// before any measurement.
import { compareMutantReports } from './oss-adoption-corpus-compare.mjs';

export const VARIANTS = ['tautest', 'direct-matched', 'direct-defaults', 'full-file', 'incremental-cold', 'incremental-warm', 'incremental-rerun'];

// "Tautest has a runtime advantage over X on a PR" needs all three: the median saving is at least
// minSavingMs, Tautest's median is at most maxRatio of X's, and Tautest wins at least minPairShare of the
// same-round pairs. The opposite ("X is faster") needs the loss, the ratio and the pair share below.
export const ADVANTAGE = { minSavingMs: 10_000, maxRatio: 0.8, minPairShare: 0.8 };
export const DISADVANTAGE = { minLossMs: 5_000, minRatio: 1.1, minPairShare: 0.8 };
// docs/KILL_CRITERIA.md, hard stop benchmark: a changed-line run must finish in under 10 minutes or under
// 50% of the equivalent full-file run, whichever is more forgiving.
export const HARD_STOP = { absoluteMs: 10 * 60_000, relativeToFullFile: 0.5 };

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) {
    return null;
  }
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

// Nearest rank: the smallest value that has at least `fraction` of the samples at or below it. With fewer
// than ten samples the 90th percentile is the slowest sample.
export function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? null : sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
}

// Round r runs the variants in a cyclic rotation of the list, shifted by r-1 positions, so that over k
// consecutive rounds every variant holds every position once. The next block of k rounds runs the list
// reversed, which changes which variant precedes which.
export function orderFor(variants, round) {
  const k = variants.length;
  const base = Math.floor((round - 1) / k) % 2 === 0 ? variants : [...variants].reverse();
  const shift = (round - 1) % k;
  return [...base.slice(shift), ...base.slice(0, shift)];
}

// A finished run counts as measured. A run stopped by the timeout counts as the time it ran, which is a
// lower bound. Any other failure is not usable.
export function usableDuration(sample) {
  return sample.completed || sample.timedOut ? sample.durationMs : null;
}

export function summarize(samples) {
  const usable = samples.map(usableDuration).filter((duration) => duration !== null);
  return {
    samples: samples.length,
    completed: samples.filter((sample) => sample.completed).length,
    timedOut: samples.filter((sample) => sample.timedOut).length,
    failed: samples.filter((sample) => !sample.completed && !sample.timedOut).length,
    overBudget: samples.filter((sample) => sample.overBudget).length,
    censored: samples.some((sample) => sample.timedOut),
    medianMs: median(usable),
    p90Ms: percentile(usable, 0.9),
    minMs: usable.length ? Math.min(...usable) : null,
    maxMs: usable.length ? Math.max(...usable) : null
  };
}

// Tautest against one alternative on one row: the medians, the same-round differences and the verdict of
// the rule above. Samples are the flat list of bench.json.
export function compareWithTautest(samples, variant) {
  const rounds = (name) => new Map(samples.filter((sample) => sample.variant === name).map((sample) => [sample.round, sample]));
  const mine = rounds('tautest');
  const other = rounds(variant);
  const pairs = [];
  for (const [round, a] of mine) {
    const b = other.get(round);
    const tautestMs = a && usableDuration(a);
    const otherMs = b && usableDuration(b);
    if (tautestMs != null && otherMs != null) {
      pairs.push({ round, tautestMs, otherMs, diffMs: otherMs - tautestMs });
    }
  }
  const tautest = summarize([...mine.values()]);
  const alternative = summarize([...other.values()]);
  const result = {
    variant,
    pairs: pairs.length,
    tautestFaster: pairs.filter((pair) => pair.diffMs > 0).length,
    alternativeFaster: pairs.filter((pair) => pair.diffMs < 0).length,
    medianTautestMs: tautest.medianMs,
    medianOtherMs: alternative.medianMs,
    otherCensored: alternative.censored,
    medianDiffMs: median(pairs.map((pair) => pair.diffMs)),
    minDiffMs: pairs.length ? Math.min(...pairs.map((pair) => pair.diffMs)) : null,
    maxDiffMs: pairs.length ? Math.max(...pairs.map((pair) => pair.diffMs)) : null,
    ratio: tautest.medianMs != null && alternative.medianMs ? tautest.medianMs / alternative.medianMs : null,
    verdict: 'not-comparable'
  };
  if (result.pairs === 0 || result.ratio === null) {
    return result;
  }
  const saved = result.medianOtherMs - result.medianTautestMs;
  if (saved >= ADVANTAGE.minSavingMs && result.ratio <= ADVANTAGE.maxRatio && result.tautestFaster / result.pairs >= ADVANTAGE.minPairShare) {
    result.verdict = 'advantage';
  } else if (-saved >= DISADVANTAGE.minLossMs && result.ratio >= DISADVANTAGE.minRatio && result.alternativeFaster / result.pairs >= DISADVANTAGE.minPairShare) {
    result.verdict = 'disadvantage';
  } else {
    result.verdict = 'no-clear-difference';
  }
  return result;
}

export function hardStop(samples) {
  const tautest = summarize(samples.filter((sample) => sample.variant === 'tautest')).medianMs;
  const fullFile = summarize(samples.filter((sample) => sample.variant === 'full-file')).medianMs;
  const underAbsolute = tautest != null && tautest < HARD_STOP.absoluteMs;
  const underRelative = tautest != null && fullFile != null && tautest < HARD_STOP.relativeToFullFile * fullFile;
  return { tautestMs: tautest, fullFileMs: fullFile, underAbsolute, underRelative, passes: underAbsolute || underRelative };
}

// Every sample as a fraction of its variant's median, averaged by the position it ran in. A position that
// is systematically above 1 would mean that running early or late in a round changes the timing.
export function positionEffect(samples) {
  const medians = new Map();
  for (const variant of new Set(samples.map((sample) => sample.variant))) {
    const usable = samples.filter((sample) => sample.variant === variant).map(usableDuration).filter((duration) => duration !== null);
    if (usable.length >= 3) {
      medians.set(variant, median(usable));
    }
  }
  const byPosition = new Map();
  for (const sample of samples) {
    const duration = usableDuration(sample);
    if (duration !== null && medians.has(sample.variant)) {
      const list = byPosition.get(sample.position) ?? [];
      list.push(duration / medians.get(sample.variant));
      byPosition.set(sample.position, list);
    }
  }
  return [...byPosition.entries()].sort((a, b) => a[0] - b[0]).map(([position, ratios]) => ({ position, n: ratios.length, meanRatio: ratios.reduce((a, b) => a + b, 0) / ratios.length }));
}

// "src/a.ts:12-30" or "src/a.ts:12": the file and the 1-based first and last line, as Stryker reads it.
export function parseRange(pattern) {
  const match = /^(.*):(\d+)(?:-(\d+))?$/.exec(pattern);
  return match ? { file: match[1].replaceAll('\\', '/'), start: Number(match[2]), end: Number(match[3] ?? match[2]) } : null;
}

// The mutants of a Stryker report that lie wholly inside the ranges, which is Stryker's own rule for a
// line-range `mutate` pattern.
export function restrictToRanges(report, patterns) {
  const ranges = patterns.map(parseRange).filter(Boolean);
  const files = {};
  for (const [file, data] of Object.entries(report.files ?? {})) {
    const own = ranges.filter((range) => range.file === file.replaceAll('\\', '/'));
    files[file] = { ...data, mutants: (data.mutants ?? []).filter((mutant) => own.some((range) => mutant.location.start.line >= range.start && mutant.location.end.line <= range.end)) };
  }
  return { ...report, files };
}

const countMutants = (report) => Object.values(report.files ?? {}).reduce((sum, file) => sum + (file.mutants?.length ?? 0), 0);

// Mutant-for-mutant comparisons between the first sample of each variant: file, mutator, span and
// replacement identify a mutant, and the statuses must agree.
export function matchReports(reports, patterns) {
  const views = { ...reports };
  if (reports['full-file']) {
    views['full-file in the changed ranges'] = restrictToRanges(reports['full-file'], patterns);
  }
  const wanted = [
    ['tautest', 'direct-matched'],
    ['direct-defaults', 'direct-matched'],
    ['full-file in the changed ranges', 'direct-matched'],
    ['incremental-cold', 'full-file'],
    ['incremental-warm', 'full-file'],
    ['incremental-rerun', 'full-file']
  ];
  const pairs = [];
  for (const [left, right] of wanted) {
    if (!views[left] || !views[right]) {
      pairs.push({ left, right, skipped: true });
      continue;
    }
    const comparison = compareMutantReports(views[left], views[right]);
    pairs.push({
      left,
      right,
      leftCount: comparison.leftCount,
      rightCount: comparison.rightCount,
      identical: comparison.identical,
      missingFromLeft: comparison.missingFromLeft.length,
      missingFromRight: comparison.missingFromRight.length,
      statusDifferences: comparison.statusDifferences.length,
      examples: comparison.statusDifferences.slice(0, 3).map(({ identity, left: a, right: b }) => ({ identity, left: a, right: b }))
    });
  }
  const scope = {
    lineRangeMutants: reports['direct-matched'] ? countMutants(reports['direct-matched']) : null,
    fullFileMutants: reports['full-file'] ? countMutants(reports['full-file']) : null,
    fullFileInRanges: views['full-file in the changed ranges'] ? countMutants(views['full-file in the changed ranges']) : null
  };
  return { scope, pairs };
}
