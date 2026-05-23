# Contributing

Thanks for helping make Tautest better.

Tautest is intentionally narrow: changed source lines, StrykerJS mutation testing, readable reports, and deterministic test-fix prompts. Please keep changes inside that product boundary.

## Local Setup

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Useful Package Commands

```bash
pnpm --filter @tautest/core test
pnpm --filter tautest test
pnpm --filter @tautest/github-action test
pnpm --filter @tautest/github-action build
```

## Pull Request Guidelines

- Keep changes focused and testable.
- Do not replace StrykerJS or add a separate mutation engine.
- Do not add LLM API calls to the deterministic core workflow.
- Preserve existing CLI behavior unless the PR explicitly documents the change.
- Add or update tests for changed behavior.
- Update docs when user-facing commands, reports, prompts, or GitHub Action behavior changes.
- Add a changeset with `pnpm changeset` when the PR should publish `tautest` or `@tautest/core`.

## Good Issues To File

Small reproducible examples are best. Include:

- test runner and version
- package manager
- Node.js version
- StrykerJS version
- `tautest.config.*` if present
- generated `.tautest/report.json` when safe to share
- expected vs actual behavior

## Release Notes

Release-facing package changes should use Changesets:

```bash
pnpm changeset
```

The Release workflow creates a version PR on `main` when changesets are present. Merging that version PR updates package versions and changelogs, then the same workflow publishes with `NPM_TOKEN`.

Manual tag publishing is kept as a guarded fallback. Tags must match the already committed versions in `packages/core/package.json` and `packages/cli/package.json`; do not tag a version before the version PR is merged.
