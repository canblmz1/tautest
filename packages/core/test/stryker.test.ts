import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { diagnoseStrykerConfig, generateStrykerConfig, getStrykerConfigDiagnostics, mergeStrykerConfig } from '../src/stryker/config-generator';
import { parseStrykerMutationReport } from '../src/stryker/report-parser';
import { mapStrykerError, runStryker } from '../src/stryker/runner';
import { TautestError } from '../src/types';

const runMutationTest = vi.hoisted(() => vi.fn());
const strykerConfigs = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('@stryker-mutator/core', () => ({
  Stryker: vi.fn().mockImplementation(function StrykerMock(config: Record<string, unknown>) {
    strykerConfigs.push(config);
    return { runMutationTest };
  })
}));

// Mirrors Stryker's TemporaryDirectory: mkdtemp('<tempDirName>/sandbox-'), resolved against the
// cwd runStryker switched to, then either finishes or dies before its own cleanup runs.
function createSandboxDuringRun(outcome: 'resolve' | 'reject'): void {
  runMutationTest.mockImplementationOnce(async () => {
    const sandbox = path.resolve(String(strykerConfigs.at(-1)?.tempDirName), 'sandbox-abc123');
    mkdirSync(sandbox, { recursive: true });
    writeFileSync(path.join(sandbox, 'copied.ts'), 'export const copy = true;');
    if (outcome === 'reject') {
      throw new Error('instrumentation broke a bundle-size test');
    }
  });
}

