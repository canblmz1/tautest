import type { PartialStrykerOptions } from '@stryker-mutator/api/core';
import type { GenerateStrykerConfigOptions } from '../types';

const PROTECTED_KEYS = new Set(['mutate', 'reporters', 'jsonReporter', 'testRunner']);

export function generateStrykerConfig(options: GenerateStrykerConfigOptions): PartialStrykerOptions {
  const base: PartialStrykerOptions = {
    allowConsoleColors: false,
    cleanTempDir: true,
    coverageAnalysis: 'perTest',
    disableTypeChecks: true,
    dryRunTimeoutMinutes: options.dryRunTimeoutMinutes ?? 2,
    incremental: options.incremental ?? false,
    jsonReporter: {
      fileName: toPosix(options.jsonReportPath)
    },
    fileLogLevel: 'off' as PartialStrykerOptions['fileLogLevel'],
    logLevel: 'error' as PartialStrykerOptions['logLevel'],
    mutate: options.mutate,
    reporters: ['json'],
    tempDirName: '.stryker-tmp/tautest',
    testRunner: options.testRunner,
    thresholds: {
      break: 0,
      high: 0,
      low: 0
    },
    timeoutMS: options.timeoutMS ?? 5000,
    tsconfigFile: options.tsconfigFile ?? 'tsconfig.json'
  };

  if (options.concurrency !== undefined) {
    base.concurrency = options.concurrency;
  }

  if (options.packageManager && options.packageManager !== 'bun') {
    base.packageManager = options.packageManager;
  }

  if (options.incrementalFile) {
    base.incrementalFile = options.incrementalFile;
  }

  if (options.testRunner === 'vitest') {
    base.plugins = ['@stryker-mutator/vitest-runner'];
    base.vitest = {
      ...(isObject(base.vitest) ? base.vitest : {}),
      ...(options.vitestConfigFile ? { configFile: options.vitestConfigFile } : {}),
      related: false
    };
  }

  if (options.testRunner === 'jest' && options.jestConfigFile) {
    base.plugins = ['@stryker-mutator/jest-runner'];
    base.jest = {
      configFile: options.jestConfigFile
    };
  } else if (options.testRunner === 'jest') {
    base.plugins = ['@stryker-mutator/jest-runner'];
  }

  return mergeStrykerConfig(base, options.userConfig);
}

export function mergeStrykerConfig(base: PartialStrykerOptions, userConfig?: PartialStrykerOptions): PartialStrykerOptions {
  if (!userConfig) {
    return base;
  }

  const merged: PartialStrykerOptions = {
    ...userConfig,
    ...base
  };

  for (const [key, value] of Object.entries(userConfig)) {
    if (PROTECTED_KEYS.has(key)) {
      continue;
    }

    const baseValue = base[key];

    if (isObject(baseValue) && isObject(value)) {
      merged[key] = {
        ...value,
        ...baseValue
      };
    }
  }

  return merged;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}
