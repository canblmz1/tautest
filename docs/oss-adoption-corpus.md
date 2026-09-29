# OSS Adoption Corpus

Sprint 2, task 5-6 of [docs/oss-adoption-90-day-plan.md](oss-adoption-90-day-plan.md): a frozen, non-owned external-PR corpus comparing Tautest against a normal test run and against direct Stryker scoped to the same `mutate` pattern Tautest computed. Every row below is a real run recorded as-is, including failures; nothing is cherry-picked.

Rejected candidates count as evidence too. crutchcorn/cli-testing-library#50 is not a measured row: its normal test suite fails on its own. A controlled experiment traced its changing mutant statuses to those flaky tests and to machine load, with direct Stryker changing the same way. The setup, raw reports and per-mutant comparison are in [evidence/cli-testing-library-50](evidence/cli-testing-library-50/README.md).

Start a frozen run with `scripts/oss-adoption-corpus-run.mjs`; this example is ohash#196:

```bash
node scripts/oss-adoption-corpus-run.mjs \
  --repo=https://github.com/unjs/ohash.git --pr=196 \
  --base=2c6e231ccfc229ab90a3e026635984f1ccd89b1d \
  --head=a65d622c4c390061baf408b0ecdf4d5031753c69 \
  --runner=vitest --package-manager=pnpm --tautest-version=2.0.5 --build --repeat=2
```

