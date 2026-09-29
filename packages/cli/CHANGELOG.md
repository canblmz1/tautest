# tautest

## 2.0.5

### Patch Changes

- Updated dependencies [a0dbdcf]
  - @tautest/core@2.0.5

## 2.0.4

### Patch Changes

- c84700d: Packages whose `tsconfig.json` extends a file outside the package, such as `"extends": "../../tsconfig.base.json"`, now work from the package root. Tautest 2.0.0 through 2.0.3 ran Stryker in a nested temp directory, but Stryker rewrites those paths assuming its sandbox sits exactly two directories below the project, so Vitest found no tests (`No tests were executed`) or failed with `TSCONFIG_ERROR`. Tautest now uses Stryker's default `.stryker-tmp` temp directory with `cleanTempDir: "always"`: Stryker removes the sandbox it created after every run, including failed runs, and Tautest no longer deletes any files itself. In-place runs keep Stryker's default of preserving the backup after a failure. Leftover `.stryker-tmp/tautest/` directories from 2.0.2 and 2.0.3 can be deleted.

  `tautest doctor` now warns when a tsconfig reaches a file outside the package through an `extends` array or an in-package path without `.json`, which Stryker does not rewrite for its sandbox. Stryker's `No tests were executed` error now maps to the no-tests error, whose suggestion points to `tautest doctor`.

- Updated dependencies [c84700d]
  - @tautest/core@2.0.4

## 2.0.3

### Patch Changes

- Updated dependencies [68c4d84]
  - @tautest/core@2.0.3

## 2.0.2

### Patch Changes

- 054f9cd: Sandbox cleanup is now scoped to the run that created it. Each run gives Stryker its own `.stryker-tmp/tautest/run-<pid>-<random>/` directory and removes only that afterwards, so two runs sharing a checkout no longer delete each other's sandbox (2.0.1 removed every `sandbox-*` directory under `.stryker-tmp/tautest`). Run directories left by a process that is no longer alive, for example after Ctrl+C, are removed at the start of the next run, and `.stryker-tmp/` is removed when that leaves it empty. The whole `.stryker-tmp/tautest` root is kept out of Stryker's sandbox copy, so another run's directory is never copied into this one.
- 110c14a: Show `tautest doctor` only for missing-module or zero-test compatibility errors, with a missing-module hint that also covers generated project imports. Initial-test-run and out-of-memory failures keep their specific guidance without an unrelated dependency hint; timeouts point to the supported Stryker timeout settings.
- Updated dependencies [054f9cd]
- Updated dependencies [110c14a]
  - @tautest/core@2.0.2

## 2.0.1

### Patch Changes

