import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCacheKey } from '../src/cache';
import { parseInputs } from '../src/inputs';
import { buildPrComment, COMMENT_MARKER, findStickyComment, sanitize } from '../src/pr-comment';
import { buildStepSummary } from '../src/summary';
import { extractJson, formatTautestCliDiagnostics, resolveTautestCommand } from '../src/tautest-cli';

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

describe('Tautest CLI invocation', () => {
  it('uses the built local workspace CLI before package-manager shims', () => {
    const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'tautest-action-'));
    const localCliPath = path.join(workspaceRoot, 'packages', 'cli', 'dist', 'index.js');

    try {
      mkdirSync(path.dirname(localCliPath), { recursive: true });
      writeFileSync(localCliPath, '#!/usr/bin/env node\n');

      const command = resolveTautestCommand(workspaceRoot);

      expect(command).toMatchObject({
        command: 'node',
        args: [localCliPath],
        strategy: 'local-workspace-cli',
        localCliPath,
        localCliExists: true
      });
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('falls back to pnpm exec when the built local CLI is missing', () => {
    const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'tautest-action-'));

    try {
      const command = resolveTautestCommand(workspaceRoot);

      expect(command.command).toBe('pnpm');
      expect(command.args).toEqual(['exec', 'tautest']);
      expect(command.strategy).toBe('pnpm-exec');
      expect(command.localCliExists).toBe(false);
      expect(command.localCliPath).toBe(path.join(workspaceRoot, 'packages', 'cli', 'dist', 'index.js'));
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('extracts JSON from CLI output with surrounding logs', () => {
    expect(extractJson('Starting Tautest\n{"status":"passed"}\n')).toBe('{"status":"passed"}');
  });

  it('formats parse failures with command, local CLI, version, stdout, and stderr details', () => {
    const message = formatTautestCliDiagnostics({
      reason: 'Tautest did not produce JSON output.',
      command: {
        command: 'pnpm',
        args: ['exec', 'tautest', 'run', '--json'],
        strategy: 'pnpm-exec',
        localCliPath: '/repo/packages/cli/dist/index.js',
        localCliExists: false
      },
      result: {
        exitCode: 0,
        stdout: 'line 1\nline 2',
        stderr: 'warning'
      },
      versionCheck: {
        exitCode: 1,
        stdout: '',
        stderr: 'tautest not found'
      }
    });

    expect(message).toContain('Attempted command: pnpm exec tautest run --json');
    expect(message).toContain('Local CLI exists: no');
    expect(message).toContain('exit code: 1');
    expect(message).toContain('tautest not found');
    expect(message).toContain('line 2');
    expect(message).toContain('warning');
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
      threshold: 80,
      reportPath: '.tautest/report.md',
      topMutants: [
        {
          filePath: 'src/discount.ts',
          line: 2,
          mutatorName: 'EqualityOperator',
          original: 'age >= 65',
          replacement: 'age > 65',
          insight: {
            missingBehavior: 'The exact boundary value 65 is not protected.'
          }
        }
      ]
    });

    expect(body).toContain(COMMENT_MARKER);
    expect(body).toContain('## Tautest Patch Mutation Gate: MIXED');
    expect(body).toContain('| MIXED | 75.00% | 80.00% | 3 | 1 | 0 |');
    expect(body).toContain('| `src/discount.ts` | 2 | EqualityOperator | age &gt;= 65 | age &gt; 65 | The exact boundary value 65 is not protected. |');
  });

  it('escapes html comments and tags from dynamic markdown', () => {
    expect(sanitize('<!-- marker --><script>x</script>')).toBe('&lt;!-- marker --&gt;&lt;script&gt;x&lt;/script&gt;');
  });

  it('finds the existing sticky comment by marker', () => {
    const comments = [{ id: 1, body: 'hello' }, { id: 2, body: `${COMMENT_MARKER}\nold report` }];

    expect(findStickyComment(comments)?.id).toBe(2);
  });
});

describe('step summary', () => {
  it('builds a sanitized GitHub job summary', () => {
    const summary = buildStepSummary({
      status: 'threshold-failed',
      report: {
        summary: {
          verdict: 'MIXED',
          mutationScore: 75,
          killed: 3,
          survived: 1,
          noCoverage: 0
        },
        surviving: [
          {
            filePath: 'src/discount.ts',
            line: 2,
            mutatorName: 'EqualityOperator',
            original: 'age >= 65',
            replacement: 'age > 65'
          }
        ]
      },
      paths: {
        report: '.tautest/report.md',
        json: '.tautest/report.json',
        prompt: '.tautest/fix-prompt.md'
      }
    });

    expect(summary).toContain('# Tautest');
    expect(summary).toContain('| MIXED | 75.00% | 3 | 1 | 0 |');
    expect(summary).toContain('| `src/discount.ts` | 2 | EqualityOperator | age &gt;= 65 | age &gt; 65 |');
    expect(summary).toContain('Fix prompt: `.tautest/fix-prompt.md`');
  });

  it('summarizes no-op runs without mutants', () => {
    const summary = buildStepSummary({
      status: 'no-op',
      message: 'No changed production source files found.'
    });

    expect(summary).toContain('| NO_CHANGES | unknown | 0 | 0 | 0 |');
    expect(summary).toContain('No surviving mutants found.');
    expect(summary).toContain('No changed production source files found.');
  });
});
