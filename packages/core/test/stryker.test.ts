import { describe, expect, it } from 'vitest';
import { diagnoseStrykerConfig, generateStrykerConfig, getStrykerConfigDiagnostics, mergeStrykerConfig } from '../src/stryker/config-generator';
import { parseStrykerMutationReport } from '../src/stryker/report-parser';
import { mapStrykerError } from '../src/stryker/runner';
import { TautestError } from '../src/types';

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
