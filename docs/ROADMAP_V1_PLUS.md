# Roadmap V1 Plus

## Purpose

This document defines the post-v1 roadmap for Tautest. It does not add scope back into v1. The goal is to sequence future work by user pain, technical risk, and product leverage.

Tautest remains a workflow layer around existing mutation engines. For JavaScript and TypeScript, StrykerJS remains the mutation engine.

## Assumed Post-V1 Feedback

| Feedback category | Likely user wording | Product interpretation | Priority |
| --- | --- | --- | --- |
| Too slow | "This takes too long in CI." | Runtime controls, incremental cache, affected-test accuracy, and clearer skip/report-only behavior matter more than more output. | High |
| Monorepo unsupported | "Our repo has 40 packages and Tautest runs in the wrong place." | Workspace-aware package selection is the biggest adoption unlock after v1. | High |
| Jest issues | "Vitest works, Jest does not like our config." | Jest beta needs focused compatibility hardening before new language expansion. | High |
| GitHub comment permission | "Fork PRs cannot post comments." | PR feedback needs graceful fallback through job summary, artifacts, and annotations where permissions allow. | Medium |
| Prompt not actionable | "The prompt is too generic." | Prompt quality is a core differentiator; add better context and eval feedback before optional LLMs. | High |
| Stryker config conflict | "We already have a Stryker config and Tautest overrides it." | Config merge visibility and conflict diagnostics need to become first-class. | High |
| Large PR skipped | "The tool skipped the PR and gave no value." | Large diffs need sampling, capped mode, explainable skip reasons, and manual override paths. | Medium |

## Roadmap Principles

- Fix adoption blockers before adding expansion features.
- Prefer deterministic OSS workflows over hosted services.
- Keep StrykerJS as the JavaScript/TypeScript mutation engine.
- Treat monorepo support as a product capability, not just path globbing.
- Add optional LLM features only after deterministic prompts are strong.
- Defer cloud until historical data and team workflows have proven demand.

## Version Plan

### v1.1: Adoption Hardening

Theme: make v1 reliable in real JavaScript/TypeScript repos.

Scope:

- Runtime guardrails and clearer skip reasons.
- Jest beta hardening.
- Stryker config conflict diagnostics.
- Prompt quality improvements from real feedback.
- GitHub Action fallback improvements for permission failures.
- Release-readiness workflow required for tags.

Launch criteria:

- No new major features.
- 10+ real or fixture regressions covered.
- Common Stryker config merge conflicts produce actionable diagnostics.
- GitHub Action does not fail solely because a PR comment cannot be written.

### v1.2: Workspace-Aware Monorepo Beta

Theme: make Tautest usable in pnpm workspaces and simple package monorepos.

Scope:

- Workspace detection for pnpm workspaces.
- Path-based affected package detection.
- Per-package config resolution.
- Per-package CLI execution mode.
- GitHub Action matrix generation docs.
- Monorepo beta label in docs.

Launch criteria:

- Works on fixture pnpm workspace with at least three packages.
- Changed files select only affected package runs by default.
- Cross-package dependency changes are surfaced as warnings or expanded affected sets.
- Users can opt into whole-workspace mode.

### v1.5: CI Review Depth

Theme: make PR review feedback richer without requiring cloud.

Scope:

- Turborepo and Nx detection.
- PR line annotations beta.
- Local historical mutation score tracking.
- Optional LLM explanations behind explicit opt-in.
- More prompt eval fixtures.

Launch criteria:

- PR annotations work in same-repo PRs and degrade cleanly in forks.
- Historical tracking stores local artifacts without phoning home.
- Optional LLM path is disabled by default and never required for core reports.
- Turborepo/Nx support can detect affected packages or explain fallback.

### v2.0: Runner Plugin Architecture

Theme: allow non-JS mutation engines without weakening the core product model.

Scope:

- Runner plugin abstraction.
- Normalized mutation report schema across engines.
- Python plugin prototype via mutmut.
- Java plugin prototype via PIT.
- Plugin capability detection and limitations.
- Dashboard/cloud decision point based on adoption metrics.

Launch criteria:

- JavaScript/Stryker runner remains stable.
- Python and Java plugins are clearly labeled beta until compatibility is proven.
- Reports and prompts work from normalized mutant data, not engine-specific JSON.
- Cloud remains optional and is not required for OSS workflows.

## Feature Evaluation

### Runtime Guardrails

User value: users understand why a run is slow, capped, skipped, or report-only.

Technical difficulty: Medium.

Risk: overly aggressive caps can hide useful mutants.

Required module changes:

- `packages/core/src/score/score.ts`
- `packages/core/src/report/*`
- `packages/core/src/stryker/config-generator.ts`
- `packages/cli/src/index.ts`
- `packages/github-action/src/index.ts`