Use the full base/head SHAs recorded for each PR below. The harness leaves its clone for inspection and exits non-zero if a step fails. For ohash#151 and #195, the unconfigured Tautest run is expected to fail on a bundle-size assertion; their successful mutation rows require an opt-in test exclusion in that clone, as shown for #195 below. The harness alone does not produce those successful rows.
The default normal-test command is the locally installed `vitest run` or `jest --runInBand` (no registry fallback); pass `--normal-test-script=<package.json-script>` when that commit needs its own test setup.
Pass `--repeat=2` (up to 5) for a pilot-acceptance check: the harness reruns the normal suite and Tautest, compares each repeated raw mutant status with the first run, and returns `status: unstable` plus a non-zero exit if any mutant or mutate range changes. A single `status: ok` pair remains only a point measurement.
The fenced commands use Bash `\` continuations; in PowerShell, put each command on one line.

`--build` runs `<package-manager> run build` — the target commit's own build script through its own locally installed toolchain. Do not hardcode a specific build tool: see the ohash#151 entry below for what went wrong when this script used to do that.

Installing Stryker rewrites the project's `package.json` and lockfile. The harness now restores every tracked file the setup changed (recorded as `setupModifiedTrackedFiles`) and refuses to measure unless the tracked tree matches the PR head exactly, so Tautest's diff is the PR's own. The runs below were first recorded with an older harness that did not restore them: that inflated Tautest's changed-files count (4 instead of 2 on ohash#196, where `package.json` and `pnpm-lock.yaml` were the extra two) but not the mutate scope or any mutant result. Re-running ohash#196 with the fixed harness gave the same 5 killed and 3 timeout, with `prChangedFiles` and Tautest's changed-files count both at the PR's 2 files.

**Old runtime comparisons are exploratory, not like-for-like benchmarks.** Earlier versions of the harness ran Tautest from the local checkout (`packages/cli/dist/index.js`) rather than installing it in the target project. On ohash#195, a module-resolution probe found Vitest 4.1.8 loaded from the Tautest checkout in all nine observed Vitest-loading processes, while direct Stryker used the project's Vitest 4.1.10. The same setup may confound the other entries; their resolved module paths were not checked. Those historical timing numbers are not repaired retroactively.

The current harness requires an exact `--tautest-version`, installs that **published version** inside the cloned project, and records the CLI, core, Stryker, runner and test-framework paths and versions. It refuses to compare mutants if the normal suite or a setup step fails. For direct Stryker it copies the *effective Stryker config recorded in Tautest's raw report*, retaining test-related options while changing the temporary directory and JSON output path, forcing the JSON-only reporter, and omitting dashboard credentials; it then compares every mutant by file, mutator, location, replacement and status. `status: ok` means one such pair agreed, **not** that scores or runtimes are repeatable across runs or that Tautest is faster. This harness does not measure unreleased local code; a separate packed-package smoke must verify CLI and core from the same candidate build.

Two harness fixes from 2026-09-29 affect reproducibility:

- **Frozen installs first.** The project install now tries `pnpm install --frozen-lockfile` (`npm ci` for npm) and falls back to a regular install only if that fails, recording `installMode` and the frozen failure. Before, it always ran `--no-frozen-lockfile`, so a rerun could resolve different versions.
- **One-segment temp dir for direct Stryker.** The direct run's temp dir is `.stryker-tmp-direct` (was `.stryker-tmp/direct-corpus`). Stryker rewrites tsconfig paths that leave the project by prepending exactly `../../`, so a nested temp dir broke packages whose tsconfig extends a monorepo root config and could fake a Tautest/direct difference.

Beware a same-version local tarball test under pnpm: installing a local `tautest` tarball and a local `@tautest/core` tarball at the workspace root did **not** make the CLI use the local core in our experiment. Its dependency still resolved the published `@tautest/core@2.0.2`; an explicit override and resolution-path check were needed. A tarball version number alone does not prove which code was tested.

On 2026-09-28, the new harness reproduced ohash#196 with Tautest/core 2.0.2, Stryker/runner 10.0.0 and the cloned project's Vitest 4.1.7: normal tests passed, 2 PR files were counted, and all 8 mutant statuses matched direct Stryker (5 killed, 3 timeout). A second run on defu#156 used Vitest 4.1.2 and matched its one killed mutant. The one ordered pair on each PR took 72.9s/35.6s (ohash) and 49.3s/16.9s (defu), Tautest/direct respectively, on a Windows machine in use; these are **not** an overhead estimate. Repeat runs, order reversal and load control are still needed before making a speed claim.
An additional `--repeat=2` run on defu#156 passed the normal suite twice and killed the same single mutant on both Tautest runs, with unchanged mutate scope. That checks this small fixture's repeatability, not the broader ecosystem; order reversal and load control are still needed before making a speed claim.
The same `--repeat=2` check on ohash#196 passed both normal suites and reproduced all 8 mutant statuses in the first Tautest run, direct Stryker, and the second Tautest run (5 killed, 3 timeout; unchanged mutate scope). The ordered wall times were 67.5s, 19.8s, and 16.6s. The first-run cost changed dramatically within one clone, so neither the earlier pair nor this sequence isolates a Tautest-specific overhead.

## Status

**As of 2026-09-29: 10 PRs measured under the Sprint 2 protocol, from 6 repositories** (unjs/ohash, unjs/defu, unjs/destr, radashi-org/radashi, pmndrs/zustand, moment/luxon). Every measured row has retained raw reports. Tautest matched direct Stryker mutant for mutant in all ten, and every repeated run matched the first. Of 13 attempted PRs:
- **10 measured.**
- **1 no-op:** zustand#3511, a type-only change with no mutants.
- **1 unstable:** luxon#1790. A Killed/Timeout race that direct Stryker shows too.
- **1 rejected:** cli-testing-library#50, whose normal suite is flaky.

See the ledger below. **The plan v2 corpus target is met:** at least 10 measured PRs across at least 5 non-owned repositories, 3 of them outside `unjs`, including a Jest row (luxon#1787) and a multi-production-file PR (radashi#481).

The runs surfaced one Tautest defect: Jest related-test lookup was left on, fixed in 2.0.5 (#23). They also surfaced three setup findings that users can hit:
- Stryker 10 refuses a project's Babel 7 config.
- pnpm `minimumReleaseAge` blocks a same-day Tautest release.
- A project's tests may need its CI environment, such as luxon's `TZ`.

Plan task 8 is still open: full-file direct Stryker, Stryker incremental mode, and median/p90 runtimes on the valid corpus.

## Sprint 2 attempt list (fixed before any run, 2026-09-29)

These are the plan v2 task 7 attempts, chosen by a rule before any result was seen. Every attempt is recorded below whatever its outcome; none is dropped after the fact.

- **Repositories.** They must be single-package JS/TS repositories that install into `node_modules` (no Yarn PnP) and use a supported runner. Excluded on that basis: toss/es-toolkit (Yarn 4 PnP), date-fns/date-fns (Vitest 5, which no released Stryker runner supports yet), iamkun/dayjs (Jest 22), remeda/remeda (npm workspaces, not yet supported by the harness). Added: radashi-org/radashi (Vitest 2.1, pnpm), pmndrs/zustand (Vitest 4.1, pnpm) and moment/luxon (**Jest 29**, npm).
- **PRs.** For each added repository, take the two most recently merged PRs that change at least one production file (under `src/`, not a test) and at least one test file, skipping bot, dependency, release and docs-only PRs. For the multi-production-file requirement, take the most recently merged PR across the three added repositories that changes at least two production files and a test file. The rule is implemented by [`scripts/oss-adoption-corpus-select.mjs`](../scripts/oss-adoption-corpus-select.mjs); its raw output is in [evidence/corpus-selection](evidence/corpus-selection).
- **Protocol.** Every attempt runs through the harness with `--tautest-version=2.0.4 --repeat=2 --evidence-dir=docs/evidence/<repo>-<pr>`, in a disposable `node:22-bookworm` container. A row counts as measured only with harness status `ok`: normal suite passing twice, Tautest matching direct Stryker mutant for mutant, and the repeated Tautest run matching the first.

| # | Attempt | Why selected | Harness options |
| ---: | --- | --- | --- |
| 1 | unjs/ohash#196 | existing row, revalidation | `--build` |
| 2 | unjs/defu#156 | existing row, revalidation | |
| 3 | unjs/destr#136 | existing row, revalidation | |
| 4 | unjs/ohash#151 | existing row, revalidation | `--build --exclude-from-mutation=test/bundle.test.ts` (documented bundle-size deviation) |
| 5 | unjs/ohash#195 | existing row, revalidation | `--build --exclude-from-mutation=test/bundle.test.ts` (documented bundle-size deviation) |
| 6 | radashi-org/radashi#486 | newest qualifying PR | |
| 7 | radashi-org/radashi#485 | second newest qualifying PR | |
| 8 | pmndrs/zustand#3511 | newest qualifying PR | |
| 9 | pmndrs/zustand#3469 | second newest qualifying PR | |
| 10 | moment/luxon#1790 | newest qualifying PR (Jest) | `--runner=jest --package-manager=npm` |
| 11 | moment/luxon#1787 | second newest qualifying PR (Jest) | `--runner=jest --package-manager=npm` |
| 12 | radashi-org/radashi#481 | newest multi-production-file PR (`src/array/counting.ts`, `src/array/diff.ts`) | |

If a repository's normal suite needs its own build or setup step, that step is added and recorded, and the attempt without it stays in the table.

**Addendum after the runs.** The protocol said 2.0.4 for every row. The two luxon rows were rerun with Tautest 2.0.5 after the corpus exposed a Tautest defect, fixed in #23. Their 2.0.4 attempts stay in the ledger, and every other row is on 2.0.4.

## Failure ledger

Every attempt under the Sprint 2 protocol, with every earlier attempt of the same PR kept alongside it. Unless a row says otherwise, each attempt used published Tautest 2.0.4 installed in the clone, Stryker 10.0.0, a frozen lockfile, `--repeat=2`, and a disposable `node:22-bookworm` container (Node 22.23.3). A row counts as **measured** only with harness status `ok`: normal suite passing twice, Tautest identical to direct Stryker mutant for mutant, and the repeated Tautest run identical to the first. Base and head SHAs were checked against the GitHub API.

| # | Attempt | Result | Runner, package manager | Mutants (Tautest; direct Stryker and repeat identical unless noted) | Setup, deviations, earlier attempts | Evidence |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | unjs/ohash#196 | **measured** | Vitest 4.1.7, pnpm 11.2.2 | 8: 5 killed, 3 timeout | `--build` | [sprint2/unjs-ohash-196](evidence/sprint2/unjs-ohash-196) |
| 2 | unjs/defu#156 | **measured** | Vitest 4.1.2, pnpm 10.33.0 | 1: 1 killed | | [sprint2/unjs-defu-156](evidence/sprint2/unjs-defu-156) |
| 3 | unjs/destr#136 | **measured** | Vitest 3.1.1, pnpm 10.7.0 | 39: 30 killed, 9 survived | | [sprint2/unjs-destr-136](evidence/sprint2/unjs-destr-136) |
| 4 | unjs/ohash#151 | **measured, deviation** | Vitest 3.0.7, pnpm 10.5.2 | 79: 47 killed, 6 timeout, 26 survived | `--build`; `test/bundle.test.ts` excluded from the mutation run only (bundle-size assertion) | [sprint2/unjs-ohash-151](evidence/sprint2/unjs-ohash-151) |
| 5 | unjs/ohash#195 | **measured, deviation** | Vitest 4.1.10, pnpm 11.2.2 | 92: 77 killed, 12 survived, 3 no coverage | same as #151 | [sprint2/unjs-ohash-195](evidence/sprint2/unjs-ohash-195) |
| 6 | radashi-org/radashi#486 | **measured** | Vitest 2.1.9, pnpm 10.29.3 | 2: 1 killed, 1 survived | | [sprint2/radashi-org-radashi-486](evidence/sprint2/radashi-org-radashi-486) |
| 7 | radashi-org/radashi#485 | **measured** | Vitest 2.1.9, pnpm 10.29.3 | 4: 4 killed | | [sprint2/radashi-org-radashi-485](evidence/sprint2/radashi-org-radashi-485) |
| 8 | radashi-org/radashi#481 | **measured**, two production files | Vitest 2.1.9, pnpm 10.29.3 | 8: 8 killed | | [sprint2/radashi-org-radashi-481](evidence/sprint2/radashi-org-radashi-481) |
| 9 | pmndrs/zustand#3469 | **measured**, install deviation | Vitest 4.1.0, pnpm 10.18.3 | 11: 7 killed, 4 timeout | Attempt 1: the project's pnpm `minimumReleaseAge: 1440` refused the same-day 2.0.4 release. Attempt 2: `--allow-fresh-tautest` (age waived for tautest and @tautest/core only) | [sprint2/pmndrs-zustand-3469](evidence/sprint2/pmndrs-zustand-3469) |
| 10 | pmndrs/zustand#3511 | **no-op** | Vitest 4.1.5, pnpm 11.3.0 | none: Stryker generates no mutants for the type-only change at `src/middleware/devtools.ts:99` | Attempt 1 recorded the no-op as an error; the harness now reports it as `no-op` | [sprint2/pmndrs-zustand-3511](evidence/sprint2/pmndrs-zustand-3511) |
| 11 | moment/luxon#1790 | **unstable** | Jest 29.4.3, npm 10.9.9 | 4 mutants, 100% every time; on the repeated run all 4 turn from Killed to Timeout (attempts 3 and 5) | Its mutants make a test hang, and whether Jest's test timeout (Killed) or Stryker's mutant timeout (Timeout) fires first varies between runs, **in direct Stryker too** (controlled run in `timeout-experiment.txt`: Tautest T,T; direct T,K; both K after a normal run). Attempts: 1 without luxon's CI timezone; 2 Stryker 10 (Babel 8 refuses luxon's Babel 7 config); 3 and 5 with `--build --env=TZ=America/New_York,LIMIT_JEST=yes --stryker-version=9.6.1` on 2.0.4 and 2.0.5; 4 failed cloning (network) | [sprint2/moment-luxon-1790](evidence/sprint2/moment-luxon-1790) |
| 12 | moment/luxon#1787 | **measured** (Jest) | Jest 29.4.3, npm 10.9.9 | 24: 16 killed, 7 timeout, 1 no coverage (Tautest 2.0.5, Stryker 9.6.1) | `--build --env=TZ=America/New_York,LIMIT_JEST=yes --stryker-version=9.6.1`. Attempts 1 and 2 as for #1790. Attempt 3 on 2.0.4 stopped with `No tests were executed`: Tautest left Jest's related-test lookup on, and it found no test; fixed in 2.0.5 (#23) | [sprint2/moment-luxon-1787](evidence/sprint2/moment-luxon-1787) |
| 13 | crutchcorn/cli-testing-library#50 | **rejected** | Vitest 4.1.10, pnpm 11.21.0 | workspace root: same 41 mutants, statuses drift in both tools | the normal suite fails on its own (5 of 23 runs at the head); workspace-root Vitest config, `website` ignore | [cli-testing-library-50](evidence/cli-testing-library-50/README.md) |

**Measured: 10 PRs from 6 repositories**, 3 of them outside `unjs` (radashi, zustand, luxon), including a Jest row (luxon#1787) and a multi-production-file PR (radashi#481). Seven rows need no deviation beyond their project's own setup, one needed an install-only waiver, and two use the documented bundle-size exclusion. The rows before this protocol (Windows desktop, local CLI build, raw reports not retained) are superseded by rows 1–5; their history stays in each entry below.

**Reproduce a row** with the harness command at the top of this file plus the options in its row; each evidence directory holds the result row with every recorded setting, the raw Stryker reports, the direct Stryker config and the environment. **Reproduce the rejected row** with the scripts and steps in its evidence log.

## unjs/ohash#196 — `fix(utils): diff falsy primitive values`

Vitest, pnpm. Base `2c6e231ccfc229ab90a3e026635984f1ccd89b1d`, head `a65d622c4c390061baf408b0ecdf4d5031753c69`. 1 changed production line (`src/utils/diff.ts:46`), 2 changed files total (source + test). Requires a build step first: `src/hash.ts` imports `ohash/crypto`, a self-reference that resolves through the package's own `exports` to `dist/`, so without a build `test/hash.test.ts`, `test/serialize.test.ts`, and `test/bundle.test.ts` all fail to load — a pre-existing environment requirement of the repo, unrelated to Tautest or Stryker.

| Step | Result |
| --- | --- |
| `pnpm install` | ok |
| `pnpm run build` (`obuild` at this commit) | ok |
| Normal `vitest run` | **75 passed** |
| Tautest (`tautest run --base 2c6e231c`) | 8 mutants, **5 killed, 3 timeout, 0 survived**, STRONG 100% (threshold 60%) |
| Tautest runtime | first run in a fresh clone: 20.8s; second run, same state: 11.7s |
| Direct Stryker, same `mutate: ["src/utils/diff.ts:46-46"]` and `plugins: ["@stryker-mutator/vitest-runner"]` | 8 mutants, **5 killed, 3 timeout, 0 survived** — identical mutant-level result to Tautest |
| Direct Stryker runtime | 9.7s on the first measurement; independent reruns of this exact command by two reviewers measured 17.3-23.3s wall time on the same PR |

**Scope agreement:** exact — Tautest's computed `mutate` pattern reproduced the identical kill/timeout/survive breakdown under raw Stryker in every rerun, including both independent reviewer reruns. No false inclusion or exclusion in this case.

**Required manual config raw Stryker did not warn about:** the direct-Stryker config needed `plugins: ["@stryker-mutator/vitest-runner"]` explicitly, or Stryker fails with `Cannot find TestRunner plugin "vitest"`. Tautest's config generator (`packages/core/src/stryker/config-generator.ts`) wires this automatically. Small, but a real first-run difference between "use Tautest" and "hand-roll a scoped `stryker.config.json`".

### Induced regression (same PR, `it.skip` on the new test)

Skipping the PR's own new test (`test/utils.test.ts` → "formats falsy primitive changes", the test that protects the exact line changed):

- Normal `vitest run`: still **74 passed, 1 skipped** — nothing here would fail a normal CI job.
- Tautest: 8 mutants, **4 killed, 3 timeout, 1 survived**, verdict **STRONG 87.50%** (threshold 60%), runtime 10.1s.
- Report line, confirmed live: *"Threshold passed; 1 surviving mutant still needs review before treating this patch as fully covered. A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change."*
- `.stryker-tmp/tautest` was empty after both this and the passing run, confirming the sandbox-cleanup fix (`packages/core/src/stryker/runner.ts`) holds on the exact case that originally surfaced the leftover-sandbox problem.

## unjs/defu#156 — `fix: prevent prototype pollution via __proto__`

Vitest, pnpm, no build step needed. Base `89df6bb1dfb4161b9d285f96e0b4ad1a993a647c`, head `5767f6f0b2478007cfcbdd102f1bee21fd7eb7f5`. 1 changed production line.

| Step | Result |
| --- | --- |
| `pnpm install` | ok |
| Normal `vitest run` | passed |
| Tautest | 1 mutant, **1 killed**, STRONG 100% (threshold 60%), 8.65s |
| Direct Stryker, same `mutate: ["src/defu.ts:10-10"]` | 1 mutant, **1 killed** — identical to Tautest, 8.47s |

Matches the README's own "Validated on real pull requests" claim for this PR (STRONG 100%, 1 mutant) with a fresh, independently reproduced run. The single timing pair (8.65s vs 8.47s) is not enough to estimate overhead; see the runner-resolution caveat above.

## unjs/destr#136 — `perf: faster plain string and known value checks`

Vitest, pnpm, no build step needed. Base `7b506be3c5d19f02e64aab81ed16d387b010ccd2`, head `50d6c82b13c30c0856b99efcdaa2f330bd3d193a`. Multi-line perf change across two ranges.

| Step | Result |
| --- | --- |
| `pnpm install` | ok |
| Normal `vitest run` | passed |
| Tautest | 39 mutants, **30 killed, 9 survived**, MIXED 76.92% (threshold 60%), 13.8s |
| Direct Stryker, same `mutate` (`src/index.ts:36-42`, `src/index.ts:47-68`) | 39 mutants, **30 killed, 9 survived** — identical, same survivor positions, 14.1s |

Matches the README's own claim for this PR (39 mutants, MIXED 77%, 9 survivors) with a fresh, independently reproduced run, including the exact same 9 survivor positions. Tautest/direct-Stryker timing near-identical (13.8s vs 14.1s).

## unjs/ohash#151 — `perf(serialize): optimized sorting algorithm`

Vitest, pnpm. Base `d7f7f9dae66992435e4960d664ca5be3485a02b2`, head `d76fb98e4e676be6c560cce6e12b06b539ded73b`. 88/-20 lines, 4 changed files — the largest entry until ohash#195, and the one that surfaced two real, useful failures before producing a clean measurement.

**Failure 1 — hardcoding a build tool broke this older commit.** The corpus script used to run `npx obuild` unconditionally for ohash (copied from the #196 entry). At this earlier commit, ohash's own `package.json` `build` script was `unbuild`, not `obuild` — the repo switched build tools between this PR and #196. `npx obuild` ignored that and fetched the newest `obuild` from the registry, which no longer matched this commit's config shape (`TypeError: rawEntries.map is not a function`). **Fix applied to the script:** `--build` now always runs `<package-manager> run build`, i.e. the commit's own build script through its own locally installed toolchain, instead of a hardcoded tool name. See `scripts/oss-adoption-corpus-run.mjs`.

**Failure 2 — the exact bundle-size dry-run failure the Sprint-1 fix targets, happening unprompted on a different PR.** After fixing the build step, `tautest run` failed with exit 12:

```
ERROR DryRunExecutor One or more tests failed in the initial test run:
	bundle size serialize
		expected 5354 to be less than or equal to 3000
