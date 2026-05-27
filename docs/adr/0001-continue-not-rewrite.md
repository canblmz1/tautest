# ADR 0001: Continue The Existing Architecture

## Status

Accepted

## Context

Tautest already has a working JS/TS CLI, a core package, a GitHub Action, report contracts, release automation, and broad documentation. The main risks are scope spread, large orchestration files, and limited adoption feedback rather than a failed architecture.

## Decision

Continue hardening the current architecture instead of rewriting it. Refactor incrementally inside the existing package boundaries:

- `@tautest/core` owns detection, mutation runner adapters, reports, and workspace planning.
- `tautest` owns the CLI surface.
- `@tautest/github-action` owns GitHub workflow orchestration and PR feedback.

## Consequences

- Existing users keep the same install and workflow shape.
- Release risk stays lower because each change can be gated by the current CI checks.
- Large architecture changes need a separate ADR and migration plan.

