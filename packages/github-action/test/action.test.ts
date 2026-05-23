import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSurvivorAnnotations } from '../src/annotations';
import { buildCacheKey } from '../src/cache';
import { parseInputs } from '../src/inputs';
import { buildPrComment, COMMENT_MARKER, findStickyComment, sanitize } from '../src/pr-comment';
import { buildStepSummary } from '../src/summary';
import { buildTautestRunArgs, extractJson, formatTautestCliDiagnostics, resolveTautestCommand } from '../src/tautest-cli';

describe('action inputs', () => {
  it('parses booleans, enums, and threshold values', () => {
    expect(
      parseInputs({
        threshold: '75',
        maxFiles: '4',
        maxChangedLines: '25',
        failOnThreshold: 'false',
        comment: 'always',
        annotations: 'survivors',
        promptStyle: 'codex',
        workingDirectory: 'examples/vitest-basic',
        packageManager: 'pnpm',
        install: 'true',
        cache: 'false'
      })
    ).toMatchObject({
      threshold: 75,
      maxFiles: '4',
      maxChangedLines: '25',
      failOnThreshold: false,
      comment: 'always',
      annotations: 'survivors',
      promptStyle: 'codex',
      workingDirectory: 'examples/vitest-basic',
      packageManager: 'pnpm',
      install: true,
      cache: false
    });
  });

  it('rejects invalid input values', () => {
    expect(() => parseInputs({ threshold: '101' })).toThrow('threshold');
    expect(() => parseInputs({ comment: 'sometimes' })).toThrow('comment');
    expect(() => parseInputs({ annotations: 'all' })).toThrow('annotations');
    expect(() => parseInputs({ install: 'yes' })).toThrow('install');
    expect(() => parseInputs({ maxChangedLines: '0' })).toThrow('max-changed-lines');
    expect(() => parseInputs({ promptStyle: 'robot' })).toThrow('prompt-style');
  });
});

