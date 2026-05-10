import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['examples/vitest-basic/src/**/*.test.ts'],
    environment: 'node',
    globals: false
  }
});

