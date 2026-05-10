# Tautest Technical Risks

## Risk Summary

The highest-risk part of Tautest is not mutation execution itself; StrykerJS owns that. The main risk is reliably narrowing mutation testing to changed source lines, producing trustworthy reports, and fitting the workflow into PR runtime and GitHub permission constraints.

## Risk Register

| Risk | Severity | Likelihood | Why It Matters | Validation Plan | Mitigation |
| --- | --- | --- | --- | --- | --- |
| Stryker programmatic API risk | High | Medium | A deep dependency on Stryker internals could break across releases or expose fewer stable hooks than the CLI workflow. | Build the first prototype through Stryker CLI/config invocation. Only test programmatic API after CLI flow works. Pin Stryker major/minor in early releases. | Prefer CLI plus generated config in v0.1-v0.3. Treat programmatic API as an optimization, not a foundation. |
| Vitest/Jest runner risk | High | Medium | Runner behavior affects coverage analysis, related-test selection, ESM handling, custom environments, browser mode, and performance. | Create fixture projects for Vitest, Jest CJS, Jest ESM, TS path aliases, jsdom, and simple Vite projects. Run Stryker dry runs and mutation runs against all fixtures. | Support a narrow compatibility matrix first. Expose escape hatches for Stryker config overrides. Document unsupported runner modes. |
| Git diff line-range mapping risk | High | High | Incorrect mapping can skip relevant mutants or include too much code, damaging trust and runtime. | Test diff parsing against added lines, edited lines, deleted lines, renamed files, moved files, CRLF/LF changes, formatting-only diffs, and TypeScript source maps where relevant. | Start with changed production lines in final files only. Merge adjacent ranges. Fall back to whole-file mutation when mapping confidence is low. Always report scoped files and ranges. |
| Runtime and cold-start time risk | High | High | Mutation testing is inherently slower than normal tests. If PR runs feel too slow, adoption fails. | Benchmark small, medium, and worst-case fixtures. Track total time, Stryker dry-run time, mutant count, average mutant time, and GitHub Action overhead. | Hard cap changed files, changed lines, mutants, and timeout. Provide `--max-mutants`, `--timeout`, and "report-only/no-fail" modes. Cache dependencies and Stryker incremental files where safe. |
| AI fix prompt quality risk | Medium | High | Generic prompts will waste agent time or create low-value tests. Prompt output is a core differentiator. | Run generated prompts through at least two AI coding agents on fixture projects. Measure whether proposed tests kill the target mutants without overfitting. | Include exact mutant metadata, changed source context, relevant test files, existing test style, and explicit acceptance criteria. Keep prompts deterministic and compact. |
| Monorepo risk | High | Medium | Package boundaries, multiple test configs, workspace roots, and changed-file ownership can make simple diff-to-runner mapping unreliable. | Test one simple workspace only after single-package flow is stable. Identify whether package detection can be deterministic from lockfiles and config files. | Keep v1 monorepo support out of scope. In early versions, allow users to run Tautest from a package directory. Add explicit `--root` and `--base-ref` rather than auto-solving workspace graphs. |
| GitHub Action permission risk | High | Medium | Sticky PR comments need comment read/write permissions, which behave differently for forks, Dependabot, and restricted org settings. | Validate same-repo PR, fork PR, private repo, Dependabot PR, and restricted-token scenarios. Verify update existing comment and create new comment flows. | Use minimal documented permissions. Degrade to job summary/artifact when comment write is unavailable. Avoid unsafe `pull_request_target` patterns for untrusted code. |

## Detailed Notes

### Stryker Programmatic API Risk

The safest early architecture is to call StrykerJS the same way users do: via `npx stryker run` and config. StrykerJS documents CLI and config workflows heavily, including `mutate`, `reporters`, `jsonReporter`, `testRunner`, `dryRunOnly`, `incremental`, and `force`.

Tautest should not require a private hook into mutation scheduling. If a future version uses a programmatic API, it should be wrapped behind an internal adapter with contract tests and version pinning.

Decision for MVP: use Stryker CLI plus generated config.

### Vitest/Jest Runner Risk

Vitest and Jest support in StrykerJS is real, but not uniform.

Vitest runner considerations:

- The Vitest runner uses the user's installed Vitest version.
- `vitest.related` defaults to true in Stryker's runner, which can improve speed but may miss tests when source files are not directly imported.
- Browser mode is not supported by the Stryker Vitest runner.
- The runner controls some non-overridable options, including disabling Vitest coverage and watch mode.

Jest runner considerations:

