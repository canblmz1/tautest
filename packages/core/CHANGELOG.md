# @tautest/core

## 1.6.0

### Minor Changes

- 21355e6: Expand test coverage with Jest fixture variants, workspace reliability suites, report.json schema contract tests; add coverage config to all vitest configs; strengthen Docker build with typecheck+test+build validation; add package-manager smoke matrix (npm, yarn) to release-readiness CI.

## 1.5.1

### Patch Changes

- 3863a87: Add release-readiness coverage artifacts and split GitHub Action output helpers for easier maintenance.
- 4dab235: Add Docker/devcontainer setup and package-manager adoption documentation.
- 73cb688: Document hardening-phase product boundaries and architecture decisions.
- 8947740: Improve Jest doctor diagnostics for transform stacks and test environments.
- 21d8ef2: Add stage-level performance metrics to reports and GitHub Action summaries.
- 70df5b2: Add report schema compatibility tests and a minimal IDE report consumer example.
- 5ea40c9: Expand workspace affected selection to direct workspace dependents and include package reasons in aggregate reports.

## 1.5.0

### Minor Changes

- 065ec71: Add framework recipes and workspace capability signals for Turborepo and Nx projects.
- c27c74e: Harden Jest support with explicit runner config paths, CommonJS/ESM/TypeScript fixtures, and updated compatibility diagnostics.
- 24c542e: Add an explicit opt-in LLM suggestion flow for generated fix prompts. `tautest prompt --suggest` can send a redacted prompt to a configured external command, write `.tautest/llm-suggestion.md`, and record prompt provenance without applying changes.
- 6045284: Add GitHub Action survivor annotations and expanded workflow outputs for richer PR feedback.
- 43e1c63: Add a static HTML report viewer generated from `report.json`. `tautest report --html` writes `report.html` with survivor cards, summary metrics, embedded report data, and IDE-friendly data attributes.
- 6e2dbfa: Add internal runner plugin groundwork with normalized mutation report helpers, a StrykerJS adapter, and parser-only alpha helpers for Python mutmut-style results and Java PIT XML.
- 62484e4: Add runtime scope metrics and Stryker config diagnostics to CLI, JSON, Markdown, terminal, and GitHub Action summaries.
- 8eee492: Add a workspace planner beta for pnpm and package.json workspaces with dry-run package selection output.
- 73ac35d: Add sequential workspace execution with aggregate reports for selected workspace packages.

### Patch Changes

- 54c1a64: Add the Changesets release rail, guarded npm publishing workflow, and maintainer intake templates.
