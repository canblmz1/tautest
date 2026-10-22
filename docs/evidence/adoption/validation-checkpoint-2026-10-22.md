# First user-validation checkpoint

Checked 22 October 2026. This starts the 22 October–21 November roadmap; it does not claim independent adoption. The repository baseline is `45087b7d547127f6d48ac6509921d078cd4d34c6`. Existing user work was preserved in the original checkout; this evidence lives on its own branch.

| Roadmap work | Result | Remaining work |
| --- | --- | --- |
| R01 clean supported setup | Published 2.1.4 installs; two normal tests pass twice; init/doctor/run/analyze succeed | Published verify hits an installed-runner discovery error; fix is reviewed and CI green, awaiting merge/release decisions |
| R02 evidence ledger | [Ledger initialized](validation-ledger.json), with downloads separate from usage | Record maintainer-owned outputs when available; unknowns remain unknown |
| R03 existing pilots | Vimgym/TriAD public assets, source hashes and current issue status refreshed; both reports import with published 2.1.4 | No current-project engine rerun or independent maintainer trial in this refresh |
| R06 first reproduced blocker | [PR #55](https://github.com/canblmz1/tautest/pull/55) fixes verification runner discovery without disabling other plugin discovery | Unmerged, unpublished; release candidate #54 unchanged |

## First-use blocker and fix

The newly created single-package Windows/Node 22.23.2/pnpm 10.33.1 control installed published Tautest 2.1.4, Vitest 4.1.8 and Stryker core/runner 10.0.0. It selected exactly the changed source line and reported one executed survivor among four mutants. A candidate boundary test passed on original source, but published verify could not discover the installed runner and exited 12 rather than claiming success.

The isolated fix appends the selected runner when no explicit plugin list is provided, retaining Stryker's default discovery and user plugin configuration. It leaves mutant matching, scores and exit behavior unchanged. The final packed candidate verifies the exact mutant; its killing-test ID resolves to the new behavior assertion. A direct replacement also fails that assertion and restoring source passes. See the [public reproducer and summary](https://github.com/canblmz1/tautest/tree/5eb249be04221e1a838b78853bc426eae661b136/docs/evidence/verify-runner-plugin/2026-10-22).

Fix commit: `5eb249be04221e1a838b78853bc426eae661b136`, branch `fix/verify-runner-plugin-discovery`. All 13 [head checks](https://github.com/canblmz1/tautest/pull/55/checks) passed. Local lint/typecheck/build pass; 430 workspace tests pass. Full local test command exits 1 because two of 83 script checks fail on this Windows host and reproduce on unchanged main (file-mode/symlink behavior and directory-symlink EPERM). The separate Linux Node 22/24 CI test, coverage, build, package-smoke and compatibility checks pass. Independent review identified and resolved the default-checker discovery risk and checked the final package hash and raw kill attribution.

The automated control produced its first report 95,339 ms after installation started, using an existing pnpm store and including intervening Git/setup/test commands. This is not a cold-install benchmark, a speed improvement, or a maintainer's measured time to meaningful value. Initial harness quoting failure and earlier candidate iterations are retained in local evidence and distinguished from the final result.

## Current pilot handoff

The [refreshed handoff](pilot-handoff-2026-10-22.md) keeps historical engine recipes pinned and adds a separately checked current 2.1.4 report-only path. [Import evidence](current-report-review-2026-10-22.json) preserves immutable input URLs/hashes, commands, versions and limitations.

- Vimgym main remains `e65d98ca48f6432779b6bf2cb677d1a9116400d8`. Published 2.1.4 imports its one-target report: one Survived, score 0, one group. The target is historical debt outside the recent changed-line selection.
- TriAD main advanced to `902dec9b1178e84dc927499705b75f083a95dd90`. Address source, existing selected tests and project lockfile match the historical proof byte-for-byte. Its report imports as 13 Killed / 3 Survived / 1 NoCoverage, score 76.47%, three groups. This is the historical report's score, not a score measured on current main. Current unit configuration/baseline still needs checking before any engine refresh.
- Both inputs remain unchanged; status counts and scores are preserved. Neither Markdown report claims “Threshold passed” without an evaluated threshold. NoCoverage guidance requests test-selection/configuration/attribution checks first.
- These imports took 339 ms and 384 ms for two already-installed CLI invocations; download, installation and project tests are excluded. No general speed or user time-to-value claim follows.

No new invitations, external project PRs, merge, release or deploy were performed. Neither public issue shows another account's reply after the existing invitation at the refresh time. Confirmed independent trials, benefits, test improvements and repeat projects remain **0**; actual usage and reasons for silence remain **unknown**. The other three existing candidates are not newly reclassified in this two-project refresh.

Next concrete engineering task: validate TriAD's current selected unit configuration and passing normal baseline in a disposable checkout before updating the historical proof's SHA guard. Maintain Vimgym as the first ready handoff; accept the maintainer's own result through the existing invitation. Do not count further maintainer/agent proof runs as adoption.