describe('Stryker config generator', () => {
  it('generates Vitest Stryker config from mutate strings', () => {
    expect(
      generateStrykerConfig({
        mutate: ['src/foo.ts:42-58'],
        jsonReportPath: '.tautest/mutation.json',
        testRunner: 'vitest',
        packageManager: 'pnpm',
        incremental: true,
        incrementalFile: '.tautest/incremental.json',
        vitestConfigFile: 'vitest.config.ts'
      })
    ).toMatchObject({
      mutate: ['src/foo.ts:42-58'],
      reporters: ['json'],
      testRunner: 'vitest',
      packageManager: 'pnpm',
      incremental: true,
      incrementalFile: '.tautest/incremental.json',
      plugins: ['@stryker-mutator/vitest-runner'],
      jsonReporter: {
        fileName: '.tautest/mutation.json'
      },
      vitest: {
        configFile: 'vitest.config.ts',
        related: false
      }
    });
  });

  it('generates Jest Stryker config with a config file path', () => {
    expect(
      generateStrykerConfig({
        mutate: ['src/shipping.js:2-2'],
        jsonReportPath: '.tautest/mutation.json',
        testRunner: 'jest',
        packageManager: 'npm',
        jestConfigFile: 'jest.config.cjs'
      })
    ).toMatchObject({
      mutate: ['src/shipping.js:2-2'],
      reporters: ['json'],
      testRunner: 'jest',
      packageManager: 'npm',
      plugins: ['@stryker-mutator/jest-runner'],
      jest: {
        configFile: 'jest.config.cjs'
      }
    });
  });

  it('generates Jest ESM Stryker config with mjs config file', () => {
    expect(
      generateStrykerConfig({
        mutate: ['src/shipping.js:2-8'],
        jsonReportPath: '.tautest/mutation.json',
        testRunner: 'jest',
        packageManager: 'npm',
        jestConfigFile: 'jest.config.mjs'
      })
    ).toMatchObject({
      mutate: ['src/shipping.js:2-8'],
      reporters: ['json'],
      testRunner: 'jest',
      plugins: ['@stryker-mutator/jest-runner'],
      jest: {
        configFile: 'jest.config.mjs'
      }
    });
  });

  it('generates Jest TypeScript Stryker config with tsconfig path', () => {
    const config = generateStrykerConfig({
      mutate: ['src/shipping.ts:1-10'],
      jsonReportPath: '.tautest/mutation.json',
      testRunner: 'jest',
      packageManager: 'pnpm',
      jestConfigFile: 'jest.config.ts',
      tsconfigFile: 'tsconfig.json'
    });

    expect(config).toMatchObject({
      mutate: ['src/shipping.ts:1-10'],
      testRunner: 'jest',
      plugins: ['@stryker-mutator/jest-runner'],
      tsconfigFile: 'tsconfig.json',
      jest: {
        configFile: 'jest.config.ts'
      }
    });
  });

  it('generates Jest Stryker config without a config file (auto-discovery)', () => {
    const config = generateStrykerConfig({
      mutate: ['src/index.js:1-5'],
      jsonReportPath: '.tautest/mutation.json',
      testRunner: 'jest',
      packageManager: 'npm'
    });

    expect(config).toMatchObject({
      testRunner: 'jest',
      plugins: ['@stryker-mutator/jest-runner']
    });
    expect((config as Record<string, unknown>).jest).toBeUndefined();
  });

  it('safe-merges user config without allowing core scope overrides', () => {
    expect(
      mergeStrykerConfig(
        {
          mutate: ['src/foo.ts:1-1'],
          reporters: ['json'],
          jsonReporter: { fileName: 'core.json' },
          timeoutMS: 1000
        },
        {
          mutate: ['src/other.ts'],
          reporters: ['html'],
          jsonReporter: { fileName: 'user.json' },
          timeoutMS: 9000,
          ignoreStatic: true
        }
      )
    ).toMatchObject({
      mutate: ['src/foo.ts:1-1'],
      reporters: ['json'],
      jsonReporter: { fileName: 'core.json' },
      timeoutMS: 1000,
      ignoreStatic: true
    });
  });

  it('reports Stryker user config options that Tautest overrides', () => {
    const diagnostics = diagnoseStrykerConfig(
      {
        mutate: ['src/foo.ts:1-1'],
        reporters: ['json'],
        jsonReporter: { fileName: 'core.json' },
        testRunner: 'vitest',
        timeoutMS: 1000,
        vitest: {
          configFile: 'vitest.config.ts',
          related: false
        }
      },
      {
        mutate: ['src/other.ts'],
        reporters: ['html'],
        timeoutMS: 9000,
        vitest: {
          related: true
        }
      }
    );

    expect(diagnostics.map((diagnostic) => diagnostic.key)).toEqual(['mutate', 'reporters', 'timeoutMS', 'vitest.related']);
    expect(diagnostics[0]?.message).toContain('Tautest owns Stryker `mutate`');
    expect(diagnostics[2]?.suggestion).toContain('Tautest stryker config block');
  });

  it('builds diagnostics from full Stryker config generation options', () => {
    expect(
      getStrykerConfigDiagnostics({
        mutate: ['src/foo.ts:1-1'],
        jsonReportPath: '.tautest/mutation.json',
        testRunner: 'vitest',
        userConfig: {
          reporters: ['html'],
          timeoutMS: 9000
        }
      }).map((diagnostic) => diagnostic.key)
    ).toEqual(['reporters', 'timeoutMS']);
  });
});

