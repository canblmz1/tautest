# GitHub PR Smoke Report

## Summary

FAIL

Same-repository PR smoke was created and both target workflows were triggered twice. Checkout, Node setup, pnpm install, build, tests, audit, package pack, and packed CLI smoke passed in the release-readiness workflow. The GitHub Action itself failed in both `tautest.yml` and `release-readiness.yml` with:

```text
Tautest did not produce JSON output. Make sure the installed CLI supports `tautest run --json`.
```

The smoke run should not be tagged as v1 yet. The action starts, but it does not successfully execute the local Tautest CLI in CI, so no mutation report, sticky PR comment, artifact upload, or cache save could be validated.

## PR Information

- PR URL: https://github.com/canblmz1/tautest/pull/1
- Base branch: `main`
- Smoke branch: `smoke/github-action`
- Commit count: 2

Commits:

- `7a0ea22` `chore: trigger GitHub Action smoke test`
- `9138d3d` `chore: verify sticky comment update`

## Workflow Runs

| Workflow | Result | Notes |
| --- | --- | --- |
| `tautest.yml` | FAIL | Triggered on both PR commits. `Checkout`, `Setup Node.js`, `Setup pnpm`, `Install dependencies`, and `Build local Tautest packages` passed. `Run Tautest` failed with no JSON output. Latest run: https://github.com/canblmz1/tautest/actions/runs/25640852434 |
| `release-readiness.yml` | FAIL | Triggered because the PR changed `docs/**`. `Lint`, `Typecheck`, `Test`, `Build`, `pnpm audit --prod`, package pack, and packed npm smoke passed. `Local GitHub Action smoke` failed with the same no-JSON-output error. Latest run: https://github.com/canblmz1/tautest/actions/runs/25640852436 |

Earlier first-commit runs failed with the same root error:

- `tautest.yml`: https://github.com/canblmz1/tautest/actions/runs/25640821166
- `release-readiness.yml`: https://github.com/canblmz1/tautest/actions/runs/25640821161

## Tautest Action Checks

| Check | Result | Notes |
| --- | --- | --- |
| Workflow triggered | PASS | Both `Tautest` and `Release Readiness` triggered on the PR and on the second pushed commit. |
| Checkout fetch-depth 0 | PASS | `actions/checkout@v4` log shows `fetch-depth: 0`. |
| Install completed | PASS | `pnpm install --frozen-lockfile` completed in both workflows. |
| Tautest action executed | PASS | `uses: ./packages/github-action` started and received expected inputs. The GitHub token was masked as `***`. |
| Mutation run completed | FAIL | Action failed before producing a parsed Tautest JSON result. |
| Sticky comment created | FAIL | PR comments list is empty. The action failed before comment creation. |
| Sticky comment updated | FAIL | Second commit triggered another run, but no initial sticky comment existed and the action failed before update. |
| Artifact uploaded | FAIL | GitHub artifacts API returned `total_count: 0` for both latest workflow runs. |
| Cache restore/save visible | PARTIAL | `cache: true` was passed to the action in `tautest.yml`, but the run failed before save. Logs did not show a useful restore/save result. |
| Permission handling OK | FAIL | Same-repo `pull-requests: write` is configured, but comment permission behavior was not actually validated because the action failed before calling the PR comment path. |

## Issues Found

### P0

- GitHub Action cannot execute Tautest CLI successfully in CI.
  - Problem: During install, pnpm warns that it could not create `node_modules/.bin/tautest` because `packages/cli/dist/index.js` does not exist yet. The workflow builds packages after install, but pnpm does not recreate the missing bin shim. The action then cannot reliably find the local CLI and fails with no JSON output.
  - Evidence: Latest `tautest.yml` run logs include `Failed to create bin ... packages/cli/dist/index.js`, then `Run Tautest` fails with `Tautest did not produce JSON output`.
  - Impact: Blocks v1 tag for the GitHub Action because the primary PR workflow cannot produce report/comment/artifact/cache outputs.
  - Suggested fix: Make the action invoke the workspace CLI deterministically after build, for example via a known local package path, a `pnpm --dir <workspace> exec tautest` strategy, or a workflow/action preflight that rebuilds/relinks the workspace CLI before running. Add an action unit test or CI smoke that covers the workspace package case.

