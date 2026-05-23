# Plan: Tautest Growth Phases

**Generated**: 2026-05-23
**Estimated Complexity**: High
**Current baseline**: `tautest` and `@tautest/core` are at `1.4.0`; the repo already has pnpm workspaces, Release Readiness CI, tag-based npm publish, Vitest examples, one Jest beta example, GitHub Action sticky PR comments, job summaries, artifacts, and cache restore/save handling.

## Overview

This plan turns the listed weak points into a branch-by-branch delivery roadmap. The order is intentional: first make releases safe and repeatable, then remove adoption blockers, then deepen review feedback, then add monorepo orchestration, then add higher-risk optional capabilities such as LLM execution, UI/IDE surfaces, and non-JS runner plugins.

The product boundary should stay clear:

- Tautest is not a mutation engine; StrykerJS remains the JS/TS engine.
- Deterministic CLI, reports, and prompts remain the default.
- LLM execution is opt-in only and never required for core value.
- Python/Java support should wait for runner abstraction work.

## Branch, Merge, and Release Rules

Each phase gets its own branch from fresh `main`:

```powershell
git checkout main
git pull --ff-only
git checkout -b codex/phase-XX-short-name
```

Every phase PR must pass this gate before merge:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm audit --prod
```

For user-facing CLI, Action, report, prompt, or config changes, also run a focused smoke:

```powershell
pnpm --filter @tautest/core test
pnpm --filter tautest test
pnpm --filter @tautest/github-action test
pnpm --filter @tautest/github-action build
```

Release policy:

- Patch release: docs, CI hardening, bug fixes, diagnostics without new user-facing surface.
- Minor release: new CLI flags, report fields, Action inputs, examples, monorepo beta features.
- Major or alpha release: runner plugin architecture, cross-language support, schema-breaking report changes.

Current publish flow derives package versions from a pushed semver tag in `.github/workflows/publish-npm.yml` and uses `secrets.NPM_TOKEN`. Phase 0 should replace or wrap that with an automated version PR flow so package versions, changelog, tags, and npm publish stay in sync.

Do not print, commit, or pass `NPM_TOKEN` through local shell commands. Keep it as a GitHub secret only.

## Phase 0: Release Rail and Project Governance

**Branch**: `codex/phase-00-release-rail`
**Target version**: `1.4.1`
**Goal**: Make phase branches safe to merge and publish without manual version mistakes.

**Demo/Validation**:

- A PR can run Release Readiness.
- A version bump can be prepared automatically.
- Merging a version PR or pushing a tag publishes both public npm packages exactly once.

### Task 0.1: Add Automated Versioning

- **Location**: `package.json`, `.changeset/config.json`, `.github/workflows/publish-npm.yml`, `CHANGELOG.md`
- **Description**: Add Changesets or an equivalent release PR workflow for the two public packages: `tautest` and `@tautest/core`. Keep `@tautest/github-action` private but version-aligned when useful.
- **Dependencies**: None
- **Acceptance Criteria**:
  - A changeset can mark patch/minor/major per PR.
  - Release PR updates package versions and changelog.
  - Publish uses `secrets.NPM_TOKEN` and refuses partial publishes.
- **Validation**:
  - Dry-run version command on a branch.
  - Existing tag-based publish remains safe until the new flow is proven.

### Task 0.2: Tighten Main Merge Gate

- **Location**: `.github/workflows/release-readiness.yml`, `.github/workflows/tautest.yml`
- **Description**: Ensure CI covers lint, typecheck, tests, build, audit, package pack smoke, and local GitHub Action smoke.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Release Readiness is required for source changes.
  - GitHub Action smoke runs with `comment: never` and `cache: false` in CI.
  - The workflow output is clear enough to debug a failed release.
- **Validation**:
  - `workflow_dispatch` pass on the phase branch.

### Task 0.3: Add Community Intake

- **Location**: `.github/ISSUE_TEMPLATE/**`, `.github/pull_request_template.md`, `CONTRIBUTING.md`
- **Description**: Add issue templates for Jest setup, monorepo setup, confusing mutant, runner request, and docs example request.
- **Dependencies**: None
- **Acceptance Criteria**:
  - New users can report actionable setup failures.
  - Maintainers can ask for runner, package manager, Node version, Stryker version, config, and safe report JSON.
- **Validation**:
  - Template files render in GitHub.

## Phase 1: Runtime, Diagnostics, and Node Policy

**Branch**: `codex/phase-01-runtime-diagnostics`
**Target version**: `1.5.0`
**Goal**: Reduce setup pain and CI runtime fear before adding larger features.

**Demo/Validation**:

- `tautest doctor` explains config conflicts and environment gaps.
- Reports include runtime and scope metrics.
- CI users can cap expensive runs without losing honesty in reports.

### Task 1.1: Stryker Config Conflict Diagnostics

- **Location**: `packages/core/src/config/load.ts`, `packages/core/src/stryker/config-generator.ts`, `packages/core/src/types.ts`, `packages/cli/src/commands/doctor.ts`
- **Description**: Detect conflicts between Tautest-generated Stryker options and user-provided Stryker config, especially `mutate`, runner, reporters, incremental, timeout, and concurrency.
- **Dependencies**: Phase 0
- **Acceptance Criteria**:
  - Doctor and run output list conflicts with exact remediation.
  - Users can choose Tautest override, user override, or fail-on-conflict mode.
- **Validation**:
  - Unit fixtures for conflicting Stryker config.
  - CLI tests for conflict warnings and failure mode.

### Task 1.2: Runtime Budgets and Report Metrics

- **Location**: `packages/cli/src/commands/run.ts`, `packages/core/src/report/*`, `packages/core/src/types.ts`, `docs/CLI_REFERENCE.md`, `docs/CONFIG_REFERENCE.md`
- **Description**: Add honest runtime controls and metrics: total runtime, changed source line count, mutate pattern count, selected file count, and partial-run reason.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Existing `--max-files` and `--max-changed-lines` show clearer guidance.
  - New budget fields appear in terminal, markdown, JSON, and job summary where available.
  - Partial runs are clearly labeled and never presented as full proof.
- **Validation**:
  - Unit tests for budget decisions.
  - Snapshot tests for markdown/terminal/JSON output.

### Task 1.3: Node 20/22/24 Policy

- **Location**: `package.json`, `packages/*/package.json`, `.github/workflows/release-readiness.yml`, `packages/github-action/action.yml`, `docs/LIMITATIONS.md`
- **Description**: Validate CLI on Node 20 and 24, consider Node 22 if dependencies allow, and migrate the GitHub Action runtime to Node 24 when `@actions/*` dependencies and GitHub runner behavior are stable. Evaluate Node 18, but do not promise support if StrykerJS or dependencies block it.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Docs state the real supported Node range.
  - CI enforces the supported range.
  - Unsupported Node versions fail with a clear message.
- **Validation**:
  - CI matrix pass.
  - Package smoke under supported Node versions.

### Task 1.4: Cache Observability

- **Location**: `packages/github-action/src/cache.ts`, `packages/github-action/src/summary.ts`, `packages/github-action/test/action.test.ts`, `docs/CACHE_SMOKE.md`
- **Description**: Make cache hit/miss/save status visible in Action summary and JSON-like diagnostics.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Summary shows cache key, matched key, save status, and skip reason.
  - Cache failures warn but do not fail the job.
- **Validation**:
  - Mock restore/save tests.
  - Action smoke with cache disabled and enabled.

## Phase 2: Jest From Beta to Supported

**Branch**: `codex/phase-02-jest-hardening`
**Target version**: `1.6.0`
**Goal**: Make Jest users confident instead of asking them to debug Stryker manually.

**Demo/Validation**:

- Jest CJS and ESM fixtures pass.
- Unsupported Jest setups produce targeted diagnostics.
- Vitest behavior does not regress.

### Task 2.1: Jest Fixture Matrix

- **Location**: `examples/jest-basic/**`, `examples/jest-esm/**`, `examples/jest-typescript/**`, `packages/core/test/fixtures/**`
- **Description**: Add fixtures for common Jest layouts: CJS, ESM, TypeScript, custom config path, and at least one unsupported setup with helpful failure output.
- **Dependencies**: Phase 1 diagnostics
- **Acceptance Criteria**:
  - Each fixture has README usage.
  - Core tests cover generated Stryker config for each fixture.
- **Validation**:
  - `pnpm test` includes fixture checks.
  - Manual `tautest doctor` and `tautest run --dry-run` in fixtures.

### Task 2.2: Jest Config Generation Hardening

- **Location**: `packages/core/src/detect/test-runner.ts`, `packages/core/src/stryker/config-generator.ts`, `packages/core/src/config/schema.ts`
- **Description**: Improve Jest config path detection, ESM/CJS messaging, and explicit user overrides.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `testRunner: "jest"` can use an explicit config path.
  - Missing `@stryker-mutator/jest-runner` is diagnosed clearly.
  - Known unsupported transforms produce an actionable warning.
- **Validation**:
  - Unit tests for detection and config generation.

### Task 2.3: Remove Beta Label When Criteria Pass

- **Location**: `README.md`, `docs/LIMITATIONS.md`, `docs/QUICKSTART.md`, `docs/CLI_REFERENCE.md`
- **Description**: Update docs only after fixture criteria pass. Keep a compatibility table instead of vague beta language.
- **Dependencies**: Tasks 2.1, 2.2
- **Acceptance Criteria**:
  - Docs list tested Jest combinations.
  - Unsupported setups are explicit.
- **Validation**:
  - Docs review and smoke commands in each fixture.

## Phase 3: PR Review Feedback and Inline Annotations

**Branch**: `codex/phase-03-pr-review-feedback`
**Target version**: `1.7.0`
**Goal**: Make PR output useful at review time, not just as an artifact link.

**Demo/Validation**:

- Sticky comments stay concise and actionable.
- Same-repo PRs can opt into line-level annotations.
- Fork PRs degrade to summary/artifact output without failing.

### Task 3.1: Report and Comment 2.0

- **Location**: `packages/core/src/report/*`, `packages/github-action/src/pr-comment.ts`, `packages/github-action/src/summary.ts`
- **Description**: Add richer PR feedback: patch mutation score, threshold, runtime, selected scope, top survivors, missing behavior, and fix prompt link.
- **Dependencies**: Phase 1 metrics
- **Acceptance Criteria**:
  - Comment is short enough for review.
  - Markdown is sanitized for mutant text and file names.
  - Sticky comment remains the canonical PR surface.
- **Validation**:
  - Snapshot tests for markdown and PR comment.
  - Malicious Markdown fixture.

### Task 3.2: Inline Annotation Beta

- **Location**: `packages/github-action/src/annotations.ts`, `packages/github-action/src/index.ts`, `packages/github-action/action.yml`, `packages/github-action/test/**`, `docs/GITHUB_ACTION.md`
- **Description**: Add opt-in annotation mode with capped annotation count and diff-line mapping.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - New input: `annotations: never | changed-lines | survivors`.
  - Same-repo PR annotations point at valid changed lines when possible.
  - Fork/permission failures warn and continue.
- **Validation**:
  - Unit tests for payload building.
  - Same-repo smoke PR.
  - Fork-safe permissions doc.

### Task 3.3: Action Outputs for Composition

- **Location**: `packages/github-action/src/index.ts`, `packages/github-action/action.yml`, `docs/GITHUB_ACTION.md`
- **Description**: Expand outputs for downstream workflow steps: score, verdict, threshold, killed, survived, noCoverage, report path, prompt path, cache status.
- **Dependencies**: Phase 1 metrics
- **Acceptance Criteria**:
  - Workflows can gate or notify using outputs.
  - Existing outputs stay compatible.
- **Validation**:
  - Action tests for output values.

## Phase 4: Workspace Planner Beta

**Branch**: `codex/phase-04-workspace-planner`
**Target version**: `1.8.0`
**Goal**: Move monorepo support from detect-and-warn to explainable planning.

**Demo/Validation**:

- `tautest run --workspace --dry-run --json` prints selected packages and reasons.
- pnpm workspace fixture with three packages is detected.
- No mutation execution is required in this phase.

### Task 4.1: Workspace Detection Model

- **Location**: `packages/core/src/workspace/detect.ts`, `packages/core/src/workspace/packages.ts`, `packages/core/src/types.ts`
- **Description**: Implement structured workspace detection for `pnpm-workspace.yaml` first, then root `package.json` workspaces as secondary support.
- **Dependencies**: Phase 1 diagnostics
- **Acceptance Criteria**:
  - Returns root, package manager, packages, graph confidence, and warnings.
  - Low-confidence detection does not silently orchestrate.
- **Validation**:
  - Unit tests for pnpm workspace parsing and glob expansion.

### Task 4.2: Affected Package Planning

- **Location**: `packages/core/src/workspace/affected.ts`, `packages/core/src/workspace/plan.ts`, `packages/core/src/git/diff.ts`
- **Description**: Map changed files to owning packages and produce selection reasons for changed/config/root/shared cases.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Supports changed package mode.
  - Renames and deleted files are handled conservatively.
  - Root config changes warn or expand selection.
- **Validation**:
  - Fixtures for one package, shared package, root config, rename, deleted source.

### Task 4.3: CLI Dry-Run Surface

- **Location**: `packages/cli/src/index.ts`, `packages/cli/src/commands/run.ts`, `docs/CLI_REFERENCE.md`, `docs/MONOREPO_DESIGN.md`
- **Description**: Add workspace planning flags without running Stryker yet.
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - `--workspace` means workspace mode, while current path-based workspace option is renamed or migrated safely.
  - `--packages`, `--affected`, `--all`, and `--dry-run --json` show a run plan.
  - Backward compatibility is documented.
- **Validation**:
  - CLI tests for flags and JSON shape.

## Phase 5: Workspace Execution Beta

**Branch**: `codex/phase-05-workspace-runner`
**Target version**: `1.9.0`
**Goal**: Actually run Tautest per affected package and aggregate the result.

**Demo/Validation**:

- pnpm workspace fixture runs only changed packages by default.
- Per-package reports do not overwrite each other.
- Workspace summary reports aggregate score and package verdicts.

### Task 5.1: Per-Package Config Resolution

- **Location**: `packages/core/src/config/load.ts`, `packages/core/src/config/schema.ts`, `packages/core/src/workspace/report.ts`
- **Description**: Support root defaults with package overrides and package-local `tautest.config.*`.
- **Dependencies**: Phase 4
- **Acceptance Criteria**:
  - Package-local config wins.
  - Output paths include package identity.
  - Stryker config conflicts are diagnosed per package.
- **Validation**:
  - Config resolution tests with root and package overrides.

### Task 5.2: Sequential Workspace Runner

- **Location**: `packages/cli/src/commands/run.ts`, `packages/core/src/workspace/plan.ts`, `packages/core/src/workspace/report.ts`
- **Description**: Run selected packages sequentially first. Add concurrency later only after output is stable.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Exit code reflects selected package verdicts.
  - No affected production source changes still exits no-op.
  - Package selection is printed before mutation starts.
- **Validation**:
  - pnpm workspace fixture end-to-end.
  - JSON and Markdown aggregate report snapshot tests.

### Task 5.3: GitHub Action Workspace Docs and Matrix

- **Location**: `packages/github-action/action.yml`, `docs/GITHUB_ACTION.md`, `docs/MONOREPO_DESIGN.md`
- **Description**: Document internal workspace mode and advanced matrix mode.
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Users can copy-paste a pnpm workspace workflow.
  - Matrix output shape is documented.
- **Validation**:
  - Local action smoke on workspace fixture.

## Phase 6: Framework Examples and Workspace Adapters

**Branch**: `codex/phase-06-framework-adapters`
**Target version**: `1.10.0`
**Goal**: Broaden real-world confidence without rewriting the architecture.

**Demo/Validation**:

- React, Next.js, Vue, Turborepo, and Nx docs/examples show supported and unsupported paths.
- Turbo/Nx detection can explain fallback when adapters cannot select packages safely.

### Task 6.1: Example Project Expansion

- **Location**: `examples/vitest-react/**`, `examples/next-vitest/**`, `examples/vue-vitest/**`, `docs/QUICKSTART.md`
- **Description**: Add focused examples for common JS/TS frontend stacks.
- **Dependencies**: Phase 2 for runner clarity
- **Acceptance Criteria**:
  - Each example has passing normal tests and at least one Tautest smoke path.
  - Examples stay small enough for CI.
- **Validation**:
  - Example tests included in `pnpm test` or a documented smoke workflow.

### Task 6.2: Turborepo Adapter Beta

- **Location**: `packages/core/src/workspace/turbo.ts`, `packages/core/src/workspace/detect.ts`, `docs/MONOREPO_DESIGN.md`
- **Description**: Detect `turbo.json`, read enough workspace structure to select packages or explain fallback. Avoid a hard Turbo dependency.
- **Dependencies**: Phase 5
- **Acceptance Criteria**:
  - Turbo projects show capability signal and selected package reasons.
  - Fallback is explicit when graph confidence is low.
- **Validation**:
  - Turborepo fixture tests.

### Task 6.3: Nx Adapter Beta

- **Location**: `packages/core/src/workspace/nx.ts`, `packages/core/src/workspace/detect.ts`, `docs/MONOREPO_DESIGN.md`
- **Description**: Detect `nx.json`, optionally use Nx CLI graph data when available, and require explicit target mapping for non-standard layouts.
- **Dependencies**: Phase 5
- **Acceptance Criteria**:
  - Common JS/TS Nx library/app layout works.
  - Unsupported target names produce actionable warnings.
- **Validation**:
  - Nx fixture tests.

## Phase 7: Optional LLM Execution

**Branch**: `codex/phase-07-llm-opt-in`
**Target version**: `1.11.0`
**Goal**: Add optional automation without weakening trust, privacy, or deterministic defaults.

**Demo/Validation**:

- Default behavior still generates prompts only.
- Users can opt into an LLM provider explicitly.
- Redaction and preview happen before any source is sent.

### Task 7.1: Provider Interface and Safety Contract

- **Location**: `packages/core/src/llm/types.ts`, `packages/core/src/config/schema.ts`, `docs/TRUST_AND_SAFETY.md`
- **Description**: Define an opt-in provider interface and safety rules: disabled by default, explicit config, redaction, prompt preview, provenance in report.
- **Dependencies**: Phase 1 metrics and Phase 3 report shape
- **Acceptance Criteria**:
  - No network calls happen unless `llm.enabled` is true.
  - Reports state provider, model, prompt hash, and redaction status.
  - Secrets and `.env` content are never included.
- **Validation**:
  - Mock provider contract tests.
  - Redaction tests.

### Task 7.2: Test Patch Suggestion Mode

- **Location**: `packages/cli/src/commands/prompt.ts`, `packages/core/src/prompt/builder.ts`, `docs/CODEX_WORKFLOW.md`, `docs/CLAUDE_CODE_WORKFLOW.md`
- **Description**: Add a mode that asks a configured provider for a test-only patch suggestion. Applying the patch should remain user-controlled at first.
- **Dependencies**: Task 7.1
- **Acceptance Criteria**:
  - Output is a suggestion artifact, not an automatic commit.
  - Prompt strongly forbids production-code changes unless a real bug is identified.
- **Validation**:
  - Mock LLM snapshot tests.
  - Manual run with a fake provider command.

### Task 7.3: Optional Apply Mode After Trust Is Proven

- **Location**: `packages/cli/src/index.ts`, `packages/cli/src/commands/prompt.ts`, docs
- **Description**: Consider `tautest fix --apply` only after suggestion mode has stable tests and safety behavior.
- **Dependencies**: Task 7.2
- **Acceptance Criteria**:
  - Apply mode is disabled by default.
  - It writes only test files unless explicitly allowed.
  - It always runs verification commands.
- **Validation**:
  - Fixture tests with generated test-only patch.

## Phase 8: Local Viewer and IDE Groundwork

**Branch**: `codex/phase-08-report-viewer`
**Target version**: `1.12.0`
**Goal**: Give users a richer visual way to inspect surviving mutants before investing in full IDE extensions.

**Demo/Validation**:

- `tautest report --html` or equivalent opens a local static viewer.
- Reports show files, lines, mutants, explanations, and verification commands.
- JSON schema stays the source of truth.

### Task 8.1: Stable HTML Report

- **Location**: `packages/core/src/report/html.ts`, `packages/cli/src/commands/report.ts`, `docs/CLI_REFERENCE.md`
- **Description**: Generate a static HTML report from `report.json`.
- **Dependencies**: Phase 3 report shape
- **Acceptance Criteria**:
  - No remote assets required.
  - Works from artifact download.
  - Escapes mutant text and file names safely.
- **Validation**:
  - Snapshot tests and browser smoke.

### Task 8.2: IDE Integration Spec

- **Location**: `docs/IDE_INTEGRATION.md`, `docs/report.schema.json`
- **Description**: Define what a future VS Code extension needs: schema fields, file/line mapping, commands, and limitations.
- **Dependencies**: Task 8.1
- **Acceptance Criteria**:
  - Extension work can start without changing core report shape.
  - Unsupported cases are listed.
- **Validation**:
  - Schema validation tests.

## Phase 9: Runner Plugin Architecture and Multi-Language Alpha

**Branch**: `codex/phase-09-runner-plugin-architecture`
**Target version**: `2.0.0-alpha.1`
**Goal**: Prepare Python/Java support honestly, without bolting them onto Stryker-specific internals.

**Demo/Validation**:

- StrykerJS runs through an internal runner interface.
- Reports consume normalized mutation data.
- Python/Java remain alpha prototypes until fixtures pass.

### Task 9.1: Internal Runner Interface

- **Location**: `packages/core/src/runner/types.ts`, `packages/core/src/runner/registry.ts`, `packages/core/src/stryker/runner.ts`, `packages/core/src/stryker/report-parser.ts`
- **Description**: Introduce a runner abstraction around the existing Stryker implementation.
- **Dependencies**: Phase 5 if multi-package runner selection is needed
- **Acceptance Criteria**:
  - Existing JS/TS behavior is unchanged.
  - Report and prompt layers consume normalized data.
- **Validation**:
  - Current core tests pass unchanged plus contract tests.

### Task 9.2: Normalized Mutation Report Schema

- **Location**: `packages/core/src/report/normalize.ts`, `docs/report.schema.json`, `packages/core/src/types.ts`
- **Description**: Move toward an engine-neutral schema with runner metadata, limitations, status mapping, and engine metadata.
- **Dependencies**: Task 9.1
- **Acceptance Criteria**:
  - Stable fields are documented.
  - Unknown engine fields are preserved under metadata.
  - Schema-breaking changes are alpha-only until v2 final.
- **Validation**:
  - Schema validation tests.

### Task 9.3: Python and Java Prototypes

- **Location**: `packages/core/src/runner/mutmut.ts`, `packages/core/src/runner/pit.ts`, `examples/python-pytest/**`, `examples/java-maven/**`, docs
- **Description**: Prototype Python via mutmut and Java via PIT after the interface is stable.
- **Dependencies**: Tasks 9.1, 9.2
- **Acceptance Criteria**:
  - Each prototype is labeled alpha.
  - Limitations are printed in reports.
  - No JS/TS regression.
- **Validation**:
  - Parser fixture tests first.
  - Simple pytest and Maven fixture smokes.

## Testing Strategy

Use layered testing for every phase:

- Unit tests for detection, planning, config merge, report builders, prompt builders, and Action helpers.
- Fixture tests for Vitest, Jest, pnpm workspace, Turbo/Nx, and future runner outputs.
- Snapshot tests for markdown, JSON, terminal, PR comment, job summary, and prompt output.
- Action smoke tests for comment skipped, comment update, artifact upload, cache restore/save, permission fallback, and annotations.
- Release smoke tests for packed `tautest` and `@tautest/core` packages before npm publish.

Minimum local command set before each PR:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm audit --prod
```

## Rollback Plan

- Every phase is isolated behind its own branch and PR.
- New CLI flags should be additive unless a deprecation is documented.
- New Action inputs should default to current behavior.
- For release failures, do not republish the same version. Fix forward with a patch version.
- For partial npm publish detection, keep the existing refusal behavior from `publish-npm.yml`.
- For beta features, add opt-in flags and clear docs before making them default.

## Risks and Gotchas

- Monorepo package selection can create false confidence if the affected graph is wrong. Default to changed-package mode first, and expand or warn on ambiguous root/shared changes.
- Node 18 support may be blocked by StrykerJS or current dependencies. Treat it as an investigation, not a promise.
- LLM execution creates privacy and cost risk. Keep deterministic prompt generation as the default and require explicit opt-in.
- Inline annotations can become noisy. Cap count, keep sticky comments canonical, and degrade cleanly on permission errors.
- HTML/IDE work can distract from CLI reliability. Do it only after report schema and PR feedback are stable.
- Runner plugin architecture is a v2-level risk. Do not start Python/Java before JS/TS adoption blockers are materially improved.

## Recommended First Batch

Start with Phase 0, then Phase 1. That gives the project a reliable ship lane before bigger features. After that, Phase 2 and Phase 3 can run in separate branches if different people own them, because Jest hardening and PR feedback mostly touch different areas.

