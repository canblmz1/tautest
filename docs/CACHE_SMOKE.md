# Cache Smoke Status

## What the cache covers

The GitHub Action (`packages/github-action/src/cache.ts`) restores and saves the Stryker incremental cache file (`.tautest/stryker-incremental.json`) using `@actions/cache`. The cache key includes the base ref, head ref, and package manager.

## What was validated in v1

- Cache restore and save code paths exist and are wired in the action (`src/cache.ts`, `src/index.ts`).
- Graceful handling when the cache is missing was validated: the action completes successfully on a cold run.
- Cache restore/save calls do not throw on GitHub-hosted Ubuntu runners.

## What was not proven in v1

A **cache hit** — where a second run on the same PR reuses the incremental file and demonstrably reduces Stryker runtime — was not verified with timing evidence before v1 publish.

## Pending verification (open issue)

To verify a real cache hit:

1. Open a PR with a small change.
2. Run the action twice on the same PR (with no new commits between runs).
3. Confirm the second run logs a cache restore hit and completes faster than the first.
4. Capture timing in the workflow run summary.

Track progress in GitHub issue #2 (Verify cache hit observably in release-readiness workflow).