ERROR Stryker There were failed tests in the initial test run.

Error: Stryker's initial test run failed before mutation testing could start. [...]
First confirm the test actually fails on the unmutated code too [...]
```

The normal `vitest run` step (recorded above the failure) had already passed, including this same bundle-size test — confirming it was instrumentation, not a real regression, exactly as the message says to check. `.stryker-tmp` was still fully removed after this failure. Applying the documented recipe ([Instrumentation Breaks a Non-Behavioral Test](TROUBLESHOOTING.md#instrumentation-breaks-a-non-behavioral-test), the no-existing-config variant) resolved it:

| Step | Result |
| --- | --- |
| `pnpm install` | ok |
| `pnpm run build` (`unbuild` at this commit) | ok |
| Normal `vitest run` | passed |
| Tautest, with `vitest.stryker.config.ts` excluding `test/bundle.test.ts` | 79 mutants, **47 killed, 6 timeout, 26 survived**, MIXED 67.09% (threshold 60%), runtime 20.77s |
| Direct Stryker, same 9 `mutate` ranges and the same excluded-test config | 79 mutants, **47 killed, 6 timeout, 26 survived** — identical to Tautest, runtime 20.22s |

**Runtime on this PR:** 20.77s vs 20.22s, from one back-to-back pair. defu (8.65s vs 8.47s) and destr (13.8s vs 14.1s) were also single pairs with small gaps. An earlier version of this paragraph called that repeated proof of near-zero overhead and dismissed ohash#196's larger gap as noise; three single pairs do not support that conclusion. All these comparisons have the harness caveat above.

## unjs/ohash#195 — `perf(diff): fused single-pass traversal`

The project uses Vitest 4.1.10, pnpm and Stryker 10.0.0. Base `a9e658cb6f895c83890a4dca4296440773f14dc4`, head `68b1580c20d28e0d34b226bc72436934f4cca4f3`. 259/-29 lines across 3 files, 156/-29 of them in the one production file, `src/utils/diff.ts` — the largest entry so far. Needs the build step for the same `ohash/crypto` self-reference as #196. Measured with a local Tautest 2.0.1 checkout at `f03ee60cd6dab79fa775614544eb34d476c5fe79` (also tagged `tautest@2.0.1`; see the runner-resolution caveat above).

**Correction: an earlier version of this file recorded #195 as unmeasurable, and that was wrong.** It said the PR's base commit no longer existed in the repository and drew a general lesson from it, that PR base SHAs can become unreachable. The SHA that was checked, `a9e658cb8f…`, was a one-character mistyping of the real base, `a9e658cb6f…`. GitHub has no commit with the mistyped SHA (`No commit found for SHA`); the real one is served by the API and present in a fresh clone. The harness's frozen-SHA check did its job by refusing the wrong SHA, but concluding that GitHub had pruned the commit was an unverified guess, and the lesson drawn from it is withdrawn. An independent audit of this corpus caught the mistake by re-querying the API. The run below takes both SHAs straight from `gh api repos/unjs/ohash/pulls/195 --jq .base.sha` (and `.head.sha`) instead of retyping them; future entries should do the same.

To reproduce the initial failure, use a clean checkout of that Tautest commit, run `pnpm install --frozen-lockfile` and `pnpm --filter @tautest/core --filter tautest build`, then run:

```bash
node scripts/oss-adoption-corpus-run.mjs \
  --repo=https://github.com/unjs/ohash.git --pr=195 \
  --base=a9e658cb6f895c83890a4dca4296440773f14dc4 \
  --head=68b1580c20d28e0d34b226bc72436934f4cca4f3 \
  --runner=vitest --package-manager=pnpm --build
