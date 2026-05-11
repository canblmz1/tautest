# Phase 2 Core Engine Report

## Goal

Move the working Phase 1 prototype logic into a production-oriented, testable `@tautest/core` package without building CLI UX or a GitHub Action.

## What Was Built

- `packages/core`
  - Strict TypeScript package.
  - Vitest unit tests.
  - `tsup` ESM build with declaration output.
  - Clean public exports through `src/index.ts`.
- Git modules
  - `git/diff.ts`: reads and parses `git diff --unified=0`.
  - `git/ranges.ts`: coalesces changed ranges and maps them to Stryker mutate strings.
- Detection modules
  - Project detection.
  - Package manager detection.
  - Vitest/Jest test runner detection.
  - AI author signal detection.
- Stryker modules
  - Programmatic config generation.
  - Programmatic Stryker runner.
  - Stryker JSON report parser.
- Scoring and output modules
  - Score verdicts: `STRONG`, `MIXED`, `WEAK`, `UNKNOWN`.
  - Markdown report builder.
  - JSON report builder.
  - Terminal summary builder.
  - AI fix prompt builder.
- Config modules
  - Defaults.
  - Zod schema.
  - `tautest.config.ts/js/mjs/cjs/json` loader.
  - `defineConfig` helper.

## Public API

The package exports from `@tautest/core`:

- Types and `TautestError`
- Git diff parsing and source filtering
- Range mapping
- Project/package-manager/test-runner/AI-author detection
- Stryker config generation, runner, and report parser
- Score utilities
- Markdown/JSON/terminal report builders
- AI prompt builder
- Config defaults, schema, loader, and `defineConfig`

## What Worked

- `pnpm test` passes.
- `pnpm typecheck` passes.
- `pnpm build` builds `packages/core` with `.d.ts` output.
- The Stryker programmatic runner is isolated in `stryker/runner.ts`.
- Pure parsing/building logic is covered by unit tests.
- Git diff parser handles:
  - modified files
  - changed line ranges
  - test/source classification
  - renamed files
  - deleted files
  - binary files
- Report parser handles a sample Stryker mutation JSON fixture and extracts:
  - mutation score
  - killed count
  - survived count
  - no-coverage count
  - timeout count
  - surviving mutant file/line/mutator/original/replacement
- Prompt builder has a snapshot test and enforces test-only fix rules.
- Monorepo support remains detect-and-warn level only.

## Verification

Commands run successfully:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Observed test result:

- 6 test files passed.
- 23 tests passed.

## Important Design Decisions

- Core has no CLI command parser.
- Core does not implement a mutation engine.
- StrykerJS remains the mutation engine.
- Stryker CLI fallback from Phase 1 was not moved into core; core runner is programmatic-only.
- File system and process operations happen inside explicit functions, not at module top level.
- `bun` can be detected as a package manager, but StrykerJS config does not receive `packageManager: "bun"` because Stryker's current option type only accepts npm, pnpm, or yarn.
- Config loading uses `jiti` so TypeScript/JavaScript config files can be loaded by core without requiring a CLI package.
- Stryker runner temporarily changes `process.cwd()` while running because Stryker resolves project files relative to the current process directory. This is acceptable for current single-run core usage but should be revisited before parallel orchestration.

## What Was Not Built

- No CLI UX.
- No GitHub Action.
- No publish workflow.
- No monorepo orchestration.
- No Jest Stryker execution validation.
- No automatic AI agent execution.
- No dashboard/cloud support.
- No custom mutation engine.

## Remaining Risks

- Stryker programmatic API stability still needs adapter-level contract tests against future Stryker versions.
- `process.chdir()` in the runner is not safe for parallel in-process mutation runs.
- Git diff parser needs more fixtures for CRLF-only changes, mode changes, quoted paths, and unusual rename cases.
- Project detection is intentionally best-effort and should not be treated as authoritative in monorepos.
- Config loader now depends on `jiti`; this is useful but should be reviewed for package size and security posture before public beta.
- Jest detection exists, but Phase 2 did not validate Jest execution with Stryker.

## Assumptions

- Phase 2 is allowed to introduce pnpm workspace metadata.
- Phase 2 is allowed to keep the Phase 1 demo diff as an uncommitted working-tree example.
- `@tautest/core` should be consumable by future CLI and GitHub Action packages.
- CLI fallback behavior belongs in a future wrapper package or an explicit optional runner mode, not in the default core runner.
- Monorepo work remains detect-and-warn until a later phase.
