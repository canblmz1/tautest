# Plan: Tautest Hardening And Adoption

**Generated**: 2026-05-28
**Estimated Complexity**: High

## Overview

This plan converts the repository review and competitor analysis into a focused six-month execution roadmap. The main decision is **continue, not rewrite**. The work should harden the existing JS/TS product, reduce maintenance risk, and improve adoption before expanding deeper into multi-language execution.

The plan has **7 phases total**:

- **Phase 0**: governance and scope control
- **Phases 1-6**: six delivery phases mapped to roughly June-November 2026

If Phase 0 is treated as preparation rather than delivery, there are **6 delivery phases**.

## Prerequisites

- Keep `report.json` as the integration source of truth.
- Keep StrykerJS as the JS/TS mutation engine.
- Keep deterministic CLI/report/prompt behavior as the default.
- Do not put Python/Java execution on the critical path until JS/TS reliability is stronger.
- Use the existing release gate before each merge:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm audit --prod
```

## Phase 0: Governance And Scope Control

**Goal**: Prevent scope spread while preserving the existing investment.

**Demo/Validation**:

- A maintainer can tell which work is hardening, adoption, or speculative alpha.
- Roadmap items have clear owners, success criteria, and non-goals.

### Task 0.1: Define Product Boundary

- **Location**: `README.md`, `docs/ROADMAP.md`, `docs/LIMITATIONS.md`
- **Description**: State that near-term Tautest is a JS/TS PR mutation workflow layer, not a hosted service or multi-language mutation platform.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Docs separate supported, beta, and alpha features.
  - Python/Java parser alpha is not described as production support.
- **Validation**: Docs review.

### Task 0.2: Create Decision Records

- **Location**: `docs/adr/`
- **Description**: Add short ADRs for continue-vs-rewrite, StrykerJS dependency, local-first default, and report schema contract.
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - New contributors can understand why the current architecture remains.
- **Validation**: ADR links from `CONTRIBUTING.md` or roadmap.

## Phase 1: Action Refactor And Visibility

**Goal**: Reduce operational risk in the GitHub Action and make quality signals visible.

**Demo/Validation**:

- Release readiness passes on Node 20 and Node 24.
- GitHub Action behavior is unchanged but easier to test.
- Coverage artifacts are available from CI.

### Task 1.1: Split GitHub Action Orchestration

- **Location**: `packages/github-action/src/index.ts`, `packages/github-action/src/*.ts`
- **Description**: Extract orchestration steps into modules such as run planning, report loading, feedback publishing, and output writing.
- **Dependencies**: None
- **Acceptance Criteria**:
  - `index.ts` becomes a thin coordinator.
  - Existing action tests pass without snapshot churn.
- **Validation**: `pnpm --filter @tautest/github-action test`.

### Task 1.2: Add Coverage Visibility

- **Location**: `package.json`, package test configs, `.github/workflows/release-readiness.yml`
- **Description**: Emit package-level coverage reports and upload them as CI artifacts.
- **Dependencies**: None
- **Acceptance Criteria**:
  - CI publishes coverage artifacts.
  - Coverage does not become a hard gate until baseline is known.
- **Validation**: Release Readiness artifact check.

### Task 1.3: Improve Cache And Log Observability

- **Location**: `packages/github-action/src/cache.ts`, `packages/github-action/src/summary.ts`
- **Description**: Surface cache key, hit/miss, matched key, save skip reason, and warning details in the job summary.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Cache failures warn without failing mutation results.
- **Validation**: Action unit tests with mocked cache states.

## Phase 2: Jest Support Hardening

**Goal**: Move Jest from “works for known paths” toward a confidently documented supported path.

**Demo/Validation**:

- Jest fixtures cover CommonJS, ESM, TypeScript, Babel, and explicit config paths.
- Unsupported setups fail with actionable diagnostics.

### Task 2.1: Expand Jest Fixture Matrix

- **Location**: `examples/jest-*`, `packages/core/test/fixtures/`
- **Description**: Add targeted fixtures for common Jest layouts and one deliberately unsupported transform case.
- **Dependencies**: Phase 1 coverage visibility
- **Acceptance Criteria**:
  - Fixtures document install, doctor, dry-run, and run commands.
- **Validation**: `pnpm test` plus fixture smoke commands.

### Task 2.2: Harden Jest Diagnostics

- **Location**: `packages/core/src/detect/test-runner.ts`, `packages/core/src/stryker/config-generator.ts`, `packages/cli/src/lib/doctor.ts`
- **Description**: Improve config path, ESM/CJS, TypeScript config, and missing dependency messages.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Doctor output tells the user what to change next.
- **Validation**: CLI doctor tests.

## Phase 3: Workspace Reliability

**Goal**: Make workspace beta safer for real monorepos before adding concurrency.

**Demo/Validation**:

- A pnpm workspace fixture produces stable affected-package selection.
- Reports explain selected and unselected packages clearly.

### Task 3.1: Improve Affected Package Selection

- **Location**: `packages/core/src/workspace/*`
- **Description**: Add fixtures for root config changes, shared package changes, renames, deletions, Turbo, and Nx signals.
- **Dependencies**: Existing workspace planner and runner
- **Acceptance Criteria**:
  - Ambiguous changes expand or warn conservatively.
- **Validation**: Workspace unit tests.

### Task 3.2: Strengthen Aggregate Reports

- **Location**: `packages/core/src/workspace/report.ts`, `packages/cli/src/commands/run.ts`
- **Description**: Improve aggregate Markdown/JSON with per-package diagnostics, runtime, and report links.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - No package report overwrites another.
  - Exit code maps cleanly to aggregate result.
- **Validation**: CLI workspace JSON snapshot tests.

## Phase 4: Report Contract And IDE Integration

**Goal**: Turn the report contract into the stable integration layer for review tools and IDEs.

**Demo/Validation**:

- IDE or editor PoC can consume `report.json` without private APIs.
- `report.html` remains a static artifact that works offline.

### Task 4.1: Add Schema Contract Tests

- **Location**: `docs/report.schema.json`, `packages/core/test/`
- **Description**: Validate generated reports against the JSON schema.
- **Dependencies**: Existing report builders
- **Acceptance Criteria**:
  - Schema tests fail when report fields drift accidentally.
- **Validation**: Core test suite.

### Task 4.2: Build Minimal IDE PoC

- **Location**: `examples/ide-*` or `docs/IDE_INTEGRATION.md`
- **Description**: Add a minimal extension or script that reads `report.json` and maps surviving mutants to diagnostics.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - PoC can open a file and line from a survivor record.
- **Validation**: Manual demo plus documented steps.

## Phase 5: PR Feedback And Performance Polish

**Goal**: Make CI feedback clearer and less noisy while preserving changed-line cost control.

**Demo/Validation**:

- PR comments, summaries, and annotations agree on the same top findings.
- Large PRs explain budget caps and partial results honestly.

### Task 5.1: Tune Annotation And Summary Output

- **Location**: `packages/github-action/src/annotations.ts`, `packages/github-action/src/summary.ts`, `packages/github-action/src/pr-comment.ts`
- **Description**: Add caps, grouping, permission fallback messaging, and links to HTML/report artifacts.
- **Dependencies**: Phase 4 report contract
- **Acceptance Criteria**:
  - Fork PR permission failures do not fail the workflow.
- **Validation**: Action tests.

### Task 5.2: Add Performance Metrics

- **Location**: `packages/cli/src/commands/run.ts`, `packages/core/src/report/*`
- **Description**: Track runtime by stage where practical: diff, config generation, Stryker run, parsing, report generation.
- **Dependencies**: Existing runtime metrics
- **Acceptance Criteria**:
  - Reports explain slow runs and budget stops.
- **Validation**: Unit tests for metric rendering.

## Phase 6: Adoption And Distribution

**Goal**: Make the project easier to try, reproduce, and contribute to.

**Demo/Validation**:

- A new contributor can run the project in a containerized environment.
- Example projects and package manager paths are documented and smoke-tested.

### Task 6.1: Add Devcontainer Or Docker Path

- **Location**: `.devcontainer/`, `Dockerfile`, `docs/CONTRIBUTING.md`
- **Description**: Provide a standard Node 24 + pnpm environment for contributors.
- **Dependencies**: Existing CI command set
- **Acceptance Criteria**:
  - Container can run install, build, and tests.
- **Validation**: Container build smoke.

### Task 6.2: Add Package Manager Matrix

- **Location**: `.github/workflows/release-readiness.yml`, examples docs
- **Description**: Smoke npm, pnpm, yarn, and bun where supported, without promising full parity prematurely.
- **Dependencies**: Phase 2 and Phase 3 stability
- **Acceptance Criteria**:
  - Docs say which package managers are supported, beta, or untested.
- **Validation**: CI matrix or scheduled smoke.

### Task 6.3: Simplify First 15 Minutes Docs

- **Location**: `README.md`, `docs/QUICKSTART.md`
- **Description**: Create one short path from install to first report, then link deeper references.
- **Dependencies**: All previous user-facing changes
- **Acceptance Criteria**:
  - New users can reach `report.md`, `report.json`, and `fix-prompt.md` quickly.
- **Validation**: Fresh-clone walkthrough.

## Testing Strategy

- Unit tests for runner detection, report schema, workspace selection, diagnostics, prompt generation, and action helpers.
- Fixture tests for Vitest, Jest, pnpm workspaces, Turbo/Nx signals, and report generation.
- CI checks for install, typecheck, lint, test, build, audit, pack smoke, and action smoke.
- Manual smoke for `tautest doctor`, `tautest run --dry-run`, `tautest run`, `tautest prompt`, and `tautest report --html`.

## Potential Risks And Gotchas

- Workspace selection can create false confidence. Default to conservative expansion or explicit warnings.
- Jest support can become an endless compatibility matrix. Define supported paths and document unsupported transforms.
- Coverage can distract from mutation quality. Start as visibility, not a hard gate.
- Python/Java alpha can confuse users. Keep it clearly labeled as parser groundwork until execution wrappers exist.
- Docs are already broad. The next docs work should simplify navigation, not add another disconnected page.

## Rollback Plan

- Keep each phase in its own branch.
- New flags must be additive and default to current behavior.
- If an action refactor regresses CI, revert the phase branch rather than hot-patching multiple modules.
- If release automation fails, fix forward with a new patch and do not republish an existing npm version.
