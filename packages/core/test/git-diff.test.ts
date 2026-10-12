import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getChangedSourceFiles, parseGitDiff } from '../src/git/diff';
import { changedFilesToStrykerMutate } from '../src/git/ranges';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

describe('git diff parser', () => {
  it.each([true, false])('parses a real Git UTF-8 path with core.quotePath=%s', (quotePath) => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-quoted-diff-'));
    for (const dir of ['old', 'new']) {
      mkdirSync(path.join(root, dir, 'src'), { recursive: true });
      writeFileSync(path.join(root, dir, 'src', 'öğe name.ts'), `export const value = ${dir === 'old' ? 1 : 2};\n`);
    }
    const diff = spawnSync('git', ['-c', `core.quotePath=${quotePath}`, 'diff', '--no-index', '--unified=0', '--no-color', 'old', 'new'], {
      cwd: root,
      encoding: 'utf8'
    });
    expect(diff.status).toBe(1);
    expect(parseGitDiff(diff.stdout)).toMatchObject([{
      path: 'new/src/öğe name.ts',
      oldPath: 'old/src/öğe name.ts',
      isSource: true,
      ranges: [{ start: 1, end: 1 }]
    }]);
  });

  it('decodes Git C-style escapes without treating literal backslashes as Windows separators', () => {
    const rawPath = String.raw`src/name\twith\"quote\\slash.ts`;
    const files = parseGitDiff(`diff --git "a/${rawPath}" "b/${rawPath}"
--- "a/${rawPath}"
+++ "b/${rawPath}"
@@ -1 +1 @@
-export const value = 1;
+export const value = 2;`);
    expect(files[0]).toMatchObject({ path: 'src/name\twith"quote\\slash.ts', oldPath: 'src/name\twith"quote\\slash.ts' });
  });

  it('preserves literal UTF-8 characters inside a C-quoted path', () => {
    const files = parseGitDiff('diff --git "a/src/öğe\\tname.ts" "b/src/öğe\\tname.ts"\n+++ "b/src/öğe\\tname.ts"');
    expect(files[0].path).toBe('src/öğe\tname.ts');
  });

  it('decodes quoted paths on a binary diff without patch path headers', () => {
    const files = parseGitDiff(String.raw`diff --git "a/src/\303\266\304\237e.ts" "b/src/\303\266\304\237e.ts"
Binary files "a/src/\303\266\304\237e.ts" and "b/src/\303\266\304\237e.ts" differ`);
    expect(files[0]).toMatchObject({ path: 'src/öğe.ts', oldPath: 'src/öğe.ts', status: 'binary', isBinary: true });
  });

  it('decodes quoted rename metadata while preserving spaces', () => {
    const files = parseGitDiff(String.raw`diff --git "a/src/\303\266\304\237e old.ts" "b/src/\303\266\304\237e new.ts"
similarity index 100%
rename from "src/\303\266\304\237e old.ts"
rename to "src/\303\266\304\237e new.ts"`);
    expect(files[0]).toMatchObject({ path: 'src/öğe new.ts', oldPath: 'src/öğe old.ts', status: 'renamed' });
  });

  it.each([
    { before: 'counter++;', after: '++ counter;' },
    { before: '-- counter;', after: 'counter--;' }
  ])('keeps hunk content resembling file headers in the changed-line scope: $before -> $after', ({ before, after }) => {
    const files = parseGitDiff(`diff --git a/src/counter.ts b/src/counter.ts
--- a/src/counter.ts
+++ b/src/counter.ts
@@ -2 +2 @@
-${before}
+${after}`);

    expect(files).toMatchObject([
      {
        path: 'src/counter.ts',
        oldPath: 'src/counter.ts',
        isSource: true,
        ranges: [{ start: 2, end: 2 }]
      }
    ]);
    expect(changedFilesToStrykerMutate(getChangedSourceFiles(files))).toEqual(['src/counter.ts:2-2']);
  });

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
