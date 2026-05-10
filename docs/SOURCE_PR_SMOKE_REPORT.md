# Source PR Smoke Report

## Summary

PASS

Source-changing same-repository PR smoke validated the Tautest GitHub Action path that was not covered by the earlier docs-only PR. The action detected a changed production source line, completed mutation testing, parsed JSON output, created a sticky PR comment, uploaded artifacts, and updated the same sticky comment on a second commit.

Important release nuance: `main` did not yet include the earlier P0 GitHub Action fix when this smoke started. The `smoke/source-change-comment` branch was therefore based on the validated P0 fix branch so the source-changing PR could test the fixed Action code. During finalization, the deterministic local CLI invocation fix was applied to `main`; the temporary source smoke behavior change must remain out of `main`.

## PR Information

- PR URL: https://github.com/canblmz1/tautest/pull/2
- Base: `main`
- Branch: `smoke/source-change-comment`
- Commits:
  - `7a0ea22` `chore: trigger GitHub Action smoke test`
  - `9138d3d` `chore: verify sticky comment update`
  - `68db0eb` `fix: run local Tautest CLI deterministically in GitHub Action`
  - `a1cc0f0` `chore: trigger source-change action smoke`
  - `e1d3ddc` `chore: verify source smoke sticky comment update`

Source smoke change:

```diff
-  if (age >= 65) {
+  if (age >= 65 || false) {
```

Local validation before opening the PR:

- `pnpm test`: PASS
- `pnpm exec tautest run --base main --dry-run` from `examples/vitest-basic`: PASS, mutate scope `src/discount.ts:2-2`
- `pnpm exec tautest run --base main` from `examples/vitest-basic`: PASS, `STRONG (85.71%)`

## Workflow Results

| Workflow | Result | Notes |
| --- | --- | --- |
| `tautest.yml` first source run | PASS | Run https://github.com/canblmz1/tautest/actions/runs/25641161724 completed mutation testing, uploaded `tautest-report`, and created the sticky PR comment. |
| `release-readiness.yml` first source run | PASS | Run https://github.com/canblmz1/tautest/actions/runs/25641161696 passed lint, typecheck, test, build, audit, package smoke, local action smoke, and artifact upload. |
| `tautest.yml` update run | PASS | Run https://github.com/canblmz1/tautest/actions/runs/25641195838 completed mutation testing, uploaded `tautest-report`, and updated the existing sticky PR comment. |
| `release-readiness.yml` update run | PASS | Run https://github.com/canblmz1/tautest/actions/runs/25641195835 passed release readiness again and uploaded `tautest-report`. |

## Tautest Action Validation

| Check | Result | Notes |
| --- | --- | --- |
| Source change detected | PASS | Local dry-run and PR run both targeted `examples/vitest-basic/src/discount.ts:2`. |
| Mutation run completed | PASS | PR workflow produced `STRONG` mutation result with `85.71%`, `Killed: 6`, `Survived: 1`, `No coverage: 0`. |
| JSON output parsed | PASS | Action proceeded beyond parse, set outputs, uploaded artifact, and wrote PR comment. |
| Sticky comment created | PASS | First source run logged `Tautest PR comment: created.` PR comment URL: https://github.com/canblmz1/tautest/pull/2#issuecomment-4416480198 |
| Sticky comment updated | PASS | Second source run logged `Tautest PR comment: updated.` PR still has one `<!-- tautest:report v=1 -->` comment, not duplicates. |
| Artifact uploaded | PASS | `tautest-report` artifact uploaded on both `tautest.yml` source runs and both release-readiness action smokes. Latest Tautest artifact ID: `6907391924`. |
| Cache restore/save visible | PARTIAL | `cache: true` path ran and logs showed `No Tautest incremental cache file found to save.` This validates graceful cache handling, but not a cache hit. |
| Permissions OK | PASS | Same-repo PR token had `PullRequests: write`; comment create and update both succeeded. |

## Issues

### P0

None found in the source-changing PR smoke.

### P1

None remaining from this smoke. The P0 GitHub Action fix has been applied to `main`; the temporary source smoke behavior change was not applied.

### P2

- Node.js 20 action runtime deprecation warning remains.
  - Impact: Not a v1 blocker today, but GitHub warns Node 20 actions will be forced toward Node 24 in 2026.
  - Recommendation: Track a post-v1 Node 24 migration.

- Cache hit was not proven.
  - Impact: Cache restore/save path is graceful, but this smoke did not produce a saved incremental cache file to restore on the next run.
  - Recommendation: Improve cache observability in v1.1 and validate a real hit with a stable Stryker incremental file.

## Final Recommendation

READY_TO_TAG_V1

The GitHub Action source-changing PR behavior is now validated: mutation completed, JSON parsed, sticky comment created, sticky comment updated, artifacts uploaded, and permissions worked.

The GitHub Action side is ready for the v1 tag after final main-branch Release Readiness passes. Do not merge the temporary source smoke behavior change.