```

The expected result is `status: "error"` at Tautest's dry run, after the normal suite passes. The JSON output supplies `workDir`; enter that clone and add the following *untracked* files so only Stryker excludes the bundle assertion:

```ts
// vitest.stryker.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { exclude: ['**/node_modules/**', 'test/bundle.test.ts'] } });
```

```json
{ "stryker": { "vitestConfigFile": "vitest.stryker.config.ts" } }
```

Save the JSON as `tautest.config.json`. From the clone, run `node <absolute-path-to-tautest-checkout>/packages/cli/dist/index.js run --base a9e658cb6f895c83890a4dca4296440773f14dc4 --json`, replacing the path placeholder with the checkout built above. The result's `.tautest/report.json` contains the 13 `scope.mutatePatterns`; `.tautest/mutation.json` contains the raw mutants. For a direct line-scoped comparison, save this `stryker.config.json` in the same clone and run `npx stryker run`:

```json
{
  "testRunner": "vitest",
  "packageManager": "pnpm",
  "coverageAnalysis": "perTest",
  "plugins": ["@stryker-mutator/vitest-runner"],
  "vitest": { "configFile": "vitest.stryker.config.ts", "related": true },
  "mutate": [
    "src/utils/diff.ts:3-14", "src/utils/diff.ts:23-25",
    "src/utils/diff.ts:28-64", "src/utils/diff.ts:68-79",
    "src/utils/diff.ts:82-86", "src/utils/diff.ts:88-95",
    "src/utils/diff.ts:97-137", "src/utils/diff.ts:142-142",
    "src/utils/diff.ts:144-147", "src/utils/diff.ts:149-154",
    "src/utils/diff.ts:159-183", "src/utils/diff.ts:190-190",
    "src/utils/diff.ts:209-209"
  ],
  "reporters": ["json"],
  "jsonReporter": { "fileName": "stryker-direct-report.json" }
}
```

For the full-file result, first preserve the line-scoped report, then change only `mutate` to `["src/utils/diff.ts"]` and rerun direct Stryker. The saved direct config omitted `vitest.related`, which Stryker resolved to `true`; the snippet above pins that observed value explicitly. Tautest forces `false`, as discussed below. The local JSON artifacts used for this entry were not committed, so these commands are the evidence-reproduction path rather than a pointer to durable raw reports.

| Step | Result |
| --- | --- |
| `pnpm install` | ok |
| `pnpm run build` (`obuild` at this commit) | ok |
| Normal `vitest run` | **90 passed** (5 files) |
| Tautest (`tautest run --base a9e658cb`), no extra config | exit 12, `STRYKER_DRY_RUN_FAILED`: the PR's own new bundle-size test failed Stryker's initial run (below) |
| Tautest, with `vitest.stryker.config.ts` excluding `test/bundle.test.ts` | 92 mutants, **77 killed, 12 survived, 3 no coverage**, STRONG 83.70% (threshold 60%) |
| Direct Stryker, same 13 `mutate` ranges and the same excluded-test config | 92 mutants, **77 killed, 12 survived, 3 no coverage**. The retained Tautest and direct-Stryker JSON reports agree on all 92 mutant identities and statuses (file, mutator, location, replacement). |

**Scope agreement:** exact. Tautest's 13 computed ranges reproduce the same result under raw Stryker, mutant for mutant.

**The bundle-size failure again, on a test the PR itself adds.** The same failure mode as ohash#151:

```
ERROR DryRunExecutor One or more tests failed in the initial test run:
	bundle size diff
		expected 7802 to be less than or equal to 5000
