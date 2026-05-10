import { describe, expect, it } from 'vitest';
import { changedFilesToStrykerMutate, changedRangeToStrykerMutate, coalesceRanges } from '../src/git/ranges';
import type { ChangedFile } from '../src/types';

describe('range mapper', () => {
  it('coalesces nearby ranges', () => {
    expect(
      coalesceRanges(
        [
          { start: 10, end: 12 },
          { start: 13, end: 13 },
          { start: 20, end: 20 }
        ],
        0
      )
    ).toEqual([
      { start: 10, end: 13 },
      { start: 20, end: 20 }
    ]);
  });

  it('maps ranges to Stryker mutate strings', () => {
    expect(changedRangeToStrykerMutate('src/foo.ts', { start: 42, end: 58 })).toBe('src/foo.ts:42-58');
  });

  it('maps changed files to mutate strings', () => {
    const files: ChangedFile[] = [
      {
        path: 'src/foo.ts',
        status: 'modified',
        ranges: [
          { start: 1, end: 1 },
          { start: 3, end: 3 }
        ],
        isSource: true,
        isTest: false,
        isBinary: false,
        warnings: []
      }
    ];

    expect(changedFilesToStrykerMutate(files, 1)).toEqual(['src/foo.ts:1-3']);
  });
});

