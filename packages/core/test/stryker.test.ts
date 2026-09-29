import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
        configFile: 'jest.config.cjs',
        enableFindRelatedTests: false
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
    // No configFile keeps the Jest runner's own config discovery.
    expect((config as Record<string, unknown>).jest).toEqual({ enableFindRelatedTests: false });
  });

  // findRelatedTests only runs tests Jest can trace to the mutated file; on moment/luxon it found
  // none for a changed src/impl file and Stryker stopped with "No tests were executed".
  it('turns off Jest related-test selection and says so when a user config turns it on', () => {
    const options = {
      mutate: ['src/index.js:1-5'],
      jsonReportPath: '.tautest/mutation.json',
      testRunner: 'jest' as const,
      userConfig: { jest: { enableFindRelatedTests: true } }
    };

    expect((generateStrykerConfig(options) as Record<string, unknown>).jest).toEqual({ enableFindRelatedTests: false });
    expect(getStrykerConfigDiagnostics(options).map((diagnostic) => diagnostic.key)).toContain('jest.enableFindRelatedTests');
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

  // Stryker rewrites tsconfig paths that leave the project by prepending exactly "../../", which
  // only fits a sandbox two levels down: <one-segment tempDirName>/sandbox-*.
  it("keeps Stryker's one-segment temp dir so tsconfig extends outside the package still resolve", () => {
    const config = generateStrykerConfig({ mutate: ['src/a.ts:1-1'], jsonReportPath: '.tautest/mutation.json', testRunner: 'vitest' });

    expect(config.tempDirName).toBe('.stryker-tmp');
    expect(String(config.tempDirName).split(/[\\/]/)).toHaveLength(1);
  });

  it('asks Stryker to remove its sandbox after failed runs too', () => {
    expect(generateStrykerConfig({ mutate: ['src/a.ts:1-1'], jsonReportPath: '.tautest/mutation.json', testRunner: 'vitest' }).cleanTempDir).toBe('always');
  });

  it("keeps a failed in-place run's backup, which may be the only copy of the original sources", () => {
    const config = generateStrykerConfig({ mutate: ['src/a.ts:1-1'], jsonReportPath: '.tautest/mutation.json', testRunner: 'vitest', userConfig: { inPlace: true } });

    expect(config.cleanTempDir).toBe(true);
  });

  it('replaces a user tempDirName and says so', () => {
    const options = { mutate: ['src/a.ts:1-1'], jsonReportPath: '.tautest/mutation.json', testRunner: 'vitest' as const, userConfig: { tempDirName: '.stryker-tmp/custom' } };

    expect(generateStrykerConfig(options).tempDirName).toBe('.stryker-tmp');
    expect(getStrykerConfigDiagnostics(options).map((diagnostic) => diagnostic.key)).toContain('tempDirName');
  });
});

describe('runStryker leaves files to Stryker', () => {
  function tempProject(prefix: string): string {
    return mkdtempSync(path.join(tmpdir(), `tautest-stryker-${prefix}-`));
  }

  it('passes the config to Stryker unchanged', async () => {
    runMutationTest.mockResolvedValueOnce(undefined);
    const root = tempProject('passthrough');
    const config = { tempDirName: '.stryker-tmp', cleanTempDir: 'always' as const, ignorePatterns: ['dist'] };

    await runStryker({ cwd: root, config, jsonReportPath: path.join(root, 'm.json') });

    expect(strykerConfigs.at(-1)).toEqual(config);
  });

  // Stryker owns the sandbox and removes it (`cleanTempDir: 'always'`). When Tautest deleted temp
  // files itself, it once removed a caller's `src` folder and later another run's sandbox.
  it.each(['resolve', 'reject'] as const)('deletes nothing itself when Stryker runs %s', async (outcome) => {
    createSandboxDuringRun(outcome);
    const root = tempProject(`no-delete-${outcome}`);
    const untouched = [
      path.join(root, 'src', 'sentinel.ts'),
      path.join(root, '.stryker-tmp', 'sandbox-other-run', 'copied.ts'),
      path.join(root, '.stryker-tmp', 'tautest', 'run-1-left-by-2.0.2', 'sandbox-old', 'copied.ts')
    ];
    for (const file of untouched) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, "not Tautest's to delete");
    }

    const run = runStryker({ cwd: root, config: { tempDirName: '.stryker-tmp' }, jsonReportPath: path.join(root, 'm.json') });
    if (outcome === 'reject') {
      await expect(run).rejects.toMatchObject({ code: 'STRYKER_RUN_FAILED' });
    } else {
      await run;
    }

    // Including the sandbox this run's (mocked) Stryker created: removing it is Stryker's job.
    for (const file of [...untouched, path.join(root, '.stryker-tmp', 'sandbox-abc123', 'copied.ts')]) {
      expect(existsSync(file)).toBe(true);
    }
  });

  it('never deletes a caller-supplied tempDirName that names a real folder', async () => {
    runMutationTest.mockRejectedValueOnce(new Error('stryker failed'));
    const root = tempProject('src');
    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'src', 'sentinel.txt'), 'do not delete me');

    await expect(runStryker({ cwd: root, config: { tempDirName: 'src' }, jsonReportPath: path.join(root, 'm.json') })).rejects.toThrow();

    expect(existsSync(path.join(root, 'src', 'sentinel.txt'))).toBe(true);
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

  // Stryker's wording when its initial run finds no tests at all, which a sandbox tsconfig that
  // points outside the sandbox causes; the CLI then suggests `tautest doctor`, which explains it.
  it('maps "No tests were executed" to STRYKER_NO_TESTS', () => {
    expect(mapStrykerError(new Error('No tests were executed. Stryker will exit prematurely. Please check your configuration.'))).toMatchObject({
      code: 'STRYKER_NO_TESTS'
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