Test strategy:

- Fixture with many changed files.
- Fixture with many changed lines in one file.
- Unit tests for cap decisions and skip reasons.
- CLI tests for exit code 2 versus threshold failure.

Launch criteria:

- Reports include exact cap/skip reasons.
- Users can override caps intentionally.
- CI output stays under the terminal summary limit.

### Jest Hardening

User value: Jest users can try Tautest without manual Stryker debugging.

Technical difficulty: Medium to High.

Risk: Jest ESM, ts-jest, Babel, custom environments, and related-test detection vary widely.

Required module changes:

- `packages/core/src/detect/test-runner.ts`
- `packages/core/src/stryker/config-generator.ts`
- `packages/core/src/config/schema.ts`
- `packages/cli/src/index.ts`
- Jest examples and fixtures.

Test strategy:

- Jest CJS fixture.
- Jest ESM fixture.
- Jest TypeScript fixture.
- Fixture with custom Jest config path.
- Snapshot tests for generated Stryker config.

Launch criteria:

- Jest beta docs list tested combinations.
- Unsupported Jest setups fail with targeted remediation.
- No Vitest regression.

### Prompt Quality Improvements

User value: AI agents and humans get a narrower, safer task that kills the listed mutants.

Technical difficulty: Medium.

Risk: longer prompts can become noisy and easier for agents to ignore.

Required module changes:

- `packages/core/src/prompt/builder.ts`
- `packages/core/src/report/markdown.ts`
- `packages/core/src/score/score.ts`
- Eval fixtures under docs or test fixtures.

Test strategy:

- Snapshot tests by prompt style.
- Fixture eval for boundary, boolean, arithmetic, conditional, and no-coverage cases.
- Manual agent eval notes for Claude Code, Cursor, and Codex.

Launch criteria:

- Prompt includes test-only hard rules.
- Prompt references exact mutants and suggested test ideas.
- Eval shows fewer production-code edits and fewer filler tests.

### Stryker Config Conflict Diagnostics

User value: users with existing Stryker config know what Tautest changed and why.

Technical difficulty: Medium.

Risk: unsafe merging can produce surprising mutation scope or runner config.

Required module changes:

- `packages/core/src/config/load.ts`
- `packages/core/src/stryker/config-generator.ts`
- `packages/core/src/types.ts`
- `packages/cli/src/index.ts`

Test strategy:

- Existing Stryker config fixture.
- Conflict tests for `mutate`, reporters, runner, incremental, timeout.
- Snapshot of diagnostics.

Launch criteria:

- Generated config can be explained.
- Conflicts are listed in report/doctor output.
- Users can choose Tautest override, user override, or fail-on-conflict mode.

### GitHub Permission Fallbacks

User value: fork PRs and restricted repos still receive useful output.

Technical difficulty: Low to Medium.

Risk: fallback output can diverge from sticky comment output.

Required module changes:

- `packages/github-action/src/index.ts`
- `packages/github-action/src/pr-comment.ts`
- `packages/github-action/action.yml`
- `docs/GITHUB_ACTION.md`

Test strategy:

- Unit tests for permission error handling.
- Local action smoke with `comment: never`.
- Mock Octokit failure tests.

Launch criteria:

- Comment permission errors produce warnings, not failed jobs.
- Artifact and summary paths remain visible.
- Docs explain fork PR behavior.

### Monorepo Support

User value: users can run Tautest at the repository root and test only affected packages.

Technical difficulty: High.

Risk: incorrect package selection creates false confidence or excessive runtime.

Required module changes:

- New workspace detection module.
- Git diff ownership mapping.
- Per-package config loading.
- CLI package selection flags.
- GitHub Action matrix examples.

Test strategy:

- pnpm workspace fixture.
- Shared package dependency fixture.
- Root-level config plus package-level override fixture.
- CI matrix dry-run tests.

Launch criteria:

- pnpm workspace beta works end to end.
- Package selection is printed before mutation starts.
- Ambiguous ownership causes warning or fail-safe expansion.

### Turborepo Support

User value: users with Turborepo can align Tautest with existing affected-task workflows.

Technical difficulty: Medium.

Risk: Turborepo graph behavior can differ from Tautest package ownership.

Required module changes:

- Workspace detector enhancements.
- Optional adapter for `turbo` dry-run output.
- Docs for matrix generation.

Test strategy:

- Turborepo fixture with two apps and one package.
- Affected package tests for source and shared dependency changes.

Launch criteria:

- Tautest can read enough Turborepo structure to select packages or clearly fallback.
- No hard dependency on Turborepo for non-Turbo monorepos.

### Nx Support

User value: Nx users can use affected project detection rather than custom scripts.

Technical difficulty: High.

Risk: Nx project graph and target naming are flexible; incorrect target selection is easy.

