# Destiny blank-ID verification pilot — 2026-10-23

This is our own controlled experiment, not an independent user trial, acceptance or reuse. The project owner already identified the blank-ID filtering gap in [issue #181](https://github.com/agrorithms/destiny-public/issues/181#issuecomment-6343719878). This does not claim a new discovery or replace the existing `mutate:diff` workflow introduced by merged [PR #182](https://github.com/agrorithms/destiny-public/pull/182).

The proposed trial is to import one existing Stryker report, inspect one actionable group and verify one public-behavior test with published Tautest 2.1.5. Stryker generates and executes mutants; Tautest supplies report context and exact-target test verification. No speed comparison was measured.

## Smallest first look

Open the [generated report preview](review-preview.md) without installing anything. To try the CLI view, save [the review sample](observed/before.review-sample.json) using GitHub's Raw button as `before.review-sample.json`, then use Node 22 or 24:

```sh
npx --yes tautest@2.1.5 analyze --from before.review-sample.json --runner vitest
```

Open `.tautest/review/report.md`. This exact npx entry was exercised; [invocation evidence](observed/npx-first-look.json) records the result. All mutant records from the bounded source file, including Killed and Ignored records, are retained; this does not hide mutants or change that run's denominator. It is a two-active-mutant line experiment, not the owner's whole-file `--typecheck` baseline or quality gate. The sample includes just one short original source line plus blank padding and relevant recorded test names. It is an **analyze-only source excerpt, not a verify input**. [The origin record](observed/review-sample-origin.json) separates full-source and excerpt hashes. Regenerate a complete report with the pinned helper below before verification.

## Pinned conditions

- Repository: https://github.com/agrorithms/destiny-public
- Commit: `61954b029e818f4e534268f48e0a772495303598`
- Tested platform: Windows, Node 22.23.2; Linux/macOS not executed.
- Project package-lock SHA256: `34c5355690d380466682931607a13da5c97f6c89a7f83bdd7b930ae6551b246a`.
- Vitest 4.1.10; Stryker core/runner/checker 10.0.0; TypeScript 5.9.3, as installed from the original project lockfile.
- Published `tautest` and `@tautest/core` 2.1.5 installed separately under `tools/`; no local source override or dependency change in the target project.
- Original Vitest setupFiles are retained, in order: temporary DB paths followed by the no-network fetch guard. Original aliases and environment are retained; only `roster.test.ts` plus the one candidate file are selected. No global setup, app build, running service, real DB or API call.
- Single worker; related-test selection disabled; incremental disabled; source modules are loaded directly through Vitest, not `dist`.
- Only two active EqualityOperator mutants on `roster.ts:153`; excluded mutators remain visible as raw Ignored records. Original `checkers: []` retained. This is not the project's final whole-file `--typecheck` score or quality gate.

## Observed behavior

`sessionIdentity` should drop a blank membership ID while preserving the valid member ID. Replacing `id.length > 0` with `id.length >= 0` incorrectly includes `''` in the returned identity. This is distinguishable public output, and the owner's issue explicitly considers the blank filter killable.

Exact target fingerprint: file `src/lib/active-session/roster.ts`, LF-normalized source SHA256 `29be1a06c5329df56ef074cd2524e27c0489bc79873a5405c889d4aef7f13cae`, start line 153 column 80, exclusive end line 153 column 93, mutator `EqualityOperator`, replacement `id.length >= 0`. Numeric ID alone is not used for matching.

1. Original selected tests: 31/31 pass twice.
2. Exact replacement with existing tests: 31/31 pass.
3. Original source plus one candidate: 32/32 pass.
4. Exact replacement plus candidate: 31 pass, one failed deep-equality behavior assertion; no compile error, timeout or process failure counted as a kill.
5. Published Tautest verification: see `observed/summary.json` for exact target, raw before/after reports, named killer and repeated verification results.

## Reproduce without changing your own checkout

Keep this evidence directory separate from your project. Use a fresh disposable clone under this directory's `project` child. Do not run this helper in an existing working tree. It refuses a different commit, tracked modifications, existing candidate/config files, or an existing output directory, and restores its temporary source/config/test edits in `finally`.

```powershell
git clone https://github.com/agrorithms/destiny-public.git project
git -C project checkout --detach 61954b029e818f4e534268f48e0a772495303598
Push-Location project
npm ci --ignore-scripts --no-audit --no-fund
Pop-Location
Push-Location tools
npm ci --ignore-scripts --no-audit --no-fund
Pop-Location
node baseline.mjs
node prove.mjs results-local
```

The same commands were executed here, with `node prove.mjs results-equality` for the final proof and `npm install` to initially create the isolated tools lock. Supplied evidence is under `observed/`; the commands generate new root-level baseline files and a new `results-local` directory. Both helpers refuse to overwrite evidence. The main proof uses the original 31-test baseline metadata and verifies protected-file hashes before mutations.

The candidate is `blank-id.test.ts`; `candidate.patch` adds only `src/lib/active-session/tautest-blank-id.test.ts`. The script creates a temporary Vitest config extending the project config and a temporary `stryker.config.json` selecting the same bounded scope. The latter takes precedence over the untouched original `.mjs` for the verify subprocess. All changed or introduced files are restored/removed; see `observed/cleanup.json`.

Expected stdout concludes with `status: verified` and `independentAdoption: false`. Review the JSON evidence rather than treating exit 0 alone as behavior proof. Report `NoCoverage` without inferring a missing test if a different environment does not reproduce selected-test execution.

The `observed/*.excerpt.json` files are source-redacted raw report excerpts, not executable analyze/verify inputs. They preserve the target status, range, replacement, covering/killing test identities and source hash. Full raw reports remain in the local experiment and can be regenerated by the helpers; the project has no root license, so its complete source/test bodies are not redistributed here. `observed/summary.json` and the selected test-results files contain actual counts and test names.

## Setup hitches and limits

- Dependency installation used `--ignore-scripts`; native SQLite installation/app operation is not validated. The selected roster logic imports no DB module and its original tests pass.
- A relative-prefix npm tools install failed before installing the tools; retrying from the tools directory succeeded. No version was published or dependency upgraded.
- The first ConditionalExpression scope generated four active mutants (including the ID conversion). Its explicit 1–3 scope guard stopped the proof and restored files. Final `results-equality` is a new run with two active EqualityOperator targets; the first attempt is not counted as completed proof.
- Existing Tautest output paths in evidence are this machine's paths. Maintainers regenerate reports using the commands above; `prove.mjs` resolves all new paths from its own location.
- The candidate is a proposed test, not a patch sent upstream. No external comment or PR was sent by this experiment.

## Draft prepared before outreach

Your #181 already identifies the blank-ID filter; I am not claiming a new finding. I tried a tiny, disposable control at `61954b0`: existing 31 roster tests allow the `id.length >= 0` mutant, while one `sessionIdentity` output assertion catches it. Published Tautest 2.1.5 imports the Stryker report and verifies that exact source/position/replacement against the candidate. The attached reproducible bundle preserves your setupFiles and doesn't change your main checkout or replace your `mutate:diff` pipeline. Would you be willing to run this one-target trial and tell us whether importing the report and verifying the candidate saves any review friction? No need to add it as a dependency or adopt a new CI gate.

## Outreach status

One [technical invitation](https://github.com/agrorithms/destiny-public/issues/181#issuecomment-6359464469) was posted on 23 October after this experiment was prepared. This records sending only; acceptance, independent execution, confirmed benefit and reuse remain unconfirmed. The earlier draft and experiment are historical preparation, not a second invitation.