describe('annotations', () => {
  it('builds capped line annotations for surviving mutants', () => {
    const annotations = buildSurvivorAnnotations(
      [
        {
          filePath: 'src/discount.ts',
          line: 2,
          mutatorName: 'EqualityOperator',
          original: 'age >= 65',
          replacement: 'age > 65',
          insight: {
            missingBehavior: 'The exact boundary value 65 is not protected.'
          }
        },
        {
          filePath: 'src/cart.ts',
          line: 12,
          mutatorName: 'ArithmeticOperator',
          original: 'total + fee',
          replacement: 'total - fee'
        }
      ],
      { maxAnnotations: 1 }
    );

    expect(annotations).toEqual([
      {
        file: 'src/discount.ts',
        line: 2,
        title: 'Tautest survivor: EqualityOperator',
        message:
          'EqualityOperator survived mutation testing.\n' +
          'Original: age >= 65\n' +
          'Replacement: age > 65\n' +
          'Likely missing behavior: The exact boundary value 65 is not protected.'
      }
    ]);
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

  it('uses a local node_modules bin when the workspace CLI is missing', () => {
    const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'tautest-action-'));
    const workingDirectory = path.join(workspaceRoot, 'app');
    const localBinPath = path.join(workingDirectory, 'node_modules', '.bin', process.platform === 'win32' ? 'tautest.cmd' : 'tautest');

    try {
      mkdirSync(path.dirname(localBinPath), { recursive: true });
      writeFileSync(localBinPath, '#!/usr/bin/env node\n');

      const command = resolveTautestCommand(workspaceRoot, { workingDirectory, packageManager: 'npm' });

      expect(command).toMatchObject({
        command: localBinPath,
        args: [],
        strategy: 'local-node-modules-bin',
        nodeModulesBinPath: localBinPath,
        nodeModulesBinExists: true,
        packageManager: 'npm'
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
      expect(command.strategy).toBe('package-manager-exec');
      expect(command.localCliExists).toBe(false);
      expect(command.localCliPath).toBe(path.join(workspaceRoot, 'packages', 'cli', 'dist', 'index.js'));
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('uses the configured package manager for CLI fallback', () => {
    const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'tautest-action-'));

    try {
      const command = resolveTautestCommand(workspaceRoot, { packageManager: 'npm' });

      expect(command.command).toBe('npm');
      expect(command.args).toEqual(['exec', '--', 'tautest']);
      expect(command.strategy).toBe('package-manager-exec');
      expect(command.packageManager).toBe('npm');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('extracts JSON from CLI output with surrounding logs', () => {
    expect(extractJson('Starting Tautest\n{"status":"passed"}\n')).toBe('{"status":"passed"}');
  });

  it('passes CI budgets and prompt style to the CLI', () => {
    const args = buildTautestRunArgs(
      {
        command: 'pnpm',
        args: ['exec', 'tautest'],
        strategy: 'package-manager-exec',
        localCliPath: '/repo/packages/cli/dist/index.js',
        localCliExists: false
      },
      {
        threshold: 70,
        maxFiles: '4',
        maxChangedLines: '25',
        failOnThreshold: true,
        comment: 'changes',
        annotations: 'never',
        config: 'tautest.config.ts',
        promptStyle: 'codex',
        workingDirectory: '.',
        packageManager: 'pnpm',
        install: false,
        cache: true
      },
      'origin/main'
    );

    expect(args).toEqual([
      'exec',
      'tautest',
      'run',
      '--base',
      'origin/main',
      '--threshold',
      '70',
      '--json',
      '--max-files',
      '4',
      '--max-changed-lines',
      '25',
      '--config',
      'tautest.config.ts',
      '--prompt-style',
      'codex'
    ]);
  });

  it('formats parse failures with command, local CLI, version, stdout, and stderr details', () => {
    const message = formatTautestCliDiagnostics({
      reason: 'Tautest did not produce JSON output.',
      command: {
        command: 'pnpm',
        args: ['exec', 'tautest', 'run', '--json'],
        strategy: 'package-manager-exec',
        localCliPath: '/repo/packages/cli/dist/index.js',
        localCliExists: false
      },
      versionCommand: {
        command: 'pnpm',
        args: ['exec', 'tautest', 'run', '--json', '--version']
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
    expect(message).toContain('pnpm exec tautest run --json --version');
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
      metrics: {
        runtimeMs: 1250,
        changedFileCount: 2,
        changedSourceFileCount: 1,
        changedSourceLineCount: 1,
        mutatedFileCount: 1,
        mutatePatternCount: 1,
        partial: false
      },
      diagnostics: {
        strykerConfig: [
          {
            severity: 'warning',
            key: 'timeoutMS',
            message: 'Tautest run settings override Stryker `timeoutMS` from stryker.userConfig.',
            suggestion: 'Move supported settings into the Tautest stryker config block.'
          }
        ]
      },
      cache: {
        enabled: true,
        cacheKey: 'tautest-Linux-pnpm-main-feature-123456789abc',
        cachePath: '.tautest/stryker-incremental.json',
        matchedKey: 'tautest-Linux-pnpm-main-feature-123456789abc',
        saveStatus: 'already-exists',
        saveMessage: 'Tautest cache already exists for this key.'
      },
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
    expect(summary).toContain('## Runtime and Scope');
    expect(summary).toContain('| 1.3s | 2 | 1 | 1 | 1 | 1 | no |');
    expect(summary).toContain('## Stryker Config Diagnostics');
    expect(summary).toContain('`timeoutMS`');
    expect(summary).toContain('## Cache');
    expect(summary).toContain('| hit | already-exists |');
    expect(summary).toContain('| `src/discount.ts` | 2 | EqualityOperator | age &gt;= 65 | age &gt; 65 |');
    expect(summary).toContain('Fix prompt: `.tautest/fix-prompt.md`');
  });

  it('summarizes disabled cache runs', () => {
    const summary = buildStepSummary({
      status: 'passed',
      cache: {
        enabled: false
      }
    });

    expect(summary).toContain('## Cache');
    expect(summary).toContain('Disabled for this run.');
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
