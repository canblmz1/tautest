# Config Reference

Tautest config files can be:

- `tautest.config.ts`
- `tautest.config.mjs`
- `tautest.config.js`
- `tautest.config.cjs`
- `tautest.config.json`

Example:

```ts
import { defineConfig } from '@tautest/core';

export default defineConfig({
  baseRef: 'origin/main',
  outputDir: '.tautest',
  testRunner: 'vitest',
  sourceFileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  rangeCoalesceGap: 0,
  score: {
    strong: 80,
    mixed: 60,
    topMutants: 10
  },
  stryker: {
    incremental: false,
    timeoutMS: 5000,
    dryRunTimeoutMinutes: 2,
    concurrency: 2
  },
  prompt: {
    maxMutants: 10,
    style: 'agent'
  }
});
```

## Fields

- `baseRef`: default Git base ref.
- `outputDir`: report directory.
- `sourceFileExtensions`: file extensions treated as production source.
- `rangeCoalesceGap`: merge nearby changed line ranges.
- `testRunner`: `auto`, `vitest`, or `jest`.
- `score.strong`: score for `STRONG`.
- `score.mixed`: score for `MIXED`.
- `score.topMutants`: max mutants in reports and prompts.
- `stryker.incremental`: enable Stryker incremental mode.
- `stryker.incrementalFile`: custom incremental file.
- `stryker.timeoutMS`: per-test timeout.
- `stryker.dryRunTimeoutMinutes`: dry run timeout.
- `stryker.concurrency`: Stryker concurrency.
- `stryker.userConfig`: safely merged Stryker options.
- `prompt.maxMutants`: max mutants in prompt.
- `prompt.style`: `agent`, `human`, `claude-code`, `cursor`, or `codex`.

Protected Stryker fields such as `mutate`, `reporters`, `jsonReporter`, and `testRunner` are owned by Tautest for the run.
