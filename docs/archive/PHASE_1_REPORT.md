# Phase 1 Technical Spike Report

## Goal

Prove that Tautest can use a Git diff to scope StrykerJS mutation testing to changed source lines in a small Vitest project, then convert surviving mutants into a Markdown report and an AI-agent fix prompt.

## What Was Built

- `examples/vitest-basic`
  - TypeScript + Vitest demo project.
  - `src/discount.ts` contains a boundary condition: `age >= 65`.
  - `src/discount.test.ts` intentionally misses the exact `65` boundary.
- `scripts/prototype-run.ts`
  - Accepts a base ref with `--base`.
  - Runs `git diff --unified=0`.
  - Filters changed files to production source files under `examples/vitest-basic/src`.
  - Excludes test/spec files from mutation scope.
  - Converts changed lines to Stryker mutate ranges.
  - Runs StrykerJS through the programmatic API.
  - Falls back to `npx stryker run` if programmatic execution fails.
  - Writes `.tautest/prototype/mutation.json`.
  - Writes `.tautest/prototype/report.md`.
  - Writes `.tautest/prototype/fix-prompt.md`.

## What Worked

- Git diff line detection worked against the demo working tree.
- The changed production line was converted to this Stryker range:
  - `examples/vitest-basic/src/discount.ts:2-2`
- StrykerJS programmatic API worked using `new Stryker(config).runMutationTest()`.
- CLI fallback was not needed.
- Vitest runner worked through StrykerJS.
- Stryker generated 4 mutants for the scoped line.
- The weak test suite killed 3 mutants and missed 1 survivor.
- The expected survivor was produced:
  - file: `examples/vitest-basic/src/discount.ts`
  - line: `2`
  - mutator: `EqualityOperator`
  - original: `age >= 65`
  - replacement: `age > 65`
- Markdown report and AI fix prompt were generated successfully.

## Current Output

Generated files:

- `.tautest/prototype/mutation.json`
- `.tautest/prototype/report.md`
- `.tautest/prototype/fix-prompt.md`

Observed summary:

- Mutation score: `75.00%`
- Killed: `3`
- Survived: `1`
- No coverage: `0`
- Stryker execution mode: `programmatic`

## Commands Verified

```bash
npm run test:example
npm run prototype -- --base HEAD
```

Additional validation:

```bash
npx tsc --noEmit
npx tsc --noEmit -p examples/vitest-basic/tsconfig.json
```

## What Did Not Work Or Was Not Attempted

- No full CLI was built.
- No GitHub Action was built.
- No Jest support was added.
- No monorepo package graph support was added.
- No published package shape was added.
- No automatic AI agent execution was added.
- No production-code autofix behavior was added.

## Implementation Notes

- The repo was initialized as a local Git repository so the prototype can use a real `git diff`.
- The baseline commit contains `age > 65`; the current working tree changes it to `age >= 65`.
- This makes `npm run prototype -- --base HEAD` detect the boundary change as an uncommitted source diff.
- Stryker JSON locations appear to use 1-based columns. The prototype accounts for that when extracting the original source snippet.
- The Stryker programmatic API logs "No config file specified" because the spike passes options programmatically rather than loading a config file from disk. The run still uses the generated in-memory config successfully.

## Risks Remaining

- Programmatic API stability: the current API worked, but it should still be wrapped behind an adapter before productization.
- Diff parser coverage: the current parser handles the simple `--unified=0` case, but rename, delete-only, CRLF, and complex hunks need fixture tests.
- Range precision: exact line ranges worked here, but real code may need whole-statement or whole-file fallback when mutants span adjacent lines.
- Vitest compatibility: this validates only a basic Node-mode Vitest project.
- Runtime: the demo is tiny. Larger changed ranges may need mutant caps and timeout controls.
- Prompt quality: the generated prompt is strong enough for this boundary case, but should be evaluated across more mutant types.
- Git assumptions: the script assumes it is run from this repo with a valid base ref and a working Git checkout.

## Assumptions

- Phase 1 intentionally keeps scope to one Vitest demo.
- StrykerJS remains the mutation engine.
- The prototype is allowed to hardcode `examples/vitest-basic` paths.
- `.tautest/prototype` is a generated output directory and is ignored by Git.
- The current uncommitted source change is part of the demo setup for repeatable diff-based execution.
