# Tautest

[![npm: tautest](https://img.shields.io/npm/v/tautest?label=tautest)](https://www.npmjs.com/package/tautest)
[![npm: @tautest/core](https://img.shields.io/npm/v/%40tautest%2Fcore?label=%40tautest%2Fcore)](https://www.npmjs.com/package/@tautest/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Release Readiness](https://github.com/canblmz1/tautest/actions/workflows/release-readiness.yml/badge.svg)](https://github.com/canblmz1/tautest/actions/workflows/release-readiness.yml)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](package.json)

PR-focused mutation testing workflow layer powered by StrykerJS.

Tautest runs StrykerJS mutation testing on changed source lines, turns surviving mutants into readable reports, and generates test-fix prompts for AI coding agents such as Claude Code, Cursor, and Codex.

## Why Tautest?

Passing tests and high line coverage do not always mean a pull request's changed behavior is well specified. Mutation testing can expose places where tests execute code but fail to reject meaningful behavior changes.

StrykerJS already provides the mutation engine. Tautest gives that engine a PR-shaped workflow: scope the run to changed source lines, explain the surviving mutants, and write a deterministic prompt that asks an AI coding agent or human contributor to strengthen tests without changing production code.

## What Tautest does

- Reads `git diff` against a base ref.
- Maps changed production source lines to StrykerJS mutate ranges.
- Runs StrykerJS through the configured Vitest or Jest runner.
- Writes terminal, Markdown, and JSON reports.
- Generates `.tautest/fix-prompt.md` for test-fix workflows.
- Posts a sticky GitHub PR comment when used through the GitHub Action.
- Uploads `.tautest` reports as GitHub Actions artifacts.
- Handles incremental cache files when cache support is enabled.

## What Tautest does not do

- Tautest does not implement a mutation testing engine.
- Tautest does not replace StrykerJS HTML reports for deep mutation debugging.
- Tautest does not call an LLM or send code to an AI service.
- Tautest does not automatically edit production code.
- Tautest does not fully orchestrate every package in a monorepo in v1.

## Relationship to StrykerJS

Tautest is a workflow layer on top of StrykerJS. StrykerJS performs the mutation testing, provides the mutators, and integrates with test runners. Tautest adds changed-line scoping, PR-oriented reporting, deterministic AI fix prompts, and GitHub PR feedback.

Credit where it belongs: the mutation engine is StrykerJS.

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

Use the equivalent `npm install -D`, `yarn add -D`, or `bun add -d` command for your package manager.

For a quick CLI check without installing into a project:

```bash
npx tautest@latest --help
```

## Quickstart

1. Install `tautest`, `@stryker-mutator/core`, and the Stryker runner for your test framework.
2. Initialize a local `tautest.config.ts`.
3. Run `tautest doctor` and fix blocking setup issues.
4. Run Tautest against a base ref:

```bash
pnpm exec tautest run --base origin/main --threshold 60
```

Tautest will write the report files under `.tautest/`.

See [Quickstart](docs/QUICKSTART.md).

## CLI usage

```bash
tautest init --yes --runner vitest --no-install
tautest doctor
tautest run --base origin/main --threshold 60
tautest prompt --style codex
tautest report
```

Useful flags:

- `--base <ref>`: Git base ref for changed-line detection.
- `--threshold <number>`: minimum mutation score.
- `--report-dir <dir>`: output directory, default `.tautest`.
- `--prompt-style <style>`: `agent`, `human`, `claude-code`, `cursor`, or `codex`.
- `--dry-run`: show mutate scope without running StrykerJS.
- `--json`: print machine-readable run output.

See [CLI reference](docs/CLI_REFERENCE.md).

## GitHub Action usage

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

Notes:

- `fetch-depth: 0` is required so Tautest can diff against the pull request base.
- `pull-requests: write` is required for sticky PR comments.
- After the `v1` tag is created, use `canblmz1/tautest/packages/github-action@v1`.
- Node 20 action runtime migration is tracked as a post-v1 roadmap item, not a v1 blocker.

See [GitHub Action docs](docs/GITHUB_ACTION.md).

## Example output

```text
Tautest: MIXED (75.00%, threshold 60.00%)
Runner: vitest | Runtime: 4.7s | Files: 1
Killed: 3 | Survived: 1 | No coverage: 0 | Timeout: 0

Top surviving mutants:
- src/discount.ts:2 EqualityOperator

Fix prompt: .tautest/fix-prompt.md
Report: .tautest/report.md
JSON: .tautest/report.json
```

The Markdown report explains each surviving mutant with file, line, mutator, original code, replacement code, covering tests, why it matters, and a suggested test idea.

## AI fix prompt workflow

1. Run `tautest run`.
2. Open `.tautest/fix-prompt.md`.
3. Give the prompt to Claude Code, Cursor, Codex, or a human contributor.
4. The prompt asks for test-only changes.
5. Run the normal test suite.
6. Run Tautest again and confirm the surviving mutant is killed.

Agent workflow docs:

- [Claude Code workflow](docs/CLAUDE_CODE_WORKFLOW.md)
- [Cursor workflow](docs/CURSOR_WORKFLOW.md)
- [Codex workflow](docs/CODEX_WORKFLOW.md)

## Example projects

- [Vitest basic](examples/vitest-basic)
- [Vitest React](examples/vitest-react)
- [Jest basic beta](examples/jest-basic)

## Generated files

Tautest writes run outputs to `.tautest/` by default:

- `.tautest/report.md`: human-readable mutation report.
- `.tautest/report.json`: structured report for tools and CI.
- `.tautest/fix-prompt.md`: deterministic test-fix prompt.
- `.tautest/mutation.json`: StrykerJS mutation report.
- `.tautest/stryker-incremental.json`: incremental cache file when available.

These files are generated artifacts and normally should not be committed.

## Requirements

- Node.js 20 or newer.
- Git history for the base ref you want to compare.
- StrykerJS core and a supported runner dependency.
- Vitest for the primary v1 workflow, or Jest for beta support.
- In GitHub Actions, `actions/checkout` with `fetch-depth: 0`.

## Validated before v1

- Local typecheck, lint, test, build, and production audit passed.
- Published npm packages verified:
  - `tautest@1.0.0`
  - `@tautest/core@1.0.0`
- Main branch Release Readiness workflow passed.
- Source-changing PR smoke passed.
- Mutation run completion and JSON parsing verified in CI.
- Sticky PR comment create/update verified.
- Artifact upload verified.
- GitHub Action permissions verified on a same-repository PR.

## Limitations

- Tautest is not a mutation engine. It uses StrykerJS.
- Runtime depends on project size and test speed.
- Monorepo support is detect-and-warn level in v1.
- Jest support is beta.
- AI-author detection is best effort, not proof.
- Vitest browser mode and unusual runner setups may need manual StrykerJS config.
- GitHub PR comments depend on repository token permissions.

See [limitations](docs/LIMITATIONS.md).

## Roadmap

- Harden Jest beta with more fixtures.
- Improve monorepo package selection.
- Add richer config examples for path aliases and ESM/CJS.
- Improve cache hit observability for GitHub Actions.
- Migrate the GitHub Action runtime from Node 20 to Node 24 after validation.
- Explore report formats for review tools and IDEs.

See [roadmap](docs/ROADMAP.md).

## Contributing

Issues and small reproducible examples are the most useful contributions right now. Please include your test runner, package manager, Node version, StrykerJS version, and generated `.tautest/report.json` when reporting bugs.

Before sending a PR, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## License

MIT. See [LICENSE](LICENSE).
