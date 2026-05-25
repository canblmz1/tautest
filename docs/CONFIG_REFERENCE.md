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
    concurrency: 2,
    jestConfigFile: 'config/jest.config.cjs'
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
- `stryker.vitestConfigFile`: explicit Vitest config path relative to the project root.
- `stryker.jestConfigFile`: explicit Jest config path relative to the project root.
- `stryker.userConfig`: safely merged Stryker options.
- `prompt.maxMutants`: max mutants in prompt.
- `prompt.style`: `agent`, `human`, `claude-code`, `cursor`, `codex`, or `opencode`.
- `llm.enabled`: opt into `tautest prompt --suggest` provider execution from config.
- `llm.provider`: currently `external-command`.
- `llm.command`: executable that reads the prompt from stdin and writes Markdown to stdout.
- `llm.commandArgs`: arguments passed to `llm.command`.
- `llm.model`: optional model or wrapper name recorded in suggestion provenance.
- `llm.redact`: enable built-in secret redaction before provider handoff.

Protected Stryker fields such as `mutate`, `reporters`, `jsonReporter`, and `testRunner` are owned by Tautest for the run.

When `stryker.userConfig` contains a value that Tautest overrides for a changed-line run, Tautest now reports a Stryker config diagnostic in terminal, Markdown, JSON, and the GitHub Action job summary. Move supported settings such as `timeoutMS`, `dryRunTimeoutMinutes`, `concurrency`, and `incremental` into the top-level `stryker` block instead of duplicating them in `stryker.userConfig`.
