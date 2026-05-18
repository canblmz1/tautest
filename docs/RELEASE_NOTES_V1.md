# Tautest v1.0.0

## What is Tautest?

Tautest is a PR-focused mutation testing workflow layer powered by StrykerJS.

It reads changed source lines from a Git diff, runs StrykerJS mutation testing on that focused scope, turns surviving mutants into readable reports, and generates deterministic test-fix prompts for Claude Code, Cursor, Codex, OpenCode, or humans.

Tautest is not a mutation engine. StrykerJS performs the mutation testing.

## Highlights

- Changed-line mutation scoping from `git diff`.
- Vitest-first workflow.
- Jest beta support.
- Markdown, JSON, and terminal reports.
- Deterministic AI fix prompt generation.
- GitHub Action with sticky PR comments.
- `.tautest` artifact upload.
- Graceful incremental cache handling.
- Example projects for Vitest, Vitest React, and Jest beta.

## Install

Vitest:

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
pnpm exec tautest init --yes --runner vitest --no-install
pnpm exec tautest doctor
pnpm exec tautest run --base origin/main
```

Jest beta:

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/jest-runner
pnpm exec tautest init --yes --runner jest --no-install
```

CLI check:

```bash
npx tautest@latest --help
```

## GitHub Action usage

Use the v1 monorepo action path:

```yaml
name: Tautest

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  tautest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - uses: canblmz1/tautest/packages/github-action@v1
        with:
          base: ${{ github.base_ref }}
          threshold: 60
          comment: changes
          cache: true
```

Important notes:

- `fetch-depth: 0` is required for reliable Git diff behavior.
- `pull-requests: write` is required for sticky PR comments.

## Validation before release

- `tautest@1.0.0` published to npm.
- `@tautest/core@1.0.0` published to npm.
- Main branch Release Readiness workflow passed.
- Source-changing PR smoke passed.
- Mutation run completed in GitHub Actions.
- JSON output parsed.
- Sticky PR comment create/update verified.
- Artifact upload verified.
- Same-repository PR permissions verified.

## Known limitations

- Tautest uses StrykerJS; it is not a mutation engine.
- Jest support is beta.
- Monorepo support is detect-and-warn level in v1.
- Runtime depends on project size and test speed.
- Vitest browser mode and unusual runner setups may need manual StrykerJS config.
- GitHub PR comments depend on repository token permissions.
- GitHub Action currently uses Node 20; Node 24 migration is planned.
- Cache hit was not proven in v1 smoke, but graceful cache handling was validated.

## Next roadmap

- Node 24 action runtime migration.
- Better cache observability.
- Monorepo beta.
- Standalone GitHub Action repository, maybe.
- PR line annotations.
- More Jest fixtures.
