import { defineConfig } from '@tautest/core';

export default defineConfig({
  testRunner: 'vitest',
  baseRef: 'HEAD',
  outputDir: '.tautest',
  stryker: {
    incremental: false
  }
});