ERROR Stryker There were failed tests in the initial test run.
```

The normal run passes this test; Stryker's instrumented copy of `src/utils/diff.ts` pushes the bundle past the 5 kB budget the PR introduces. The documented recipe ([Instrumentation Breaks a Non-Behavioral Test](TROUBLESHOOTING.md#instrumentation-breaks-a-non-behavioral-test), no-existing-config variant, with the Tautest setting given as `tautest.config.json`) resolved it. This exclusion is limited to the mutation run: the bundle-size assertion still runs in the normal suite. Because it measures an instrumented bundle containing all mutants, it cannot identify which individual mutant is responsible for a size difference; nevertheless, excluding any test narrows what the mutation run checks and must be recorded explicitly.

**The threshold advisory, on a large diff.** 83.70% clears the 60% threshold with 15 mutants unresolved, and the report says so: *"Threshold passed; 12 surviving mutants and 3 uncovered mutants still need review before treating this patch as fully covered. A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change."* The survivors have not been triaged for this entry.

**What scoping buys on this PR.** Direct Stryker on the whole file (`mutate: ["src/utils/diff.ts"]`, the same excluded-test config) produced 150 mutants: 118 killed, 16 survived, 16 no coverage. The 92 line-scoped mutants had the same status in both retained reports. The other 58 sit on lines this PR did not change: 41 killed, 4 survived, 13 no coverage. Scoping omits those 17 surviving/uncovered findings from the PR report; unchanged-line mutants are not necessarily pre-existing defects, so they have not been triaged as such. An earlier two-pair local timing exercise reported 39.3s full-file vs 31.7s line-scoped (19% less wall time for 39% fewer mutants), but its per-run timing log was not retained and the test-runner stack caveat above remains. The 58-mutant scope reduction is verified; the timing difference is provisional.

**Exploratory runtime observations, not an adoption benchmark.** A previous local timing exercise on a busy desktop (around 75% CPU and 2 GB free RAM) reported the following, but did not retain the full per-run timing log:

- Five alternating pairs: Tautest median 35.8s (32.8-36.3s), direct Stryker median 30.6s (28.2-31.6s), a 5.2s (17%) gap in that sample. One earlier pair on a quieter machine was 19.8s vs 18.4s (+7%). These numbers should not be generalized while the two commands load different Vitest versions.
- Tautest's report attributes 49 ms in one run and 82 ms in a loaded run to scope/config/parse/report stages. It does not isolate process startup or explain the wall-time gap by itself.
- The retained JSON reports show a real configuration difference: Tautest sets `vitest.related: false` and ran 4 test files (86 tests); the direct run used `related: true` and ran only `test/utils.test.ts` (16 tests). Both runs produced identical mutant outcomes here, so the extra 70 tests supplied no additional kills on this PR. Tautest intentionally disables related-test selection because indirect imports can make selection incomplete ([TECHNICAL_RISKS.md](TECHNICAL_RISKS.md)); its config merge overrides a user's `stryker.userConfig.vitest.related` today.
- The timing exercise also tried direct Stryker with `related: false`, but did not isolate the remaining difference under load. The retained direct and Tautest reports both set `disableTypeChecks: true`; it is **not** an explanation for this sample. Runner resolution, other options and machine load remain confounders. Fix the harness and retain raw samples before estimating Tautest-specific overhead.

**Temp directory on 2.0.1.** Every Tautest run removed its sandbox and `.stryker-tmp/tautest/` but left an empty `.stryker-tmp/` in the project. A run with a build of the per-run temp-directory change in #12 left nothing behind.

## Next entries needed

- A Jest beta repo (none attempted yet).
- 2+ more non-owned Vitest repos beyond the unjs org, for diversity beyond one maintainer's style/tooling.
- A PR that changes more than one production file: every entry so far mutates a single source file (ohash#195's 156/-29 production lines are all in `src/utils/diff.ts`).

## Rejected candidate: crutchcorn/cli-testing-library#50

Base `1caf209a4e42da33201bc006880abe3133ba0d8a`, head `a2c37690602e1b427d8c586b004104e67b79f2a0`. **Do not count this as a clean corpus measurement or a CI pilot: its normal test suite fails on its own.** Unmutated runs failed 5 of 23 times at the head and 4 of 20 at the base; see the [evidence log](evidence/cli-testing-library-50/README.md).

**Correction: package root.** An earlier version of this section said the package root could not be measured because its `tsconfig.json` extends `../../tsconfig.json`, "which is missing from a package-root Stryker sandbox". The actual cause was narrower, and it is now fixed. Stryker rewrites such paths by prepending exactly `../../`, which assumes a sandbox two directories deep. Tautest 2.0.0–2.0.3 used deeper temp directories, and so did this harness's direct-Stryker run (`.stryker-tmp/direct-corpus`, now `.stryker-tmp-direct`). A packed build of #20 ran the package root without `TSCONFIG_ERROR`: 41 mutants, normal suite 52/52 before and after.

The workspace-root experiment used an untracked root Vitest config, an ignore pattern for the unrelated `website` symlink, and a temporary pilot test; it is not a turnkey run of the PR as submitted. On Windows, the unmutated root Vitest run failed 3 of 53 tests: two stack-trace path-separator assertions and a timing-sensitive CLI event test. An earlier version said the Linux normal suite "passed 53/53". That was a single run and does not show stability; repeated runs failed as above. Two Tautest 2.0.2 mutation runs had **the same 41 mutant identities and 17 different mutant statuses**:

| Run | Killed | Survived | No coverage | Timeout | Score |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 11 | 8 | 10 | 12 | 56.10% |
| 2 | 15 | 16 | 10 | 0 | 36.59% |

That pair's run order and machine state were not controlled. A later controlled rerun traced this kind of drift to the project's flaky tests and to machine load, with direct Stryker drifting the same way. That pair's 12 timeouts were not reproduced, because its pilot test and machine state were not kept. Either way, neither score can serve as a dependable blocking gate. A temporary test in the fixture killed a real survivor in `src/helpers.ts`, showing a possible test improvement, but that does not validate the aggregate score or constitute an upstream contribution. First stabilize the normal suite and repeat mutation outcomes, or choose a different external pilot.
