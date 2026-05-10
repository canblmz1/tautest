# Tautest Kill Criteria

## Purpose

This document defines when Tautest should be stopped, narrowed, or continued. The goal is to avoid building a broad wrapper around StrykerJS unless the PR-diff workflow creates clear value that StrykerJS alone does not already package.

## Stop The Project If

Stop Tautest as a standalone project if any of these conditions hold after v0.1-v0.2 validation:

- StrykerJS line-range `mutate` targeting cannot reliably run against changed source lines in simple Vitest and Jest projects.
- The diff-to-range mapping skips relevant changed code often enough that developers cannot trust the result.
- Runtime is not meaningfully better than a normal StrykerJS run on small PRs.
- The report is not materially more actionable than StrykerJS JSON/HTML output.
- AI coding agents do not produce better test improvements from Tautest prompts than from pasting raw Stryker output and source context.
- The implementation requires a fragile, private StrykerJS integration instead of stable CLI/config/report behavior.
- The product message drifts into "we built a mutation engine" or otherwise becomes misleading.
- Early users primarily ask for dashboard/cloud/full-monorepo features before validating the PR-diff workflow.

Hard stop benchmark:

- In three representative small JS/TS fixture projects, Tautest cannot complete a changed-line mutation run with useful output in under 10 minutes or under 50% of the equivalent full-file/full-project mutation run, whichever is more forgiving.

## Narrow Scope If

Narrow the project instead of stopping if the core workflow works but a specific dimension is unstable.

Narrow to Vitest-only if:

- Jest ESM, custom environments, or `findRelatedTests` behavior create too much support burden.
- Vitest fixtures are reliable and substantially faster to support.

Narrow to Jest-only if:

- Vitest runner limitations, browser mode confusion, or related-test behavior make Vitest support unreliable.
- Jest fixtures are reliable in common Node and jsdom projects.

Narrow to local CLI-only if:

- GitHub comment permissions make the Action unreliable across target users.
- Users still find local reports and AI prompts valuable.

Narrow to report-only if:

- Failing PR checks on surviving mutants creates too much adoption friction.
- Teams want mutation feedback but are not ready to make it a gate.

Narrow to whole-file mutation if:

- Exact changed-line mapping is too fragile.
- Whole-file mutation for changed files still delivers acceptable runtime and useful reports.

Narrow to explicit config if:

- Auto-detection creates false confidence.
- Users can provide runner/config/root settings reliably.

## Continue If

Continue toward v1.0 if these conditions hold:

- Simple Vitest and Jest projects run successfully with low setup.
- Changed-line or changed-file scoping provides a meaningful runtime reduction.
- Surviving mutant reports are understandable without opening raw Stryker artifacts.
- AI prompts lead to test additions that kill targeted surviving mutants in fixture evaluation.
- GitHub same-repo PR sticky comments work reliably.
- Fork/restricted-token PRs degrade gracefully to job summaries.
- Users understand that Tautest is powered by StrykerJS.

## Decision Gates

### After v0.1

Decision: continue, narrow, or stop based on local technical proof.

Required evidence:

- At least one Vitest fixture passes.
- At least one Jest fixture passes.
- Reports include scoped files, scoped line ranges, and surviving mutant explanations.
- The implementation uses StrykerJS as the mutation engine.

Stop if the only viable implementation is a broad custom engine or extensive Stryker patching.

### After v0.2

Decision: continue to GitHub Action or stay CLI-only.

Required evidence:

- CLI can run from a clean checkout.
- Exit codes are predictable.
- Runtime caps work.
- AI prompt output is deterministic.
- Setup documentation is short enough for a motivated developer to follow in minutes.

Narrow if CLI value is clear but PR integration is not yet safe.

### After v0.3

Decision: continue to public beta or keep as experimental Action.

Required evidence:

- Sticky comments work on same-repo PRs.
- Restricted-token cases degrade gracefully.
- The Action does not use unsafe `pull_request_target` patterns.
- Report artifacts remain available when comments cannot be written.

Narrow if GitHub permission behavior is too confusing for public beta.

### Before v1.0 Public Beta

Decision: public beta readiness.

Required evidence:

- Compatibility matrix is documented and honest.
- Unsupported cases fail with useful messages.
- Fixture suite covers the supported matrix.
- The product pages consistently position StrykerJS as the engine.
- No v1 promise depends on monorepo orchestration, dashboard/cloud, Python, Java, or a custom mutation engine.

## Anti-Goals That Trigger Replanning

Replan immediately if the roadmap starts depending on:

- A Tautest-owned mutation engine.
- A custom mutator ecosystem.
- A hosted dashboard as a requirement for v1.
- Workspace-wide monorepo graph orchestration for v1.
- Non-JS language support for v1.
- Automatic production-code rewrites by AI agents.
- Broad PR gates based on full-project mutation scores.

## Assumptions

- A focused PR workflow is valuable even if it does not replace full mutation testing.
- Runtime and trust are the two most important adoption constraints.
- It is better to have a narrow, honest product than a broad wrapper that hides StrykerJS complexity poorly.
- Stopping or narrowing is acceptable if StrykerJS already satisfies the user need without Tautest.