describe('runStryker sandbox cleanup', () => {
  const tautestConfig = { tempDirName: '.stryker-tmp/tautest' };

  function tempProject(prefix: string): string {
    return mkdtempSync(path.join(tmpdir(), `tautest-stryker-${prefix}-`));
  }

  it('removes the sandbox Stryker created during the run and leaves no .stryker-tmp behind', async () => {
    createSandboxDuringRun('resolve');
    const root = tempProject('cleanup');

    await runStryker({ cwd: root, config: tautestConfig, jsonReportPath: path.join(root, 'm.json') });

    expect(existsSync(path.join(root, '.stryker-tmp'))).toBe(false);
  });

  it('removes it even when the run throws, without hiding the original error', async () => {
    createSandboxDuringRun('reject');
    const root = tempProject('cleanup-throws');

    await expect(runStryker({ cwd: root, config: tautestConfig, jsonReportPath: path.join(root, 'm.json') })).rejects.toMatchObject({
      code: 'STRYKER_RUN_FAILED'
    });

    expect(existsSync(path.join(root, '.stryker-tmp'))).toBe(false);
  });

  it('gives Stryker a per-run temp directory and keeps the whole temp root out of the sandbox copy', async () => {
    runMutationTest.mockResolvedValueOnce(undefined);
    const root = tempProject('per-run');

    await runStryker({ cwd: root, config: { ...tautestConfig, ignorePatterns: ['dist'] }, jsonReportPath: path.join(root, 'm.json') });

    expect(strykerConfigs.at(-1)?.tempDirName).toMatch(new RegExp(`^\\.stryker-tmp/tautest/run-${process.pid}-`));
    expect(strykerConfigs.at(-1)?.ignorePatterns).toEqual(['dist', '.stryker-tmp/tautest']);
  });

  it('removes run directories left by processes that are gone', async () => {
    runMutationTest.mockResolvedValueOnce(undefined);
    const root = tempProject('dead-run');
    const deadPid = spawnSync(process.execPath, ['-e', '']).pid;
    const deadRun = path.join(root, '.stryker-tmp', 'tautest', `run-${deadPid}-abc`, 'sandbox-xyz');
    mkdirSync(deadRun, { recursive: true });
    writeFileSync(path.join(deadRun, 'copied.ts'), 'stale');

    await runStryker({ cwd: root, config: tautestConfig, jsonReportPath: path.join(root, 'm.json') });

    expect(existsSync(path.join(root, '.stryker-tmp'))).toBe(false);
  });

  it('keeps other content in the temp root and in .stryker-tmp', async () => {
    createSandboxDuringRun('resolve');
    const root = tempProject('other-content');
    mkdirSync(path.join(root, '.stryker-tmp', 'tautest'), { recursive: true });
    mkdirSync(path.join(root, '.stryker-tmp', 'other-tool'), { recursive: true });
    writeFileSync(path.join(root, '.stryker-tmp', 'tautest', 'notes.txt'), 'not ours to delete');
    writeFileSync(path.join(root, '.stryker-tmp', 'other-tool', 'keep.txt'), 'not ours to delete');

    await runStryker({ cwd: root, config: tautestConfig, jsonReportPath: path.join(root, 'm.json') });

    expect(existsSync(path.join(root, '.stryker-tmp', 'tautest', 'notes.txt'))).toBe(true);
    expect(existsSync(path.join(root, '.stryker-tmp', 'other-tool', 'keep.txt'))).toBe(true);
    expect(readdirSync(path.join(root, '.stryker-tmp', 'tautest'))).toEqual(['notes.txt']);
  });

  it("keeps an in-place run's backup, which may be the only copy of the original sources", async () => {
    runMutationTest.mockRejectedValueOnce(new Error('stryker crashed before restoring'));
    const root = tempProject('inplace');
    const backup = path.join(root, '.stryker-tmp', 'tautest', 'backup-abc123', 'original.ts');
    mkdirSync(path.dirname(backup), { recursive: true });
    writeFileSync(backup, 'export const original = true;');

    await expect(runStryker({ cwd: root, config: { ...tautestConfig, inPlace: true }, jsonReportPath: path.join(root, 'm.json') })).rejects.toThrow();

    expect(existsSync(backup)).toBe(true);
    expect(strykerConfigs.at(-1)?.tempDirName).toBe('.stryker-tmp/tautest');
  });

  it('does nothing when the config has no tempDirName', async () => {
    runMutationTest.mockResolvedValueOnce(undefined);
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-no-tempdir-'));

    await expect(
      runStryker({
        cwd: root,
        config: {},
        jsonReportPath: path.join(root, '.tautest', 'mutation.json')
      })
    ).resolves.toMatchObject({ jsonReportPath: path.join(root, '.tautest', 'mutation.json') });
  });

  // runStryker is a public @tautest/core API: config is not guaranteed to come from
  // config-generator.ts, so a caller-supplied tempDirName must never delete outside cwd.
  it('refuses to delete a tempDirName that resolves outside cwd', async () => {
    runMutationTest.mockResolvedValueOnce(undefined);
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-traversal-'));
    const outside = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-outside-'));
    const sentinel = path.join(outside, 'sentinel.txt');
    writeFileSync(sentinel, 'do not delete me');
    const relativeTraversal = path.relative(root, outside);

    await runStryker({
      cwd: root,
      config: { tempDirName: relativeTraversal },
      jsonReportPath: path.join(root, '.tautest', 'mutation.json')
    });

    expect(existsSync(sentinel)).toBe(true);
  });

  it('refuses to delete through a symlink/junction segment that escapes cwd', async () => {
    runMutationTest.mockResolvedValueOnce(undefined);
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-link-root-'));
    const outsideTarget = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-link-target-'));
    const sentinel = path.join(outsideTarget, 'sentinel.txt');
    writeFileSync(sentinel, 'do not delete me');
    // tempDirName is lexically "under" root (path.relative passes), but root/link actually points
    // outside root, so deleting root/link/tautest deletes outsideTarget/tautest instead.
    symlinkSync(outsideTarget, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    mkdirSync(path.join(outsideTarget, 'tautest'), { recursive: true });

    await runStryker({
      cwd: root,
      config: { tempDirName: 'link/tautest' },
      jsonReportPath: path.join(root, '.tautest', 'mutation.json')
    });

    expect(existsSync(sentinel)).toBe(true);
    expect(existsSync(path.join(outsideTarget, 'tautest'))).toBe(true);
  });

  it('refuses to delete cwd itself when tempDirName resolves to it', async () => {
    runMutationTest.mockResolvedValueOnce(undefined);
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-cwd-'));
    writeFileSync(path.join(root, 'keep.txt'), 'keep me');

    await runStryker({
      cwd: root,
      config: { tempDirName: '.' },
      jsonReportPath: path.join(root, '.tautest', 'mutation.json')
    });

    expect(existsSync(path.join(root, 'keep.txt'))).toBe(true);
  });

  it('never deletes a caller-supplied tempDirName that names a real folder inside cwd', async () => {
    runMutationTest.mockRejectedValueOnce(new Error('stryker failed'));
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-src-'));
    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'src', 'sentinel.txt'), 'do not delete me');

    await expect(runStryker({ cwd: root, config: { tempDirName: 'src' }, jsonReportPath: path.join(root, 'm.json') })).rejects.toThrow();

    expect(existsSync(path.join(root, 'src', 'sentinel.txt'))).toBe(true);
  });

  it('refuses when the Tautest sandbox directory is itself a link to another folder inside cwd', async () => {
    runMutationTest.mockRejectedValueOnce(new Error('stryker failed'));
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-linked-sandbox-'));
    mkdirSync(path.join(root, 'src', 'sandbox-looks-like-stryker'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'sentinel.txt'), 'do not delete me');
    mkdirSync(path.join(root, '.stryker-tmp'));
    symlinkSync(path.join(root, 'src'), path.join(root, '.stryker-tmp', 'tautest'), process.platform === 'win32' ? 'junction' : 'dir');

    await expect(runStryker({ cwd: root, config: { tempDirName: '.stryker-tmp/tautest' }, jsonReportPath: path.join(root, 'm.json') })).rejects.toThrow();

    expect(existsSync(path.join(root, 'src', 'sentinel.txt'))).toBe(true);
    expect(existsSync(path.join(root, 'src', 'sandbox-looks-like-stryker'))).toBe(true);
    // No per-run directory is created through the link, and Stryker gets the config unchanged.
    expect(readdirSync(path.join(root, 'src')).some((name) => name.startsWith('run-'))).toBe(false);
    expect(strykerConfigs.at(-1)?.tempDirName).toBe('.stryker-tmp/tautest');
  });

  it('refuses when .stryker-tmp itself links outside cwd', async () => {
    runMutationTest.mockResolvedValueOnce(undefined);
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-linked-parent-'));
    const outside = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-linked-parent-target-'));
    const outsideSandbox = path.join(outside, 'tautest', 'sandbox-abc123');
    mkdirSync(outsideSandbox, { recursive: true });
    writeFileSync(path.join(outsideSandbox, 'sentinel.txt'), 'do not delete me');
    symlinkSync(outside, path.join(root, '.stryker-tmp'), process.platform === 'win32' ? 'junction' : 'dir');

    await runStryker({ cwd: root, config: { tempDirName: '.stryker-tmp/tautest' }, jsonReportPath: path.join(root, 'm.json') });

    expect(existsSync(path.join(outsideSandbox, 'sentinel.txt'))).toBe(true);
  });

  it("never touches another run's temp directory or sandbox", async () => {
    createSandboxDuringRun('resolve');
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-stryker-concurrent-'));
    // This process is alive, so a run directory carrying its PID stands in for a run in progress.
    const liveRun = path.join(root, '.stryker-tmp', 'tautest', `run-${process.pid}-other`, 'sandbox-live');
    const otherSandbox = path.join(root, '.stryker-tmp', 'tautest', 'sandbox-other-run');
    mkdirSync(liveRun, { recursive: true });
    mkdirSync(otherSandbox, { recursive: true });
    writeFileSync(path.join(liveRun, 'source.ts'), 'in use');
    writeFileSync(path.join(otherSandbox, 'source.ts'), 'in use');

    await runStryker({ cwd: root, config: { tempDirName: '.stryker-tmp/tautest' }, jsonReportPath: path.join(root, 'm.json') });

    expect(existsSync(path.join(liveRun, 'source.ts'))).toBe(true);
    expect(existsSync(path.join(otherSandbox, 'source.ts'))).toBe(true);
  });
});

