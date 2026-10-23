# Waypoint: one timezone normalization test, published Tautest 2.1.5

Issue: [toxroxmysox/Waypoint#551](https://github.com/toxroxmysox/Waypoint/issues/551), requesting Stryker/Vitest on pure logic and meaningful tests for survivors.
Pinned checkout: [`dfbc0ce81a507c1f80f555b9ca5b2bd0e19d6c69`](https://github.com/toxroxmysox/Waypoint/tree/dfbc0ce81a507c1f80f555b9ca5b2bd0e19d6c69).
Observed on Windows, Node 22.23.2, 2026-10-23 UTC. No upstream changes or messages are part of this pilot.

## Observed behavior

The existing `tripTz` implementation trims the stored timezone before validating it. A valid value with surrounding spaces therefore preserves `Europe/Madrid`; removing that normalization silently falls back to `UTC`.

| Check | Observed |
| --- | --- |
| Original source, existing server-project test file | 15/15 passed, twice |
| Same tests through restricted engine configuration | 15/15 passed |
| One selected Stryker MethodExpression mutant | Survived, three covering tests executed |
| Original source + proposed test | 16/16 passed |
| Exact mutant + existing tests | 15/15 passed |
| Exact mutant + proposed test | 15 passed, one behavior assertion failed: expected Europe/Madrid, received UTC |
| Published Tautest verify, then repeated | Both verified / exact mutant Killed; four covering tests executed; new test named as killer |

This checks the existing trim contract. It does not establish that production data currently contains padded timezone values, nor that every survivor is meaningful. The maintainer should decide whether that contract is intentional. No full-module baseline mutation score is claimed.

## Smallest first look

Open the [generated report preview](review-preview.md) without installing anything. To try the CLI view, save [the review sample](observed/before.review-sample.json) using GitHub's Raw button as `before.review-sample.json`, then use Node 22 or 24:

```sh
npx --yes tautest@2.1.5 analyze --from before.review-sample.json --runner vitest
```

Open `.tautest/review/report.md`. This exact npx entry was exercised with the supplied sample; [invocation evidence](observed/npx-first-look.json) records the result. It runs no project tests, loads no project configuration and evaluates no new threshold. The sample preserves the bounded run's mutant records and relevant recorded test names, but includes only one short original source line with blank line padding. It is an **analyze-only source excerpt, not a verify input**. Full source hash, sample hash and provenance are separate in [the origin record](observed/review-sample-origin.json). Use the complete regenerated report from the helper below for verification.

Stryker generates and executes the mutant. Tautest 2.1.5 imports its report for review, then reruns the proposed test against the selected fingerprint using `verify`. No direct-Stryker speed comparison was made. This is our controlled experiment, **not independent adoption, maintainer-confirmed benefit, or repeat use**.

## Reproduce in a disposable folder

Copy this directory's helper files and `tools/` manifest + lockfile into a new folder. Keep `project/` and `tools/` siblings. Use Node 22; the actual run used Node 22.23.2. Project package manager is pnpm 10.33.0; the isolated tool folder explicitly selects 10.33.1. Existing project dependencies and lockfile are not upgraded.

```powershell
git clone https://github.com/toxroxmysox/Waypoint.git project
git -C project checkout --detach dfbc0ce81a507c1f80f555b9ca5b2bd0e19d6c69
Set-Location project
corepack pnpm install --frozen-lockfile --ignore-scripts
Set-Location ../tools
corepack pnpm install --frozen-lockfile --ignore-scripts
Set-Location ..
node baseline-current.mjs project baseline.json
node prove.mjs project results-215
```

The helper calls are the exact executed baseline/experiment commands. Install logs record the two package-manager versions and dependency outcomes. Use fresh names if `baseline.json` or `results-215` already exists; both helpers refuse to overwrite their evidence. A fresh helper directory avoids colliding with supplied `observed/` evidence.

The baseline helper runs SvelteKit sync and the existing test file twice using the original `server` project. Dummy public URLs match test configuration; **no PocketBase, dev server, production data, E2E or credentials are used**. The experiment temporarily adds a restricted config which imports the existing Vite config, retains its plugins and `server` environment, limits inclusion to the relevant test files, disables related-test filtering, and uses one worker with incremental disabled.

The isolated runner resolves **the project's Vitest 4.1.4**, Vite 8.1.0 and TypeScript 6.0.2 via local links, alongside Stryker core/runner 10.0.0 and published `tautest`/`@tautest/core` 2.1.5. No replacement test-runner version is installed into Waypoint. The source, existing tests, manifests, lockfile and original configs are hash-checked and restored in `finally`. An unexpected assertion failure or timeout fails the experiment. Only the recorded expected behavior assertion under the exact replacement supports the kill claim. The per-command timeout only targets the child process tree started by that helper.

Scope is `src/lib/shell/trip-time.ts:18-18`, MethodExpression only: one active mutant, with other mutators' raw Ignored records retained locally. The target is identified by file + normalized LF source SHA256 + exclusive source range 18:13–18:34 + mutator + replacement. Numeric ID alone is not used to match before/after reports.

## Small review artifacts

`observed/summary.json` contains versions, hashes, executed test outcomes and fingerprint; `observed/before.excerpt.json` and `verify*.excerpt.json` retain raw statuses/locations/test names. They are explicitly source-redacted excerpts, **not inputs for analyze/verify**. Full raw reports generated by the helpers remain in the local experiment; the project has no root license, so this handoff does not redistribute its complete source/test bodies. Regenerate the raw report in your own checkout for `analyze`/`verify`.

`timezone-trim.test.ts` and `candidate.patch` contain only the proposed new test. `observed/manual-mutant.json` records the exact replacement's real assertion failure. `observed/cleanup.json` records protected-file preservation. Only the selected unit test file was exercised; lint, app build, full suite, Linux and macOS were not validated by this experiment.

## Invitation draft

I maintain Tautest. For #551 I tried one bounded Stryker/Vitest case on pinned `dfbc0ce`: removing `tripTz`'s trim survives your existing tests, while a six-line padded-timezone test passes original code and fails that exact mutant (UTC instead of Europe/Madrid). Published Tautest 2.1.5 can review the report and verify the selected mutant with that test. The linked handoff includes the commands, patch and matching fingerprints; no full score or production bug claim. If preserving padded valid timezones is intended, would you try this one case and tell me whether the report-to-test verification is useful? If it is not intended, that decision is useful feedback too.

## Outreach status

One [technical invitation](https://github.com/toxroxmysox/Waypoint/issues/551#issuecomment-6359463334) was posted on 23 October after this experiment was prepared. This records sending only; acceptance, independent execution, confirmed benefit and reuse remain unconfirmed. The earlier draft and experiment are historical preparation, not a second invitation.
