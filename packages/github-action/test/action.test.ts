import { describe, expect, it } from 'vitest';
import { buildCacheKey } from '../src/cache';
import { parseInputs } from '../src/inputs';
import { buildPrComment, COMMENT_MARKER, findStickyComment, sanitize } from '../src/pr-comment';

describe('action inputs', () => {
  it('parses booleans, enums, and threshold values', () => {
    expect(
      parseInputs({
        threshold: '75',
        failOnThreshold: 'false',
        comment: 'always',
        workingDirectory: 'examples/vitest-basic',
        packageManager: 'pnpm',
        install: 'true',
        cache: 'false'
      })
    ).toMatchObject({
      threshold: 75,
      failOnThreshold: false,
      comment: 'always',
      workingDirectory: 'examples/vitest-basic',
      packageManager: 'pnpm',
      install: true,
      cache: false
    });
  });

  it('rejects invalid input values', () => {
    expect(() => parseInputs({ threshold: '101' })).toThrow('threshold');
    expect(() => parseInputs({ comment: 'sometimes' })).toThrow('comment');
    expect(() => parseInputs({ install: 'yes' })).toThrow('install');
  });
});

describe('cache key', () => {
  it('includes base, head, package manager, and a working-directory hash', () => {
    const key = buildCacheKey({
      workingDirectory: '/tmp/project',
      base: 'refs/heads/main',
      headRef: 'feature/report',
      packageManager: 'pnpm',
      runnerOs: 'Linux'
    });

    expect(key).toMatch(/^tautest-Linux-pnpm-refs-heads-main-feature-report-[a-f0-9]{12}$/);
  });
});

describe('PR comment', () => {
  it('builds a sticky sanitized markdown report', () => {
    const body = buildPrComment({
      score: 75,
      verdict: 'MIXED',
      killed: 3,
      survived: 1,
      noCoverage: 0,
      reportPath: '.tautest/report.md',
      topMutants: [
        {
          filePath: 'src/discount.ts',
          line: 2,
          mutatorName: 'EqualityOperator',
          original: 'age >= 65',
          replacement: 'age > 65'
        }
      ]
    });

    expect(body).toContain(COMMENT_MARKER);
    expect(body).toContain('**Verdict:** MIXED');
    expect(body).toContain('| `src/discount.ts` | 2 | EqualityOperator | age &gt;= 65 | age &gt; 65 |');
  });

  it('escapes html comments and tags from dynamic markdown', () => {
    expect(sanitize('<!-- marker --><script>x</script>')).toBe('&lt;!-- marker --&gt;&lt;script&gt;x&lt;/script&gt;');
  });

  it('finds the existing sticky comment by marker', () => {
    const comments = [{ id: 1, body: 'hello' }, { id: 2, body: `${COMMENT_MARKER}\nold report` }];

    expect(findStickyComment(comments)?.id).toBe(2);
  });
});