### P1

- Node.js 20 action runtime deprecation warning.
  - Problem: GitHub logs warn that Node.js 20 actions will be forced to Node.js 24 by default starting June 2, 2026 and removed from runners on September 16, 2026.
  - Impact: v1 may work today but will need a runtime migration soon.
  - Suggested fix: Plan a `runs.using: node24` migration after validating dependencies and GitHub runner support.

- Artifact and sticky comment paths are unvalidated in live PR.
  - Problem: Because the action fails before parsing output, artifact upload and sticky comment code paths do not run.
  - Impact: Core product workflow remains unproven on GitHub PRs.
  - Suggested fix: Re-run this same PR smoke after fixing the CLI invocation issue and verify comment create/update plus artifact upload.

- Cache behavior is not observable enough.
  - Problem: Logs do not clearly report cache restore/save hits, misses, or skipped save when the run fails.
  - Impact: Harder to validate incremental Stryker cache behavior in PR smoke.
  - Suggested fix: Add explicit action log lines for cache key, restore hit/miss, missing cache file, and save result without logging secrets.

### P2

- `pnpm install` creates workspace bin warnings before build.
  - Problem: The warning itself is expected when a workspace CLI points to unbuilt `dist/index.js`, but it confused the action path.
  - Impact: Once action invocation is fixed, the warning may still be noisy.
  - Suggested fix: Consider a `prepare`/prebuild strategy for local development or document that CI must build before invoking local bins.

## Final Recommendation

DO_NOT_TAG

Do not create a v1 tag yet. The same-repository PR smoke proves that workflows trigger and most release-readiness checks pass, but the GitHub Action does not complete its core job. The next release step should be a small targeted fix to the action's CLI invocation strategy, followed by re-running this PR smoke and confirming:

- mutation run completes,
- PR sticky comment is created,
- second commit updates the same sticky comment,
- `.tautest` artifact is uploaded,
- cache restore/save behavior is visible,
- `fail-on-threshold` behavior is correct.

## Fix Attempt 1 - Local CLI Path Invocation

Status: pushed to the smoke branch for live PR re-run.

What changed:

- The GitHub Action no longer relies on `node_modules/.bin/tautest` as the primary invocation path when it is running inside this monorepo.
- The action now resolves the workspace root from `GITHUB_WORKSPACE` and checks for `packages/cli/dist/index.js`.
- If the built local CLI exists, the action runs:

```text
node <workspaceRoot>/packages/cli/dist/index.js run --base <base> --threshold <threshold> --json
```

- The command still uses the configured `working-directory` as `cwd`, so `examples/vitest-basic` remains the project root for diff detection, config loading, and report output.
- If the built local CLI does not exist, the action falls back to:

```text
pnpm exec tautest run --base <base> --threshold <threshold> --json
```

- JSON parse and CLI failure diagnostics now include the attempted command, invocation strategy, exit code, local CLI path existence, `pnpm exec tautest --version` result, and the last 100 lines of stdout/stderr.

Files changed:

- `packages/github-action/src/index.ts`
- `packages/github-action/src/tautest-cli.ts`
- `packages/github-action/test/action.test.ts`
- `packages/github-action/dist/index.js`
- `packages/github-action/dist/index.js.map`
- `docs/GITHUB_PR_SMOKE_REPORT.md`

Local test result:

| Command | Result |
| --- | --- |
| `pnpm --filter @tautest/github-action test` | PASS |
| `pnpm --filter @tautest/github-action build` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS |
| `pnpm build` | PASS |
| `pnpm lint` | PASS |

Expected re-run result:

- `tautest.yml` should execute the local built CLI with `node packages/cli/dist/index.js`.
- The action should reach mutation execution and produce JSON output.
- If mutation execution completes, sticky comment, artifact upload, and cache behavior can be validated on the same PR.
- Do not tag v1 until the live PR workflow confirms those paths.
