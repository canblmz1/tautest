import { defineConfig } from '@tautest/core';

export default defineConfig({
  testRunner: 'jest',
  baseRef: 'HEAD',
  outputDir: '.tautest',
  stryker: {
    incremental: false,
    jestConfigFile: 'jest.config.mjs'
  }
});