describe('Stryker error mapping', () => {
  it('maps common Stryker failures to Tautest errors', () => {
    expect(mapStrykerError(new Error('No tests found'))).toMatchObject({
      code: 'STRYKER_NO_TESTS'
    });
    expect(mapStrykerError(new Error('Cannot find module vitest'))).toMatchObject({
      code: 'STRYKER_MODULE_NOT_FOUND'
    });
  });

  it('maps a missing ESM package, such as an uninstalled Stryker core, to STRYKER_MODULE_NOT_FOUND', () => {
    expect(mapStrykerError(new Error("Cannot find package '@stryker-mutator/core' imported from /project/node_modules/@tautest/core/dist/index.js"))).toMatchObject({
      code: 'STRYKER_MODULE_NOT_FOUND'
    });
  });

  it('maps timeout errors', () => {
    expect(mapStrykerError(new Error('Test runner timed out'))).toMatchObject({ code: 'STRYKER_TIMEOUT' });
    expect(mapStrykerError(new Error('dry run timeout exceeded'))).toMatchObject({ code: 'STRYKER_TIMEOUT' });
  });

  it('maps a broken initial test run to STRYKER_DRY_RUN_FAILED without assuming instrumentation is at fault', () => {
    const mapped = mapStrykerError(new Error('There were failed tests in the initial test run.'));

    expect(mapped).toMatchObject({ code: 'STRYKER_DRY_RUN_FAILED' });
    expect(mapped.message).toContain('confirm the test actually fails on the unmutated code too');
    expect(mapped.message).toContain('docs/TROUBLESHOOTING.md#instrumentation-breaks-a-non-behavioral-test');
    // A genuinely broken test in the PR triggers the identical Stryker message, so the copy must not
    // present instrumentation as the default diagnosis.
    expect(mapped.message).not.toMatch(/this usually means/i);
    expect(mapStrykerError(new Error('Something went wrong in the initial test run'))).toMatchObject({
      code: 'STRYKER_DRY_RUN_FAILED'
    });
  });

  it('maps out-of-memory errors to STRYKER_OUT_OF_MEMORY', () => {
    expect(mapStrykerError(new Error('ENOMEM: not enough memory'))).toMatchObject({ code: 'STRYKER_OUT_OF_MEMORY' });
    expect(mapStrykerError(new Error('JavaScript heap out of memory'))).toMatchObject({ code: 'STRYKER_OUT_OF_MEMORY' });
    expect(mapStrykerError(new Error('Allocation failed - JavaScript heap out of memory'))).toMatchObject({ code: 'STRYKER_OUT_OF_MEMORY' });
    expect(mapStrykerError(new Error('out of memory'))).toMatchObject({ code: 'STRYKER_OUT_OF_MEMORY' });
  });

  it('wraps unknown errors as STRYKER_RUN_FAILED', () => {
    expect(mapStrykerError(new Error('Something unexpected happened'))).toMatchObject({ code: 'STRYKER_RUN_FAILED' });
    expect(mapStrykerError('plain string error')).toMatchObject({ code: 'STRYKER_RUN_FAILED', message: expect.stringContaining('plain string error') });
  });

  it('preserves the original cause', () => {
    const original = new Error('root cause');
    const mapped = mapStrykerError(original);
    expect(mapped.cause).toBe(original);
  });

  it('handles circular-reference values in diagnoseStrykerConfig without throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() =>
      diagnoseStrykerConfig(
        { mutate: ['src/a.ts:1-1'], reporters: ['json'], timeoutMS: 1000 },
        { timeoutMS: circular as unknown as number }
      )
    ).not.toThrow();
  });
});

