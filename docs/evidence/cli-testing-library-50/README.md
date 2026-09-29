# crutchcorn/cli-testing-library#50: controlled instability experiment

**Date:** 2026-09-29. **Purpose:** the 90-day plan v2, Sprint 1 task 4: attribute the earlier report of the same 41 mutants changing 17 statuses between two Tautest runs (56.10% vs 36.59%) to test-runner/environment behavior, to Stryker, or to Tautest.

## Verdict

- **The fixture is invalid for scoring.** Its unmutated normal suite fails on its own: 5 of 23 runs at the PR head and 4 of 20 at the PR base, so the PR did not introduce it. Do not use its score for a pilot or a blocking gate.
- **The drift comes from the project's tests and machine load, not from Tautest.** Across 11 mutation runs, every run produced the same 41 mutants with the same covering tests. Every status change traces to tests that also fail without any mutation, or to a timeout race that does not change the score. Direct Stryker with the same effective options drifts in the same way.
- **The original 12-timeout run is not reproduced.** Its temporary pilot test and machine state were not retained, and no run here produced more than 3 timeouts. Those 12 timeouts remain unexplained, and that run stays quarantined.
- **A Tautest bug was found along the way and fixed.** Published 2.0.2 stops with exit code 11 on this repo because the root `tsconfig.json` contains a `// TODO enable` comment. The experiment therefore ran on a candidate build of the fix in [#16](https://github.com/canblmz1/tautest/pull/16) (branch `fix/tsconfig-jsonc`).

## Setup

- **PR:** base `1caf209a4e42da33201bc006880abe3133ba0d8a`, head `a2c37690602e1b427d8c586b004104e67b79f2a0`, both taken from `gh api repos/crutchcorn/cli-testing-library/pulls/50`. The head is only reachable through `pull/50/head`.
- **Environment:** a disposable `node:22-bookworm` container (Debian 12, WSL2 kernel 6.6.87.2, 8 CPUs) with Node 22.23.3 and pnpm 11.21.0, installed with `pnpm install --frozen-lockfile`.
- **Toolchain:** the project's own Vitest 4.1.10, with `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` 10.0.0.
- **Tautest:** `tautest` and `@tautest/core` packed from the #16 candidate and installed with an `@tautest/core` override. Without the override, pnpm resolves the published core. [runs/versions.txt](runs/versions.txt) records the resolved paths and shows that CLI, core, Stryker, the runner and Vitest all load from the clone.
  - The `c7` and `c7-load` runs used candidate commit `68c4d84`.
  - The `final` run used `93819fb`, which reads tsconfig with the same fallback but through `json5`.
- **Clean tree:** after installation, `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` were restored, so the tracked tree matched the PR head exactly for every run.

### Experiment-only deviations

Nothing below is part of the PR. All of it was untracked and hidden through `.git/info/exclude`. Every run's mutate scope contained only the PR's own 12 ranges in 6 source files.

- **Workspace-root run:** the package's `tsconfig.json` extends `../../tsconfig.json`, so a package-root Stryker sandbox would not contain it.
- **[`vitest.stryker-root.config.ts`](vitest.stryker-root.config.ts):** the package's own Vitest options, rooted at the workspace, minus coverage and typecheck. The package's own config passed 52/52 once, with no type errors.
- **Tautest config:** `tautest.config.json` sets that Vitest config, `concurrency: 7` and `ignorePatterns: ["website"]` (the `website` workspace is unrelated to the package).
- **Direct Stryker config:** mirrors Tautest's generated config. It uses the same mutate ranges, `vitest.related: false`, timeout, concurrency and ignores, and differs only in the temp dir and report path. See `runs/*/stryker.direct.config.json`.
- **No pilot test:** the temporary pilot test from the original run was not recreated.

**Why the corpus harness was not used:** the harness installs only published Tautest versions, and published 2.0.2 cannot run on this repo (exit 11). The workspace-root setup also needs untracked config files, which the harness does not support.

## Results

### Unmutated normal suite

All runs used the same Vitest config Stryker uses.

| Commit | Runs | Runs with failures | Failing tests |
| --- | ---: | ---: | --- |
| head `a2c3769` | 23 | 5 | `toHaveErrorMessage should pass during stderr when no string passed`, `… when string passed` |
| base `1caf209` | 20 | 4 | `toHaveErrorMessage should pass during stderr when no string passed`, `not.toBeInTheConsole should fail something is console` |

Per-run results for the head are in [runs/normal-suite-head.json](runs/normal-suite-head.json). The base runs were checked from console output only; their JSON was not kept.

**Cause:** the failing tests assert on stderr or console contents right after `render()` resolves, without waiting for the child process to write (for example `tests/matchers.spec.ts:48-65`). That is a race in the project's tests.

### Mutation runs

Each run produced the same 41 mutants, with the same covering tests for each one. Runs are listed in execution order. `T` is Tautest and `D` is direct Stryker. The raw reports are in `runs/<set>/` with only the per-file `source` text removed, which the frozen SHA reproduces; all mutant and test fields are verbatim.

| Set | Run | Killed | Timeout | Survived | No coverage | Score |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| quiet (`c7`) | T1 | 8 | 3 | 20 | 10 | 26.83% |
| | D1 | 11 | 1 | 19 | 10 | 29.27% |
| | T2 | 11 | 0 | 20 | 10 | 26.83% |
| | D2 | 11 | 0 | 20 | 10 | 26.83% |
| | D3 | 11 | 0 | 20 | 10 | 26.83% |
| | T3 | 8 | 3 | 20 | 10 | 26.83% |
| 8 CPU-bound processes alongside (`c7-load`) | T1 | 16 | 0 | 15 | 10 | 39.02% |
| | D1 | 17 | 0 | 14 | 10 | 41.46% |
| | T2 | 17 | 0 | 14 | 10 | 41.46% |
| | D2 | 16 | 0 | 15 | 10 | 39.02% |
| final candidate, quiet (`final`) | T | 8 | 3 | 20 | 10 | 26.83% |

In the `final` set, the normal suite ran before and after Tautest ([before](runs/final/normal-before.txt), [after](runs/final/normal-after.txt)). Before, it failed 1 of 52 (`not.toBeInTheConsole should fail something is console`, the same race); after, it passed 52/52. Tautest changed no tracked file.

### Which mutants changed status, and why

**3 mutants in `src/helpers.ts:7-8` (fake-timer detection) switch between Timeout and Killed.** Each mutant makes `waitFor` use real timers while fake timers are active. The killing test, `if you switch from fake timers to real timers during the wait period you get an error`, then hangs until one of two timeouts fires:

- Vitest's own test timeout, giving **Killed**.
- Stryker's mutant timeout, giving **Timeout**.

Both statuses count as detected, so the score does not change. The switch happens in both tools.

**8 mutants in `src/index.ts:15` and `src/helpers.ts:28` (the `typeof testRunnerGlobals.afterEach === "function"` checks) change between Survived and Killed.**

- **Coverage:** per-test coverage records no covering test for them, so Stryker runs the whole suite against each one.
- **On a quiet machine:** they survived in every run except one kill in D1.
- **Under load:** they were killed in some runs.
- **What killed them:** all 23 kills came from three tests that were also seen failing on unmutated code (`not.toBeInTheConsole should fail something is console` 15, `toHaveErrorMessage should pass during stderr when no string passed` 5, `… when string passed` 3).
  - The two `toHaveErrorMessage` tests failed unmutated at the head.
  - `not.toBeInTheConsole` failed unmutated at the base, and at the head in the `final` set's pre-run check.
  - All three live in `tests/matchers.spec.ts`, which the PR does not change; its only test-file change is the type test `tests/vitest-globals.test-d.ts`.

  These are **false kills**, and load makes them more frequent, which raised the score from about 27% to about 40% for both tools.

### Hypotheses

- **Tautest-owned: rejected.** Tautest and direct Stryker produced the same mutants, the same covering tests, the same two classes of status change and the same score ranges under the same effective options.
- **Stryker-owned: not indicated.** Stryker recorded what the tests did; each changed status traces to a test that also fails on unmutated code, or to the timeout race above.
- **Test suite / environment: supported.** The flaky tests exist at both head and base, and CPU load increases the false kills.

## Consequences

- Keep this repository advisory-only. Its score cannot back a blocking gate until the normal suite passes repeatedly.
- The upstream fix would be test-only: wait for the output (`findByError`, `waitFor`) before asserting on it. No issue or PR has been filed; the plan requires the maintainer's permission first.
- The unmerged `fix/corpus-installed-runner` branch says the Linux normal suite "passed 53/53". That was a single run (52 PR tests plus the pilot test) and does not show stability. Correct it when that branch is reviewed.

## Reproduce

These scripts are the ones used, and they expect a Docker volume holding the clone at `/work/repo`:

1. Clone the repo into the volume, then `git fetch origin pull/50/head` and check out the head SHA.
2. Run [setup.sh](setup.sh) with `BASE` and `HEAD` set. It installs the project and the published 2.0.2 toolchain, restores tracked files and writes the root Vitest config.
3. To run the candidate, pack `packages/core` and `packages/cli` from the fix branch, add an `overrides: "@tautest/core": file:<core.tgz>` entry to `pnpm-workspace.yaml`, then run `pnpm add -Dw file:<cli.tgz> @stryker-mutator/core@10.0.0 @stryker-mutator/vitest-runner@10.0.0` and restore the three tracked files.
4. Run the mutation sets:
   - `LABEL=c7 CONCURRENCY=7 TIMEOUT_MS=5000 ROUNDS=3 bash mutate-runs.sh`
   - the same with `LABEL=c7-load ROUNDS=2`, after starting 8 busy processes (`node -e "for(;;){}" &`).
5. Compare mutant by mutant: `node compare-runs.mjs runs/c7/*.mutation.json runs/c7-load/*.mutation.json`.
