# Tautest v1.0.0

## What is Tautest?

Tautest is a PR-focused mutation testing workflow layer powered by StrykerJS.

It reads changed source lines from a Git diff, runs StrykerJS mutation testing on that focused scope, turns surviving mutants into readable reports, and generates deterministic test-fix prompts for AI coding agents such as Claude Code, Cursor, and Codex.

Tautest is not a mutation engine. StrykerJS performs the mutation testing.

## Highlights

- Changed-line mutation scoping from `git diff`.
- Vitest-first workflow.
- Jest beta support.
- Markdown, JSON, and terminal reports.
- Deterministic AI fix prompt generation.
- GitHub Action with sticky PR comments.
- `.tautest` artifact upload.
- Incremental cache handling for StrykerJS reports.
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

After the `v1` tag is created, use the monorepo action path:

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

- Local typecheck, lint, test, build, and production audit passed.
- npm package versions verified:
  - `tautest@1.0.0`
  - `@tautest/core@1.0.0`
- Main branch Release Readiness workflow passed.
- Source-changing PR smoke passed.
- Mutation run completed and JSON output parsed in GitHub Actions.
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
- Cache handling is graceful, but a real cache hit was not proven in the v1 source PR smoke.

## Next roadmap

- Harden Jest beta with more fixtures.
- Improve monorepo package selection.
- Add richer ESM/CJS and path alias recipes.
- Improve GitHub Action cache observability.
- Migrate the GitHub Action runtime from Node 20 to Node 24 after validation.
- Explore richer review-tool and IDE integrations.
