import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getChangedSourceFiles, parseGitDiff } from '../src/git/diff';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

describe('git diff parser', () => {
  it('parses changed source ranges and excludes tests', () => {
    const diff = readFileSync(path.join(fixturesDir, 'changed-source.diff'), 'utf8');

    const files = parseGitDiff(diff);

    expect(files).toMatchObject([
      {
        path: 'src/foo.ts',
        status: 'modified',
        isSource: true,
        isTest: false,
        ranges: [
          { start: 1, end: 1 },
          { start: 9, end: 10 }
        ]
      },
      {
        path: 'src/foo.test.ts',
        isSource: false,
        isTest: true,
        ranges: [{ start: 1, end: 1 }]
      }
    ]);
    expect(getChangedSourceFiles(files)).toHaveLength(1);
  });

  it('handles renamed, deleted, and binary files', () => {
    const diff = readFileSync(path.join(fixturesDir, 'renamed-deleted-binary.diff'), 'utf8');

    const files = parseGitDiff(diff);

    expect(files[0]).toMatchObject({
      path: 'src/new.ts',
      oldPath: 'src/old.ts',
      status: 'renamed',
      ranges: [{ start: 1, end: 1 }]
    });
    expect(files[1]).toMatchObject({
      path: 'src/deleted.ts',
      status: 'deleted',
      ranges: [],
      warnings: ['File is deleted; no current source lines can be mutated.']
    });
    expect(files[2]).toMatchObject({
      path: 'assets/logo.png',
      status: 'binary',
      isBinary: true,
      ranges: []
    });
  });

  it('does not treat tool config files as production source', () => {
    const files = parseGitDiff(`diff --git a/vitest.config.ts b/vitest.config.ts
index 111..222 100644
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@ -1 +1 @@
-export default {}
+export default { test: {} }`);

    expect(files[0]).toMatchObject({
      path: 'vitest.config.ts',
      isSource: false,
      isTest: false
    });
  });
});