Required module changes:

- Nx detector.
- Optional adapter around `nx print-affected` or current equivalent.
- Per-project runner target mapping.

Test strategy:

- Nx fixture with library/app.
- Changed library affecting app fixture.
- Missing target diagnostics.

Launch criteria:

- Nx beta supports common JS/TS package projects.
- Unsupported Nx layouts produce actionable warnings.

### GitHub PR Line Annotations

User value: reviewers see surviving mutants next to the changed lines.

Technical difficulty: Medium.

Risk: GitHub annotations have permission, line mapping, and noise limits.

Required module changes:

- `packages/github-action/src/index.ts`
- New annotation builder.
- Report schema location metadata.
- Docs for annotation modes.

Test strategy:

- Unit tests for annotation payloads.
- Changed-line mapping fixture.
- Same-repo PR live smoke.
- Fork PR fallback smoke.

Launch criteria:

- Annotation mode is opt-in while beta.
- Sticky comment remains the canonical summary.
- Annotation count is capped.

### Historical Mutation Score Tracking

User value: teams can see whether mutation quality trends up or down over time.

Technical difficulty: Medium.

Risk: trend data can be misleading if scope changes between PRs.

Required module changes:

- Stable report schema versioning.
- Local history artifact format.
- CLI command to compare baseline.
- GitHub Action artifact/cache integration.

Test strategy:

- Report schema migration tests.
- History append/read tests.
- Changed-scope comparison tests.

Launch criteria:

- History is local/artifact-based by default.
- Reports explain scope differences before showing trend deltas.

### Optional LLM Explanations

User value: users get clearer explanations for why a mutant matters.

Technical difficulty: Medium.

Risk: privacy, cost, non-determinism, and hallucinated test guidance.

Required module changes:

- Optional explanation provider interface.
- Config schema opt-in.
- Redaction and prompt preview.
- Report field for generated explanation provenance.

Test strategy:

- Provider contract tests.
- Redaction tests.
- Deterministic mock provider snapshots.

Launch criteria:

- Disabled by default.
- No source is sent to a provider without explicit config.
- Deterministic reports remain available without LLM calls.

### Python Support via mutmut

User value: Python teams can use the Tautest workflow model.

Technical difficulty: High.

Risk: mutmut output, coverage behavior, and project conventions differ from StrykerJS.

Required module changes:

- Runner plugin API.
- mutmut adapter.
- Report normalization.
- Python project detector.

Test strategy:

- Small Python fixture.
- pytest fixture.
- mutmut output parser fixture.

Launch criteria:

- Labeled beta.
- Works on a simple pytest project.
- Clearly documents unsupported Python layouts.

### Java Support via PIT

User value: Java teams can use the Tautest workflow model.

Technical difficulty: High.

Risk: Maven/Gradle/PIT integration and source-line mapping can be complex.

Required module changes:

- Runner plugin API.
- PIT adapter.
- Java project detector.
- XML/HTML report parser normalization.

Test strategy:

- Maven fixture.
- Gradle fixture later.
- PIT XML report parser fixture.

Launch criteria:

- Labeled beta.
- Works on one build system first.
- Does not block JS/TS roadmap.

### Web Dashboard

User value: teams can browse reports, trends, and recurring weak spots.

Technical difficulty: High.

Risk: premature dashboard work distracts from CLI/Action reliability.

Required module changes:

- Stable upload/export format.
- Auth and tenancy if hosted.
- Report ingestion.
- Historical query model.

Test strategy:

- Contract tests for report ingestion.
- Snapshot tests for trend calculations.
- Privacy/security review.

Launch criteria:

- Only after historical tracking has active usage.
- Must not be required for OSS CLI value.

### Team and Cloud Features

User value: teams get policy, trend, and review workflow coordination.

Technical difficulty: Very High.

Risk: cloud can damage OSS trust if positioned as the real product.

Required module changes:

- Account model.
- Project linking.
- CI upload token flow.
- Retention and privacy controls.

Test strategy:

- Security threat model.
- Tenant isolation tests.
- Upload token rotation tests.

Launch criteria:

- Clear evidence of team demand.
- OSS remains fully useful without cloud.
- Transparent data model and delete/export controls.

## What Not To Do Next

- Do not start Python/Java before JS/TS adoption blockers are reduced.
- Do not ship cloud before local history proves demand.
- Do not replace StrykerJS.
- Do not make PR annotations the only report surface.
- Do not hide skipped work behind a passing status.

## Assumptions

- v1 is already launched or release-ready before this roadmap begins.
- The public packages remain `tautest` and `@tautest/core`.
- The GitHub Action remains a separate mirrorable package.
- Vitest remains the primary supported runner through v1.x.
- Jest remains beta until enough fixture coverage exists.