- 672b1d3: Trust fixes found by running the published 2.0.0 release against real `unjs/ohash` pull requests:

  - `runStryker` now cleans up the sandboxes Stryker leaves in Tautest's own `.stryker-tmp/tautest` directory in a `finally` block, instead of relying only on Stryker's `cleanTempDir`, which does not always run when instrumentation breaks a test before the run completes. Leftover sandboxes no longer break a later plain test run. It removes only Stryker's `sandbox-*` directories, and only when that directory's real path is exactly `.stryker-tmp/tautest` inside the project, with no symlink or junction along the way. A caller-supplied `tempDirName` (possible because `runStryker` is a public `@tautest/core` API) and in-place runs, whose backups may be the only copy of the original sources, are left to Stryker.
  - A broken initial (dry-run) test run now maps to `STRYKER_DRY_RUN_FAILED` with a docs recipe for excluding a non-behavioral test (bundle size, snapshot counts, timing) from the mutation run only. The message asks you to confirm the test also fails on unmutated code first, since a genuinely broken test in the PR raises the identical Stryker error. See [Instrumentation Breaks a Non-Behavioral Test](https://github.com/canblmz1/tautest/blob/main/docs/TROUBLESHOOTING.md#instrumentation-breaks-a-non-behavioral-test).
  - Terminal and Markdown reports now say "Threshold passed; N survivor(s) still need review" when the score passed but survivors or no-coverage mutants remain, instead of implying a clean pass (the GitHub Action's PR comment and job summary do the same). Every mutant insight category (not just the generic one) now says a survivor may be an equivalent mutant rather than asserting it definitely changed observable behavior. `ConditionalExpression` survivors now get the branch insight they were meant to; their `true`/`false` replacement used to match the boolean (or, for comparisons, boundary) heuristic first, so the branch category was never reached.
  - Documented an advisory first week (`fail-on-threshold: false`) for new CI adopters in the README and GitHub Action docs.

  No default gate behavior, score calculation, or exit code changed.

- Updated dependencies [672b1d3]
  - @tautest/core@2.0.1

## 2.0.0

### Major Changes

- 09d2665: Require Node.js 22 or newer. Node 20 reached end-of-life in April 2026 and Stryker 10 no longer supports it; `tautest doctor` now reports Node 20 as an error.
- f983c5c: Run the project's own Stryker instead of a bundled one. `@stryker-mutator/core` and `@stryker-mutator/api` are now peer dependencies accepting 9.6.1 or 10.x (like the runners already were), so a project on Stryker 10 no longer runs a nested Stryker 9.6.1 next to its 10.0.0 runner. `tautest init` adds Stryker 10 to new projects. Projects must install `@stryker-mutator/core` themselves; the quickstart and `tautest init` already do.

### Minor Changes

- 1af3e83: `tautest doctor` now reports an error when Vitest 5 is installed with `@stryker-mutator/vitest-runner` 10.0.0 or older. That runner executes no tests for mutants on Vitest 5 (stryker-mutator/stryker-js#6210), so every mutant would come back Survived; doctor suggests pinning `vitest` to `^4` until the runner supports Vitest 5.
- ada69ad: Respect the project's Stryker `mutate` config when scoping a run. Tautest treated every changed file with a source extension as production code, so build scripts touched by a pull request were mutated, came back NoCoverage, and dragged the score down. When the project has a Stryker config with a `mutate` list, changed files outside it are now excluded and reported as "outside Stryker mutate scope" in dry-run and no-op output. Projects without a `mutate` list keep the previous behavior.

### Patch Changes

- 3f1c79d: Load Stryker only when a mutation run starts. With Stryker as a peer dependency, package managers that do not install peers (yarn 1, npm with `--legacy-peer-deps`) left it missing and the CLI crashed at startup, even for `tautest --version` and `tautest init`. Those commands and `tautest doctor` now work without Stryker installed, and `tautest run` stops with `STRYKER_MODULE_NOT_FOUND` (exit code 12) instead.
- 8971aac: Treat a run in which Stryker generated no mutants as a no-op instead of a failed threshold. When the changed lines hold no mutable code (comments, imports, declarations), `tautest run` used to report UNKNOWN and exit 1, failing the pull request check. It now exits 2 with status `no-op` and explains why, like a pull request without production changes.
- 7086df3: Refuse to score a Stryker run in which surviving mutants executed zero tests. `@stryker-mutator/vitest-runner` 9.x and 10.0.0 report every mutant as Survived on Vitest 5 without running a single test (stryker-mutator/stryker-js#6210). Tautest scored that as WEAK 0% and failed the pull request; it now stops with `STRYKER_ZERO_TESTS_EXECUTED` (exit code 12) and names the known cause.
- Updated dependencies [3f1c79d]
- Updated dependencies [7086df3]
- Updated dependencies [09d2665]
- Updated dependencies [ada69ad]
- Updated dependencies [f983c5c]
  - @tautest/core@2.0.0

## 1.10.1

### Patch Changes

- Update Vitest development dependencies to the patched 4.1.x line so release audit passes.
- Updated dependencies
  - @tautest/core@1.10.1

## 1.10.0

### Minor Changes

- Add local-first reliability MVP commands and report helpers.

  New CLI surfaces include `predict-flaky`, `watch`, `scaffold`, `time-travel init`, and `chaos`. Core now exposes deterministic reliability report contracts, flakiness analysis, affected-test planning, scaffold generation, time-travel helper generation, and reliability HTML/Markdown rendering.

### Patch Changes

- Updated dependencies
  - @tautest/core@1.10.0

## 1.9.0

### Minor Changes

- Add readJsonFile file-path error context, readCliVersion try/catch, STRYKER_OUT_OF_MEMORY error code for heap/ENOMEM failures. Add 35 new tests covering mapEngineStatus, normalize round-trip, stryker error mapping, doctor JSON output, and cli readJsonFile error paths.
- 4aeb623: Fix escapeMarkdown square bracket injection, stable sort tiebreaker in findOwningPackage, sameValue circular reference guard, extractJson JSON validation before return, cache.ts null guard for missing workingDirectory. Expand test coverage with 16 new tests.

### Patch Changes

- Updated dependencies
- Updated dependencies [4aeb623]
  - @tautest/core@1.9.0

## 1.8.0

### Minor Changes

- Fix escapeMarkdown square bracket injection, stable sort tiebreaker in findOwningPackage, sameValue circular reference guard, extractJson JSON validation before return, cache.ts null guard for missing workingDirectory. Expand test coverage with 16 new tests.

### Patch Changes

- Updated dependencies
  - @tautest/core@1.8.0

## 1.7.0

### Minor Changes

- f78faf0: Harden error handling (git diff, JSON config load), add schema cross-field validation (strong >= mixed), fix regex DoS input size limit in llm/redact, expand test coverage with pit/mutmut/redact test suites (42 new tests), improve sanitize to escape markdown link brackets and newlines, fix codeCell to handle embedded backticks.

### Patch Changes

- Updated dependencies [f78faf0]
  - @tautest/core@1.7.0

## 1.6.0

### Minor Changes

- 21355e6: Expand test coverage with Jest fixture variants, workspace reliability suites, report.json schema contract tests; add coverage config to all vitest configs; strengthen Docker build with typecheck+test+build validation; add package-manager smoke matrix (npm, yarn) to release-readiness CI.

### Patch Changes

- Updated dependencies [21355e6]
  - @tautest/core@1.6.0

## 1.5.1

### Patch Changes

- 3863a87: Add release-readiness coverage artifacts and split GitHub Action output helpers for easier maintenance.
- 4dab235: Add Docker/devcontainer setup and package-manager adoption documentation.
- 73cb688: Document hardening-phase product boundaries and architecture decisions.
- 8947740: Improve Jest doctor diagnostics for transform stacks and test environments.
- 21d8ef2: Add stage-level performance metrics to reports and GitHub Action summaries.
- 70df5b2: Add report schema compatibility tests and a minimal IDE report consumer example.
- 5ea40c9: Expand workspace affected selection to direct workspace dependents and include package reasons in aggregate reports.
- Updated dependencies [3863a87]
- Updated dependencies [4dab235]
- Updated dependencies [73cb688]
- Updated dependencies [8947740]
- Updated dependencies [21d8ef2]
- Updated dependencies [70df5b2]
- Updated dependencies [5ea40c9]
  - @tautest/core@1.5.1

## 1.5.0

### Minor Changes

- 065ec71: Add framework recipes and workspace capability signals for Turborepo and Nx projects.
- c27c74e: Harden Jest support with explicit runner config paths, CommonJS/ESM/TypeScript fixtures, and updated compatibility diagnostics.
- 24c542e: Add an explicit opt-in LLM suggestion flow for generated fix prompts. `tautest prompt --suggest` can send a redacted prompt to a configured external command, write `.tautest/llm-suggestion.md`, and record prompt provenance without applying changes.
- 6045284: Add GitHub Action survivor annotations and expanded workflow outputs for richer PR feedback.
- 43e1c63: Add a static HTML report viewer generated from `report.json`. `tautest report --html` writes `report.html` with survivor cards, summary metrics, embedded report data, and IDE-friendly data attributes.
- 62484e4: Add runtime scope metrics and Stryker config diagnostics to CLI, JSON, Markdown, terminal, and GitHub Action summaries.
- 8eee492: Add a workspace planner beta for pnpm and package.json workspaces with dry-run package selection output.
- 73ac35d: Add sequential workspace execution with aggregate reports for selected workspace packages.

### Patch Changes

- 54c1a64: Add the Changesets release rail, guarded npm publishing workflow, and maintainer intake templates.
- Updated dependencies [065ec71]
- Updated dependencies [c27c74e]
- Updated dependencies [24c542e]
- Updated dependencies [6045284]
- Updated dependencies [54c1a64]
- Updated dependencies [43e1c63]
- Updated dependencies [6e2dbfa]
- Updated dependencies [62484e4]
- Updated dependencies [8eee492]
- Updated dependencies [73ac35d]
  - @tautest/core@1.5.0
