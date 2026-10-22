# TriAD: current-source Address boundary pilot

Need: [TriAD issue #145](https://github.com/Thang4869/TriAD-Backend/issues/145). Project main checked on 2026-10-22: **902dec9b1178e84dc927499705b75f083a95dd90**. This refresh reproduces the previously demonstrated 500-character Address gap; it is not a new discovery or an independent maintainer trial.

The user-visible behavior is that a normalized address of exactly 500 characters is valid, including surrounding whitespace that is trimmed first. Replacing `normalized.length > 500` with `normalized.length >= 500` rejects that valid input. Existing tests checked only a shorter valid address and blank input. The two proposed test cases distinguish the valid 500-character boundary from invalid 501 characters; they have not been submitted upstream.

## Observed result

Windows / Node **22.23.2**, npm **10.9.8**, tool installer pnpm **10.33.1**. Project locked Vitest **4.1.11** and TypeScript **5.9.3** were preserved. The project has no Stryker packages; an external isolated tool directory pins published **tautest 2.1.4**, **@tautest/core 2.1.4**, **Stryker core/runner 10.0.0**, Vitest 4.1.11 and TypeScript 5.9.3. No dependency was added to the project.

| Check | Actual result |
| --- | --- |
| Original workspace unit selection, run twice before mutation | 3/3 and 3/3 pass |
| Same existing tests under the explicit engine unit selection | Pass |
| Direct Stryker, Address line 6 only | 3 selected EqualityOperator mutants: 2 Killed / 1 Survived |
| New candidate on original source | 5/5 pass |
| Exact replacement applied manually, existing tests | 3/3 pass |
| Exact replacement applied manually, including candidate | 4 pass / 1 expected behavior assertion failure |
| Source restored, published 2.1.4 `verify` | verified / target Killed |
| A second fresh `verify` | verified / same target Killed |
| Cleanup | 7 protected project files byte-identical; tracked tree clean; temporary candidate/config removed |

All raw reports contain **8 records: 3 selected EqualityOperator mutants and 5 Ignored records from explicitly excluded mutators**. The Ignored records remain in the raw reports; no statuses or score denominators were rewritten. Before, the raw selected-scope score is 66.66666666666666%, with 2 Killed / 1 Survived / 5 Ignored. This is not a project score or PR quality-gate result. There is no NoCoverage in this narrow run; the historical full-file pilot's remaining NoCoverage record is a different scope and has not been declared resolved.

The target fingerprint is:

```text
file: src/shared/value-objects/address.ts
source SHA-256 (LF): a8148a5f847f43af2a0f9c65d6139fd9735a802d423ceba3ac4a211c2b1101e9
inclusive start: line 6, column 36
exclusive end: line 6, column 59
mutator: EqualityOperator
original: normalized.length > 500
replacement: normalized.length >= 500
```

The original report's numeric ID is 6, but matching additionally checks source hash, file, both positions, mutator and replacement. Before, `testsCompleted: 1` and covering test ID `0` maps to `value objects normalizes and validates contact and order identity values` in `tests/unit/shared/value-objects.test.ts`. Both verification runs identify the new candidate's `accepts exactly 500 characters after trimming` test as the killer. Its test ID changes from **3 to 0** between runs; file and name stay the same.

The manual replacement and raw verified target fail with the behavior assertion:

```text
expected [Function] to not throw an error but 'Error: Invalid address' was thrown
```

No compilation error, setup failure, timeout or crash is counted as a kill. Stryker generates and executes mutants. Tautest's demonstrated contribution is grouping the executed survivor with its recorded test context, then matching and verifying the candidate test against the same target.

## What a maintainer can run

Copy this evidence directory to a fresh scratch location outside a working project, including `tools/package.json`, `tools/pnpm-lock.yaml`, `tools/pnpm-workspace.yaml`, the two `.mjs` helpers and the candidate test. Use Node 22 and pnpm 10.33.1. The small tools workspace marker prevents discovery of a surrounding Tautest workspace; it adds no dependency. Start from this directory, choose unused paths and use a disposable project clone:

```sh
git clone https://github.com/Thang4869/TriAD-Backend.git ../triad-fresh-project
git -C ../triad-fresh-project checkout --detach 902dec9b1178e84dc927499705b75f083a95dd90
npm --prefix ../triad-fresh-project ci --ignore-scripts --no-audit --no-fund
cd tools
pnpm --version
pnpm install --frozen-lockfile --ignore-scripts
cd ..
node baseline-current.mjs ../triad-fresh-project fresh-baseline.json
node prove-current-address.mjs ../triad-fresh-project fresh-results fresh-baseline.json
```

The baseline helper was executed and passed after being extracted into a portable file as well; those extra checks are retained in `baseline-portability.json*`. Before the engine experiment, the same two actual baseline invocations were recorded in `baseline.json` and `baseline-1/2.tests.json`. The engine helper's recorded command used the same checkout under `../triad-project` and output `results-214-final`. The fresh names above are equivalent paths, not additional measured runs.

Expected final line: `status: verified`, `before: Survived`, `after: [Killed, Killed]`, `candidateOnOriginal: 5`, `manualMutantFailures: 1`, `independentTrial: false`. The helpers refuse another project SHA, an existing output path, or overwriting existing config/candidate files. A failed stage stops and retains logs; the proof restores production source and removes only its own temporary files in `finally`.

The current proof is separate from the old `7e41358c...` helper. Its historical SHA guard was not removed. If main advances, inspect the new source/tests/config first and make a separate pinned evidence refresh; do not simply remove the new guard either.

## Configuration, setup and limits

The original normal command uses `vitest.workspace.mts`, explicit `--project unit`, only `tests/unit/shared/value-objects.test.ts`, one worker and disabled file parallelism. The engine config imports the original `vitest.unit.config.mts` and narrows `include` to that file, then that file plus the candidate. Original setup files, node environment, alias plugin and isolation remain. `@shared/*` resolves to `src/shared/*`, not `dist`. There is no build command or globalSetup in the selected unit config. No PostgreSQL/Redis connection, Prisma generation or integration test is needed for this pure selection.

The engine uses explicit external runner-plugin resolution, `related: false`, `perTest`, one worker, incremental off and EqualityOperator only on line 6. This is an isolated co-installed-engine path, **not a project-native engine installation or validation of the new 2.1.5 plugin fix**. `engine-resolution-check.json` confirms that project resolution found no engine and all three raw reports identify StrykerJS 10.0.0. Engine selection settings and raw test identities are retained.

Project `npm ci --ignore-scripts` succeeded and did not change its lockfile or manifest. The first external-tools npm install hit npm 10.9.8's Arborist `edgesOut` failure. Tool installation recovered with pnpm; an initially unscoped pnpm 9.15.9 resolution was replaced by an explicit packageManager 10.33.1 and a successful frozen reinstall. That reinstall needed `CI=true` in this noninteractive session to replace its own isolated modules directory. These are recorded setup failures, not mutant/test results. Fresh installs with the explicit version do not need that recovery sequence. See `setup.json` and tool-install logs.

An initial harness scope guard counted all 8 raw records instead of the 3 selected mutants and stopped after its first successful direct engine run. That attempt is preserved in `results-214`; protected files were restored. The final experiment ran afresh into `results-214-final` with explicit selected-mutant accounting. The final line-6 guard was also evaluated against all three retained reports in `scope-guard-check.json`.

This pilot does not validate the full service, integration suite, broad mutation baseline, a new source-changing PR or a runtime speedup. Repeated verification is technical repeatability, not independent user reuse. The inspected upstream contribution policy requires a shared date branch and Draft PR until CI; no upstream branch, PR or invitation was created here.

## Reviewable files

- `candidate.patch`: test-only patch; `git apply --check` passed against the clean pinned clone.
- `address-boundary.test.ts`: two behavior tests, no production patch.
- `baseline.json`, `baseline-1/2.tests.json`: the actual pre-engine normal selection and names.
- `results-214-final/evidence.json`: commands, durations, versions, hashes, exact target and both verification results.
- `results-214-final/before.raw.json`, `verify.raw.json`, `verify-repeat.raw.json`: untouched engine reports with raw identities/statuses/attribution.
- `results-214-final/manual-mutant.json` and `manual-mutant-*.tests.json`: exact replacement's original-test pass and candidate assertion failure.
- `results-214-final/effective-*`, `engine-resolution-check.json`, `scope-guard-check.json`, `cleanup.json`: configuration, narrow scope and restoration checks.
- `PROJECT-LICENSE`: source project's MIT notice.

No independent trial, user-validated benefit or reuse is confirmed. Adoption counters remain zero confirmed; actual independent usage remains unknown. The next user-facing milestone is the maintainer's own run and benefit judgment through the existing invitation, followed by another real change. Do not send this as a repeated invitation.

## Compact repository handoff

[Recorded byte hashes](recorded-byte-hashes.json) compare the original experiment files directly with the public Git blobs. All three reports and the pinned tool lock are byte-identical. A Windows checkout may materialize CRLF instead of the Git blob's LF; compare downloaded Git bytes when checking the recorded capture hashes. The manifest records both hashes and JSON equality so checkout line endings are not mistaken for changed statuses, source text or target identities.

This directory preserves the successful current2.1.4 pilot, three small full raw reports, original/candidate/manual test JSON, exact target/assertion checks, configuration, cleanup, helpers and dependency lock. Independent review is in `reviewer-note.md`. `invitation-draft.txt` is a conditional internal reply draft, not an instruction to repeat the existing invitation.

Excluded: node_modules, the disposable project, installer/stdout/stderr/engine logs, sandbox request directories, the failed initial scope-guard attempt and the extra baseline-portability rerun files. They remain locally retained under `C:/dev/tautest-product-evidence/2026-10-22/roadmap-continue/triad` and the sibling disposable clone; they are not present here. Earlier sections mentioning those diagnostic logs describe the author's original run. The supplied compact raw/test evidence is reviewable without those files; the portable commands generate fresh complete output for the maintainer.
