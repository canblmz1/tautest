import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "packages/cli-testing-library/tests",
    watch: false,
    globals: true,
    setupFiles: ["packages/cli-testing-library/tests/setup.ts"],
  },
});
