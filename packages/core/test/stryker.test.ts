import { describe, expect, it } from 'vitest';
import { diagnoseStrykerConfig, generateStrykerConfig, getStrykerConfigDiagnostics, mergeStrykerConfig } from '../src/stryker/config-generator';
import { mapStrykerError } from '../src/stryker/runner';

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
});
