---
"@tautest/core": patch
"tautest": patch
---

Trust fixes found by running the published 2.0.0 release against real `unjs/ohash` pull requests:

- `runStryker` now cleans up the sandboxes Stryker leaves in Tautest's own `.stryker-tmp/tautest` directory in a `finally` block, instead of relying only on Stryker's `cleanTempDir`, which does not always run when instrumentation breaks a test before the run completes. Leftover sandboxes no longer break a later plain test run. It removes only Stryker's `sandbox-*` directories, and only when that directory's real path is exactly `.stryker-tmp/tautest` inside the project, with no symlink or junction along the way. A caller-supplied `tempDirName` (possible because `runStryker` is a public `@tautest/core` API) and in-place runs, whose backups may be the only copy of the original sources, are left to Stryker.
- A broken initial (dry-run) test run now maps to `STRYKER_DRY_RUN_FAILED` with a docs recipe for excluding a non-behavioral test (bundle size, snapshot counts, timing) from the mutation run only. The message asks you to confirm the test also fails on unmutated code first, since a genuinely broken test in the PR raises the identical Stryker error. See [Instrumentation Breaks a Non-Behavioral Test](https://github.com/canblmz1/tautest/blob/main/docs/TROUBLESHOOTING.md#instrumentation-breaks-a-non-behavioral-test).
- Terminal and Markdown reports now say "Threshold passed; N survivor(s) still need review" when the score passed but survivors or no-coverage mutants remain, instead of implying a clean pass (the GitHub Action's PR comment and job summary do the same). Every mutant insight category (not just the generic one) now says a survivor may be an equivalent mutant rather than asserting it definitely changed observable behavior. `ConditionalExpression` survivors now get the branch insight they were meant to; their `true`/`false` replacement used to match the boolean (or, for comparisons, boundary) heuristic first, so the branch category was never reached.
- Documented an advisory first week (`fail-on-threshold: false`) for new CI adopters in the README and GitHub Action docs.

No default gate behavior, score calculation, or exit code changed.