describe('Stryker report parsing', () => {
  const source = 'export function finalPrice(amount) {\n  if (amount <= 0) return 0;\n  return amount;\n}\n';
  const location = { start: { line: 2, column: 7 }, end: { line: 2, column: 18 } };

  function reportWith(mutants: Array<{ status: string; testsCompleted?: number }>) {
    return {
      files: {
        'src/price.js': {
          source,
          mutants: mutants.map((mutant, index) => ({
            id: String(index + 1),
            mutatorName: 'ConditionalExpression',
            replacement: 'true',
            location,
            coveredBy: ['test-1'],
            ...mutant
          }))
        }
      }
    };
  }

  function parseError(report: ReturnType<typeof reportWith>): unknown {
    try {
      parseStrykerMutationReport(report);
    } catch (error) {
      return error;
    }
    return undefined;
  }

  it('refuses to score a run whose surviving mutants executed zero tests', () => {
    const error = parseError(reportWith([{ status: 'Survived', testsCompleted: 0 }, { status: 'Survived', testsCompleted: 0 }]));

    expect(error).toBeInstanceOf(TautestError);
    expect((error as TautestError).code).toBe('STRYKER_ZERO_TESTS_EXECUTED');
    expect((error as TautestError).message).toContain('2 of 2 surviving mutants');
  });

  it('refuses a run where only some surviving mutants executed zero tests', () => {
    const error = parseError(reportWith([{ status: 'Survived', testsCompleted: 3 }, { status: 'Survived', testsCompleted: 0 }]));

    expect((error as TautestError | undefined)?.code).toBe('STRYKER_ZERO_TESTS_EXECUTED');
    expect((error as TautestError).message).toContain('1 of 2 surviving mutants');
  });

  it('scores surviving mutants that actually executed tests', () => {
    const summary = parseStrykerMutationReport(reportWith([{ status: 'Killed', testsCompleted: 1 }, { status: 'Survived', testsCompleted: 3 }]));

    expect(summary.survived).toBe(1);
    expect(summary.score).toBe(50);
  });

  it('does not judge reports that predate testsCompleted', () => {
    const summary = parseStrykerMutationReport(reportWith([{ status: 'Survived' }]));

    expect(summary.survived).toBe(1);
  });

  it('treats uncovered mutants with zero executed tests as normal', () => {
    const summary = parseStrykerMutationReport(reportWith([{ status: 'NoCoverage', testsCompleted: 0 }]));

    expect(summary.noCoverage).toBe(1);
  });
});
