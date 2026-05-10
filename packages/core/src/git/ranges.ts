import type { ChangedFile, ChangedRange } from '../types';

export function coalesceRanges(ranges: ChangedRange[], gap = 0): ChangedRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const coalesced: ChangedRange[] = [];

  for (const range of sorted) {
    const normalized = normalizeRange(range);
    const last = coalesced.at(-1);

    if (last && normalized.start <= last.end + gap + 1) {
      last.end = Math.max(last.end, normalized.end);
    } else {
      coalesced.push({ ...normalized });
    }
  }

  return coalesced;
}

export function changedRangeToStrykerMutate(filePath: string, range: ChangedRange): string {
  const normalized = normalizeRange(range);
  return `${toPosix(filePath)}:${normalized.start}-${normalized.end}`;
}

export function changedFilesToStrykerMutate(files: ChangedFile[], gap = 0): string[] {
  return files.flatMap((file) =>
    coalesceRanges(file.ranges, gap).map((range) => changedRangeToStrykerMutate(file.path, range))
  );
}

function normalizeRange(range: ChangedRange): ChangedRange {
  const start = Math.max(1, Math.min(range.start, range.end));
  const end = Math.max(start, Math.max(range.start, range.end));
  return { start, end };
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

