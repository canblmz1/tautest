import { describe, expect, it } from 'vitest';
import { generateStrykerConfig, mergeStrykerConfig } from '../src/stryker/config-generator';
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

  it('generates Jest beta Stryker config with a config file path', () => {
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
