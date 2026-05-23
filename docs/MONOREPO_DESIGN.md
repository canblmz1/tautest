# Monorepo Design

## Goal

Add practical monorepo support without pretending every workspace graph can be solved automatically. The first target is pnpm workspaces. Turborepo and Nx should be adapters on top of the same package selection model, not separate product paths.

## Non-Goals

- No v1 backport.
- No full cloud scheduler.
- No guarantee that every package manager graph is perfectly inferred.
- No automatic mutation across every package by default.
- No Python/Java monorepo support in the first monorepo release.

## Core Concepts

### Workspace

A workspace is a repository-level container with one or more packages. It may be defined by:

- `pnpm-workspace.yaml`
- `package.json` workspaces
- `turbo.json`
- `nx.json`
- lockfiles and package manager metadata

### Package

A package is a directory with a `package.json` and optional test runner config. It can have:

- local source files
- local test files
- local `tautest.config.*`
- local `stryker.config.*`
- dependencies on other workspace packages

### Affected Package

An affected package is a package that either owns changed source files or depends on a changed package whose public behavior may affect it.

## Workspace Detection

Detection should return a structured object:

```text
WorkspaceInfo
- rootDir
- packageManager
- kind: pnpm | npm | yarn | bun | turbo | nx | unknown
- packages[]
- graph confidence
- warnings[]
```

Detection order:

1. Explicit CLI flag, when provided.
2. `pnpm-workspace.yaml`.
3. Root `package.json` workspaces.
4. `turbo.json` as a capability signal.
5. `nx.json` as a capability signal.
6. Lockfile and nested package fallback.

Confidence levels:

- `high`: workspace file parsed and package roots exist.
- `medium`: package roots inferred from root workspaces field.
- `low`: nested package discovery only.

Low confidence should not silently run package orchestration. It should ask for explicit package selection or run from the current package root.

## Package Discovery

For pnpm workspaces:

1. Parse `pnpm-workspace.yaml`.
2. Expand package globs.
3. Ignore `node_modules`, build output, examples unless included by workspace patterns.
4. Read each package `package.json`.
5. Detect test runner and Stryker/Tautest config per package.
6. Build package dependency graph from workspace protocol and matching package names.

Package model:

```text
WorkspacePackage
- name
- rootDir
- packageJsonPath
- sourceGlobs
- testGlobs
- testRunner
- packageManager
- tautestConfigPath
- strykerConfigPath
- dependsOnWorkspacePackages[]
- dependedOnByWorkspacePackages[]
- warnings[]
```

## Package Selection

Selection modes:

- `changed`: run packages that own changed source files.
- `affected`: run changed packages plus workspace dependents.
- `explicit`: run packages selected by name or path.
- `all`: run every compatible package.

Implemented planner beta:

- Local CLI: `tautest run --workspace --dry-run --json`.
- Package sources: `pnpm-workspace.yaml` and root `package.json` workspaces.
- Selection: affected packages by path, explicit package selectors, or all packages.
- Execution: intentionally deferred to the workspace runner phase.

CLI flags:

```text
tautest run --workspace
tautest run --workspace --packages @repo/api,@repo/ui
tautest run --workspace --affected
tautest run --workspace --all
tautest run --workspace --dry-run --json
```

Dry-run output must show:

- detected workspace root
- detected package manager
- selected packages
- why each package was selected
- skipped packages and reasons
- warnings for ambiguous ownership

## Path-Based Affected Package Detection

Algorithm:

1. Collect changed files from Git diff.
2. Normalize paths relative to workspace root.
3. For each changed file, find the deepest package root containing it.
4. Classify as production source, test, config, docs, or unknown.
5. Select package if it owns changed production source.
6. If changed file is package config, select that package with reason `config-change`.
7. If changed file is root config that may affect all packages, expand or warn.
8. If `--affected` is enabled, add reverse dependents from the workspace graph. The planner beta currently does path ownership first; dependency expansion is reserved for the execution beta.

Ambiguity handling:

- File outside all packages: warn and skip unless root package exists.
- File inside multiple package roots: choose deepest root and warn.
- Deleted file: use old path from diff metadata.
- Rename across packages: select both old and new package roots.
- Shared config at root: select all compatible packages or require explicit selection depending on config type.

## Per-Package Config

Config resolution order per package:

1. Explicit `--config`.
2. Package-local `tautest.config.*`.
3. Root `tautest.config.*` with package overrides.
4. Generated defaults.

Suggested root config shape:

```ts
export default defineConfig({
  workspace: {
    packages: {
      "@repo/api": {
        runner: "vitest",
        threshold: 70
      },
      "@repo/web": {
        runner: "vitest",
        reportDir: ".tautest/web"
      }
    }
  }
});
```