- ESM projects may need `testRunnerNodeArgs` such as `--experimental-vm-modules`.
- Custom Jest environments can require special handling for Stryker coverage analysis.
- `enableFindRelatedTests` can reduce test execution but may be wrong for integration-style tests.

Decision for MVP: support simple Vitest and Jest projects first; fail clearly with setup diagnostics when runner configuration is outside the supported path.

### Git Diff Line-Range Mapping Risk

The core Tautest feature depends on mapping Git hunks to valid Stryker mutation ranges.

Potential failure modes:

- Added lines map cleanly, but modified lines appear as delete/add pairs.
- Deleted-only changes have no current line to mutate.
- Renames can be detected inconsistently depending on Git options.
- Formatting-only changes can create many changed ranges with little test value.
- Mutants may span columns or adjacent lines outside the exact changed hunk.
- A changed line can alter behavior through callers not directly visible in the hunk.

Decision for MVP: target final-file added/modified line ranges. For deleted-only changes, report "no current source range" and optionally mutate the containing file in later versions. When range mapping is ambiguous, fall back to whole-file mutation with an explicit warning.

### Runtime and Cold-Start Time Risk

Cold start includes dependency resolution, Stryker startup, initial dry run, sandbox creation, mutation generation, runner boot, and per-mutant test execution. Even line-scoped mutation can be slow if a changed line generates many mutants or if the relevant tests are heavy.

Decision for MVP: runtime guardrails are product features, not implementation details. Tautest should surface skipped work and caps rather than silently running forever.

Recommended initial caps:

- Maximum changed source files: 10.
- Maximum changed source lines: 200.
- Maximum mutants: 200.
- Default CI timeout: 10 minutes.
- Default local timeout: no hard timeout, but warnings after 5 minutes.

### AI Fix Prompt Quality Risk

Prompt generation must be grounded. A useful prompt should include:

- Project test runner.
- Changed files and line ranges.
- Surviving mutant file, line, replacement, and mutator name.
- Nearby source context.
- Existing nearby tests, when discoverable.
- Clear instruction to add or strengthen tests, not modify production behavior unless the mutant reveals a real bug.
- Acceptance criteria: rerun Tautest or Stryker and kill the listed mutants.

Decision for MVP: generate a prompt artifact even before deep test discovery. Improve prompt quality through fixture-based evaluation.

### Monorepo Risk

Monorepo support is deceptively broad. The hard parts are package ownership, multiple Stryker configs, multiple test runner configs, dependency graph selection, changed files across package boundaries, and CI caching.

Decision for v1: monorepo automation is out of scope. Tautest may work if invoked from a package root, but it should not promise workspace-wide orchestration.

### GitHub Action Permission Risk

GitHub PR comments use issue comment APIs because every pull request is also an issue in GitHub's API model. Creating or updating comments requires write permissions that can be unavailable on forked PRs, Dependabot PRs, or restricted repositories.

Decision for v0.3: the Action should:

- Request minimal permissions.
- Detect comment-write failures.
- Fall back to GitHub job summary.
- Avoid checking out and executing untrusted fork code under `pull_request_target` with write credentials.

## Validation Fixtures Required

- `fixtures/vitest-basic-ts`
- `fixtures/vitest-vite-ts`
- `fixtures/jest-basic-cjs`
- `fixtures/jest-basic-ts`
- `fixtures/jest-esm`
- `fixtures/no-tests-for-changed-file`
- `fixtures/large-diff-capped`
- `fixtures/renamed-file`

These fixtures are documentation targets for now; implementation can create them in the next phase.

## References

- StrykerJS configuration: https://stryker-mutator.io/docs/stryker-js/configuration/
- StrykerJS incremental mode: https://stryker-mutator.io/docs/stryker-js/incremental/
- StrykerJS Vitest runner: https://stryker-mutator.io/docs/stryker-js/vitest-runner/
- StrykerJS Jest runner: https://stryker-mutator.io/docs/stryker-js/jest-runner/
- Vitest CLI `related`: https://vitest.dev/guide/cli.html
- GitHub Actions permissions: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- GitHub issue and PR comments API: https://docs.github.com/en/rest/issues/comments

## Assumptions

- Early versions can require users to install StrykerJS and the relevant Stryker runner as dev dependencies.
- The CLI can generate a temporary Stryker config without permanently modifying the user's project.
- A line-range scoped mutation run is valuable even when it does not produce a full project mutation score.
- It is acceptable to fail open into "report only" mode when GitHub comment permissions are unavailable.
- Fixture-driven compatibility testing is enough before broader public beta.
