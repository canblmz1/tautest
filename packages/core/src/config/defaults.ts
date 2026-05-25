import type { TautestConfig } from '../types';

export const DEFAULT_TAUTEST_CONFIG: TautestConfig = {
  baseRef: 'HEAD',
  outputDir: '.tautest',
  sourceFileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'],
  rangeCoalesceGap: 0,
  testRunner: 'auto',
  score: {
    strong: 80,
    mixed: 60,
    topMutants: 10
  },
  stryker: {
    incremental: false,
    timeoutMS: 5000,
    dryRunTimeoutMinutes: 2
  },
  prompt: {
    maxMutants: 10,
    style: 'agent'
  },
  llm: {
    enabled: false,
    provider: 'external-command',
    commandArgs: [],
    redact: true
  }
};
