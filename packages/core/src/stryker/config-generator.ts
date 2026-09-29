import type { PartialStrykerOptions } from '@stryker-mutator/api/core';
import type { GenerateStrykerConfigOptions, StrykerConfigDiagnostic } from '../types';

const PROTECTED_KEYS = new Set(['mutate', 'reporters', 'jsonReporter', 'testRunner']);

/** @deprecated No longer used: Tautest now runs Stryker in its default `.stryker-tmp` temp dir. */
export const TAUTEST_STRYKER_TEMP_DIR = '.stryker-tmp/tautest';

// Stryker copies the project to `<tempDirName>/sandbox-*` and rewrites tsconfig `extends`,
// `references`, `include`, `exclude` and `files` entries that point outside the project by
// prepending exactly `../../`. That is only correct when the sandbox sits two directories below
// the project, so the temp dir must stay one path segment deep. A deeper one sent a package's
// `"extends": "../../tsconfig.base.json"` to a file that does not exist, and Vitest ran no tests.
const STRYKER_TEMP_DIR = '.stryker-tmp';

export function generateStrykerConfig(options: GenerateStrykerConfigOptions): PartialStrykerOptions {
  const base = buildBaseStrykerConfig(options);
  const config = mergeStrykerConfig(base, options.userConfig);

  // An in-place run's backup directory can hold the only copy of the original sources, so keep
  // Stryker's default of leaving it behind when the run fails.
  if (config.inPlace) {
    config.cleanTempDir = true;
  }

  return config;
}

export function getStrykerConfigDiagnostics(options: GenerateStrykerConfigOptions): StrykerConfigDiagnostic[] {
  return diagnoseStrykerConfig(buildBaseStrykerConfig(options), options.userConfig);
}

function buildBaseStrykerConfig(options: GenerateStrykerConfigOptions): PartialStrykerOptions {
  const base: PartialStrykerOptions = {
    allowConsoleColors: false,
    // Stryker deletes only the sandbox this run created, after a failed run too, so Tautest itself
    // never deletes files and concurrent runs never touch each other's sandboxes.
    cleanTempDir: 'always',
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
    tempDirName: STRYKER_TEMP_DIR,
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

  return base;
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

export function diagnoseStrykerConfig(base: PartialStrykerOptions, userConfig?: PartialStrykerOptions): StrykerConfigDiagnostic[] {
  if (!userConfig) {
    return [];
  }

  const diagnostics: StrykerConfigDiagnostic[] = [];

  for (const [key, userValue] of Object.entries(userConfig)) {
    const baseValue = base[key];

    if (baseValue === undefined || sameValue(baseValue, userValue)) {
      continue;
    }

    if (PROTECTED_KEYS.has(key)) {
      diagnostics.push({
        severity: 'warning',
        key,
        message: `Tautest owns Stryker \`${key}\` for changed-line mutation runs; the value from stryker.userConfig is ignored.`,
        suggestion: 'Remove this key from stryker.userConfig. Use Tautest config or CLI flags for mutation scope, reporters, JSON output, and runner selection.'
      });
      continue;
    }

    if (isObject(baseValue) && isObject(userValue)) {
      for (const nestedKey of Object.keys(userValue)) {
        const nestedBaseValue = baseValue[nestedKey];
        const nestedUserValue = userValue[nestedKey];

        if (nestedBaseValue !== undefined && !sameValue(nestedBaseValue, nestedUserValue)) {
          diagnostics.push({
            severity: 'warning',
            key: `${key}.${nestedKey}`,
            message: `Tautest overrides Stryker \`${key}.${nestedKey}\` for this run.`,
            suggestion: 'Keep only non-conflicting nested Stryker options in stryker.userConfig, or move supported settings into top-level Tautest config.'
          });
        }
      }
      continue;
    }

    diagnostics.push({
      severity: 'warning',
      key,
      message: `Tautest run settings override Stryker \`${key}\` from stryker.userConfig.`,
      suggestion: 'Move supported settings such as timeoutMS, dryRunTimeoutMinutes, concurrency, or incremental into the Tautest stryker config block.'
    });
  }

  return diagnostics;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}