Rules:

- Package-local config wins over root defaults.
- Root config can define shared thresholds and caps.
- Stryker config conflicts are evaluated per package.
- Output paths include package identity to avoid collisions.

Output layout:

```text
.tautest/
  workspace-report.json
  workspace-report.md
  packages/
    repo-api/
      report.json
      report.md
      fix-prompt.md
    repo-web/
      report.json
      report.md
      fix-prompt.md
```

## Per-Package Execution

Execution strategy:

1. Build package run plan.
2. Run packages sequentially by default.
3. Add optional concurrency after deterministic output is stable.
4. Each package run uses package root as working directory.
5. Aggregate package reports into workspace report.

Exit code strategy:

- `0`: selected packages passed threshold.
- `1`: at least one selected package completed below threshold.
- `2`: no affected production source changes.
- `10+`: config/detection/Stryker/Git errors, same meanings as CLI.

Workspace summary:

- selected package count
- skipped package count
- total killed/survived/no-coverage
- package verdicts
- top surviving mutants across packages

## GitHub Action Matrix

The action should support two patterns.

Pattern A: Tautest internal workspace runner:

```yaml
- uses: canblmz1/tautest/packages/github-action@v1
  with:
    working-directory: .
    package-manager: pnpm
    install: false
    base: ${{ github.event.pull_request.base.sha }}
```

Pattern B: external matrix generated by a dry-run command:

```yaml
jobs:
  plan:
    outputs:
      matrix: ${{ steps.plan.outputs.matrix }}
    steps:
      - run: tautest run --workspace --dry-run --json > plan.json
      - id: plan
        run: echo "matrix=$(jq -c '.matrix' plan.json)" >> "$GITHUB_OUTPUT"

  mutation:
    needs: plan
    strategy:
      matrix: ${{ fromJson(needs.plan.outputs.matrix) }}
    steps:
      - uses: canblmz1/tautest/packages/github-action@v1
        with:
          working-directory: ${{ matrix.packagePath }}
```

Initial launch should document Pattern B as advanced. Pattern A is easier but can be slower for many packages.

## Turborepo Adapter

Turborepo support should read capability signals:

- `turbo.json`
- package manager workspace config
- package scripts for `test`

Optional integration:

- use `turbo` dry-run output when available
- map changed packages to Turborepo tasks
- avoid requiring Turbo for users who only use pnpm workspaces

Launch shape:

- detect Turborepo in v1.5
- explain how to use package matrix
- avoid deep coupling until user demand is clear

## Nx Adapter

Nx support should be separate from basic workspace detection.

Possible approach:

- detect `nx.json`
- read project graph through Nx CLI when installed
- map affected projects to package roots
- require explicit target mapping for non-standard test targets

Risks:

- Nx project roots may not equal package roots.
- Targets can be named anything.
- Affected graph can include apps that do not own changed source.

Launch shape:

- beta in v1.5 or later
- support common JS/TS library/app layouts first
- print selected Nx projects and mapped package roots

## Required Module Changes

New or expanded modules:

- `packages/core/src/workspace/detect.ts`
- `packages/core/src/workspace/packages.ts`
- `packages/core/src/workspace/affected.ts`
- `packages/core/src/workspace/plan.ts`
- `packages/core/src/workspace/report.ts`
- `packages/core/src/config/schema.ts`
- `packages/core/src/config/load.ts`
- `packages/cli/src/index.ts`
- `packages/github-action/src/index.ts`

Existing modules to reuse:

- Git diff parsing.
- Range mapping.
- Project detection.
- Stryker config generation.
- Report builders.
- Prompt builder.

## Test Strategy

Unit tests:

- pnpm workspace parsing.
- package glob expansion.
- path ownership.
- dependency graph construction.
- affected package expansion.
- config resolution order.

Fixture tests:

- one package changed
- shared package changed
- root config changed
- rename across packages
- deleted source file
- package with no compatible runner
- package with local config override

Action tests:

- matrix output shape.
- action working-directory per package.
- permission fallback still works.

Manual smoke:

- pnpm workspace with three packages.
- Turborepo fixture.
- Nx fixture after adapter exists.

## Launch Criteria

v1.2 monorepo beta can launch when:

- pnpm workspace fixture passes end to end.
- dry-run plan is understandable.
- selected packages and reasons are reported.
- package output does not overwrite other package output.
- ambiguous package ownership fails safe or warns.
- docs clearly say Turborepo/Nx are detection-level unless adapter support is enabled.

## Assumptions

- pnpm workspaces are the first real monorepo target.
- Turborepo and Nx support should build on workspace package planning.
- The default behavior should prefer fewer, explainable runs over broad, surprising CI cost.
- Users can still run Tautest from a package root as an escape hatch.
