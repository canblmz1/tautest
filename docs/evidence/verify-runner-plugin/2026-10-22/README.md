# Installed runner discovery during verification

This is a Tautest-maintainer control, not independent adoption. It was executed on Windows, Node 22.23.2 and pnpm 10.33.1 in a new single-package project. The existing pnpm store was reused. No cold-install, performance improvement, Linux or real Jest execution claim is made.

## Problem and result

Published Tautest 2.1.4 installs successfully with Vitest 4.1.8 and Stryker core/Vitest runner 10.0.0. The existing two tests pass twice; `init`, `doctor`, changed-line `run`, and report-only `analyze` succeed. Doctor records no errors or warnings. The actual diff and selected mutation scope both contain only `src/eligibility.ts:2-2`.

```ts
export function isEligible(age: number): boolean {
  return age >= 18;
}
```

Stryker reports four mutants: three Killed, one Survived, score 75. The survivor replaces `age >= 18` with `age > 18`; both existing tests run (ages 20 and 17). A new test checks age 18 and passes against the original source. Published `verify` then exits 12 with `status: error`: `Cannot find TestRunner plugin "vitest". In fact, no TestRunner plugins were loaded.` It does not falsely claim a verified test fix.

Stryker's default plugin glob searches beside its own installation. pnpm's virtual store can put the directly installed runner elsewhere. Tautest's changed-line run already names the runner explicitly; the verification worker previously relied on discovery. The fix appends the selected built-in runner when `plugins` is unspecified. It keeps default discovery, explicit plugin lists (including an empty list), appended extras and custom runners intact. It does not merge `tautest.config.ts` into verification or change score/target/exit contracts.

The **final** packed, unpublished candidate uses `appendPlugins`. It verifies the exact same target with three completed tests; `killedBy` resolves to the new `test/boundary.test.ts` assertion. Directly applying the exact replacement in the disposable fixture also fails that named assertion (`expected false to be true`); restoring the source gives three passing tests. Source bytes remain unchanged afterward. Full identities, hashes, versions and the final tarball hash are in [summary.json](summary.json). The candidate package version is still 2.1.4; it is distinguished from the published package by its tarball and worker-source hashes.

## Reproduce

From this branch's checkout, use Node 22 and pnpm 10.33.1. The following PowerShell recipe creates a new temporary project; choose fresh directory names. It installs only pinned public packages and the local candidate tarball, creates a local Git repository with two commits, runs the normal tests and Stryker, and retains logs. It sends no GitHub messages and publishes nothing.

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm --filter tautest pack --pack-destination "$PWD/control-packs"
node scripts/verify-runner-plugin-control.mjs "$env:TEMP/tautest-runner-control-new" "$PWD/control-packs/tautest-2.1.4.tgz"
```

The exact executed local destinations were `C:/dev/tautest-product-evidence/2026-10-22/roadmap-start/clean-install-v3` and `.../packs/tautest-2.1.4.tgz`. That full run used an initial candidate. After independent review, the final `appendPlugins` candidate was rebuilt into `.../packs-final/tautest-2.1.4.tgz`, installed into the same unchanged v3 source fixture and verified again. `summary.json.finalCandidate` records **that final run**, not the earlier candidate's result. The original published-only lockfile is recoverable from the control project's committed `main:pnpm-lock.yaml`; subsequent candidate installation changes the lockfile. The current script saves the published-only lockfile before that change.

Expected key outcomes:

| Step | Expected |
| --- | --- |
| Existing suite, repeated | 2 tests pass each time |
| `init` / `doctor` / dry-run / `run` / `analyze` | Exit 0; one changed source line; 3 Killed / 1 executed Survived |
| New candidate on original source | 3 tests pass |
| Published 2.1.4 `verify` | Exit 12, error; runner discovery fails |
| Local candidate `verify` | Exit 0, verified; exact target Killed by the new boundary test |
| Full replacement applied only in the owned fixture | Exit 1 from the boundary behavior assertion |
| Restored original | 3 tests pass; source unchanged |

The script refuses to reuse an existing project directory and retains failed attempts. It puts a 240-second timeout on each external command and a 120-second verification budget on each verify call. The outer shell timeout is not a process-tree cleanup guarantee. Output is retained for inspection; a failed run must not be called a successful installation control. Verification uses Stryker's default concurrency because it reads local Stryker config, not the `concurrency: 1` in Tautest config used by `run`.

## Validation and limits

- Before the fix, the first eight worker configuration tests had five real expectation failures and three passes. After review, eleven worker cases plus eighteen review/verification tests pass (29 total).
- Final code: `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass. All 430 workspace tests pass, including 108 CLI tests.
- Full `pnpm test` exits 1: 81/83 script tests pass. Both failures reproduce on unmodified main `45087b7d547127f6d48ac6509921d078cd4d34c6` on this Windows host: file-mode/symlink assertion behavior, and `EPERM` creating a directory symlink. These are recorded separately and were not weakened or folded into this fix.
- Initial `clean-install` stopped at a Git commit-message quoting error in the control script before any mutation execution. It was a harness failure; the next run used correctly quoted PowerShell literals. No product bug or successful mutation result is attributed to that failed attempt.
- An independent agent reviewed the configuration diff and real raw reports. Its compatibility finding about preserving default checker discovery led to `appendPlugins`; the final packed candidate was then rerun.
- Stryker produces and executes mutants. Tautest's contribution here is matching the real diff, presenting the survivor with covering test names, and verifying the exact candidate test. This is not a new user's result or a claim of complete test coverage.

Local full logs remain under the executed evidence directory. This small public summary and runnable control are the reviewable evidence; large generated reports and package tarballs are not committed.
