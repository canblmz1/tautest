import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage'
    }
  }
});
