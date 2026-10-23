# Xezar: verify one already identified `everyCall` survivor

Issue: [qodeca/xezar#338](https://github.com/qodeca/xezar/issues/338), particularly the maintainer's [recorded guard survivor](https://github.com/qodeca/xezar/issues/338#issuecomment-5644185747).
Pinned default branch `develop`: [`00b37e6d5d0aabb3ba305004b97ecda1a1f57ee8`](https://github.com/qodeca/xezar/tree/00b37e6d5d0aabb3ba305004b97ecda1a1f57ee8).
This is our own controlled pilot, not an independent user trial, maintainer acceptance, or repeat use. The gap was already identified by the maintainer. The deleted-adapter cleanup completed in #1095 is not part of this work; neither is the survivor tracking already added by #486.

## One observable behavior

A legal tool listing can have only refusal-only actions. In that case there are no performing calls, so its guard must not be described as "required on every call". The existing implementation protects that case with `performing.length > 0`. The selected Stryker replacement `performing.length >= 0` changes the published reference object's `everyCall` from false to true for this listing. This is not a production code defect in the original source or a claim that today's live registry contains this shape; it is a regression the current selected tests do not detect, explicitly identified in #338.

The proposed test asserts the public `buildMcpApiReference` output, using a legal `project_config` listing and the project's declared refusal action. It never invokes a tool or starts an agent/service.

| Controlled check | Observed |
| --- | --- |
| Original source, existing selected `api-reference.test.ts` | 4/4 passed twice |
| Restricted engine config, same existing file | 4/4 passed |
| One line, three active EqualityOperator mutants | Target `>= 0` Survived; `<= 0` Survived; `!==` Killed |
| Original source + proposed test | 5/5 passed |
| Exact target replacement + existing tests | 4/4 passed |
| Exact target replacement + proposed test | Four passed, one `expected true to be false` behavior assertion failed |
| Published Tautest 2.1.5 verify twice | Both `verified`; exact target `Killed`, 1 then 5 executed target tests, same named new test as killer |

Stryker generates and executes the mutants. Tautest imports the report for review and verifies the selected proposed test against the same file/source hash/exclusive range/mutator/replacement. Numeric mutant ID alone is not the identity. No speed comparison or whole-project quality improvement is claimed. The bounded three-mutant score is not the repository's nightly MCP gate. The second original `<= 0` survivor is disclosed in the before excerpt and this one-target proof does not claim to resolve all of #338.

## Smallest first look

Open [the generated report preview](review-preview.md) without installing anything. To try the CLI view, save [the review sample](observed/before.review-sample.json) using GitHub Raw as `before.review-sample.json`, then with Node 22 or 24:

```sh
npx --yes tautest@2.1.5 analyze --from before.review-sample.json --runner vitest
```

Open `.tautest/review/report.md`. This report-only invocation was actually exercised; [its control](observed/npx-first-look.json) records the paths and result. It runs no project tests, loads no project configuration and evaluates no new threshold. All nine raw mutant records from the bounded line experiment remain (six Ignored, two Survived, one Killed); its score remains 33.33%, not a whole-project gate. Only original source line 109 is retained with blank padding; full-source and sample hashes are separated in [the provenance record](observed/review-sample-origin.json). It is an **analyze-only source excerpt, not a verify input**. Regenerate the complete report with the pinned helper below before verification.

## Conditions and commands

Use exactly **Node 22.23.2** (the proof helper refuses version drift). Observed on Windows, Node **22.23.2**, 2026-10-23 UTC. Original lockfile dependencies retained: Vitest **4.1.11**, Stryker core/runner **9.6.1**, TypeScript **7.0.2**. Published `tautest`/`@tautest/core` **2.1.5** are installed separately under `tools/`. No target dependency was added or upgraded.

Copy the helpers, candidate test and tools manifest/lockfile to a fresh folder; keep `project/` and `tools/` as siblings. The actual run used the following commands (the final output directory was `results-recovery`):

```powershell
git clone https://github.com/qodeca/xezar.git project
git -C project checkout --detach 00b37e6d5d0aabb3ba305004b97ecda1a1f57ee8
Push-Location project
npm ci --ignore-scripts --no-audit --no-fund
Pop-Location
Push-Location tools
npm ci --ignore-scripts --no-audit --no-fund --legacy-peer-deps
Pop-Location
node baseline.mjs
node prove.mjs results-recovery
```

The tool lockfile was initially created with `npm install --ignore-scripts --no-audit --no-fund --legacy-peer-deps`; use `npm ci` with the committed lock for replication. The helpers invoke the installed Vitest through **npm test**, as the project's AGENTS.md requires. They reject a different SHA, tracked modifications, an existing temporary config/test, or existing evidence paths. Use a fresh folder rather than overwriting the recorded evidence.

Git for Windows is an explicit Windows prerequisite: the original Stryker config runs `chmod` on three existing mock/executable fixtures in its sandbox. The helper preserves that original build command and prepends the already installed `C:/Program Files/Git/usr/bin` only to its subprocess PATH. If installed elsewhere, set `XEZAR_PILOT_GIT_USR_BIN` to that Git `usr/bin`. It does not change the user's PATH or patch a build failure. No app/workspace compilation was required for the selected baseline. No installation scripts were run, so package lifecycle/native-build behavior is not validated.

The temporary mutation config imports the original `packages/xezar/vitest.mutation.config.ts`: its Node environment, setupFiles, home/state isolation and original test-name exclusion remain. Only inclusion is narrowed to the relevant test file(s). The original package/server selection is separately exercised by the normal tests. Related filtering is disabled, concurrency and workers are one, incremental is disabled. The full nightly scope/floor and `ignoreStatic` policy are not changed in the project. `break: 0` applies only to this temporary experimental scope so surviving targets can be inspected.

## Review artifacts and cleanup

The original selected file contributes four named tests; adding the candidate gives five passing original-code tests. The first verification records one executed target test and the repeat records five; both identify the same named candidate assertion as killer, with test IDs changing from `0` to `4`. Numeric IDs and execution order are not used as the cross-run identity. This is not a claim that every selected test executed against the mutant in both runs.

`observed/summary.json` contains versions, original/isolated lock hashes, full target fingerprint, exact test names and both verifications. `observed/*.excerpt.json` preserve raw mutant states/positions/test identifiers while removing full source/test bodies; they are review excerpts, **not inputs to verify**. The helpers regenerate full reports in the local experiment for `analyze` and `verify`. `observed/manual-mutant.json` records the actual assertion failure. `candidate.patch` adds only the proposed new test.

The source, existing tests, package/lockfiles, original configs, setup and shared isolation bootstrap are byte-hash checked and restored in `finally`; introduced configs/test are removed. Commands have a bounded timeout and clean up only the process tree they created. No compile failure, timeout, setup failure or process crash is counted as a kill. Read `observed/cleanup.json` for the final state.

A later `results-final/` run was interrupted by a daemon restart after its real behavior assertions and during first verification. Its incomplete verification is not counted. Recovery archived only the three named helper-created temporary files and its sandbox, verified all ten protected hashes unchanged, and restarted into `results-recovery/`; see `observed/interrupted-recovery.json`.

The first local attempt stopped after a real assertion failure because a diagnostic guard expected the literal property name in Vitest's abbreviated deep-equality error. That unsuccessful harness run is kept locally as `results/`, not counted as completed proof. The final candidate adds a direct boolean assertion and explicit type narrowing, retains the full public-object equality assertion, and was rerun from a clean checkout into `results-final/`.

Only the selected unit tests and bounded mutant experiment were run. No full unit/MCP suite, lint/typecheck gate, app build, browser, real agent CLI, Linux or macOS result is claimed. The outside-team PR restriction in CONTRIBUTING.md remains: no upstream PR or comment was sent by this pilot.

## One invitation draft, not sent

Your #338 already identifies the `everyCall` guard; this is not a new finding, and the deleted-adapter cleanup and existing survivor tracking are outside this example. On pinned `00b37e6`, I reproduced one boundary replacement using your locked Stryker 9.6.1/Vitest 4.1.11: the existing four selected tests permit `performing.length >= 0`, while one public-reference assertion catches the false "required on every call" answer for a refusal-only listing. Published Tautest 2.1.5 imports that report and verifies the exact target against the proposed test. The small handoff includes commands, patch and fingerprints; no project dependency/CI change or external PR is needed. Would you try the report view and share whether its context helps triage this one survivor? A first output or setup error is useful feedback too.
