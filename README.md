# Tautest

Tautest is a PR-focused workflow layer on top of StrykerJS that mutation-tests changed source lines, turns surviving mutants into readable reports, and generates test-fix prompts for AI coding agents.

Coverage can look healthy while important behavior is still weakly specified. Tautest helps you find those gaps on the code you just changed.

> Demo video/GIF slot: show coverage passing, Tautest finding a surviving boundary mutant, an AI agent adding the missing test, and the next Tautest run killing the mutant.

## What Tautest Does

- Reads `git diff` for a base ref.
- Maps changed production source lines to Stryker `mutate` ranges.
- Runs StrykerJS as the mutation engine.
- Produces:
  - `.tautest/report.md`
  - `.tautest/report.json`
  - `.tautest/fix-prompt.md`
  - `.tautest/mutation.json`
- Generates prompts for Claude Code, Cursor, Codex, or humans to strengthen tests without changing production code.
- Optionally posts a sticky GitHub PR comment through the GitHub Action.

## Relationship To Stryker

Tautest does not replace Stryker and does not implement a mutation testing engine. StrykerJS does the mutation testing. Tautest adds a workflow layer around Stryker for changed-line scoping, readable PR reports, deterministic AI fix prompts, and GitHub PR feedback.

Credit where it belongs: the mutation engine, mutators, and test-runner integrations come from StrykerJS.

## Quickstart

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
pnpm exec tautest init --yes --runner vitest --no-install
pnpm exec tautest doctor
pnpm exec tautest run --base origin/main
```

For Jest beta:

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/jest-runner
pnpm exec tautest init --yes --runner jest --no-install
```

## CLI Usage

```bash
tautest init
tautest doctor
tautest run --base origin/main --threshold 60
tautest prompt --style codex
tautest report
```

Useful flags:

- `--base`: Git base ref for changed-line detection.
- `--threshold`: mutation score threshold.
- `--report-dir`: output directory, default `.tautest`.
- `--prompt-style`: `agent`, `human`, `claude-code`, `cursor`, or `codex`.
- `--dry-run`: show mutate scope without running Stryker.

See [CLI reference](docs/CLI_REFERENCE.md).

## GitHub Action Usage

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

      - uses: tautest-dev/tautest-action@v1
        with:
          install: true
          comment: changes
          threshold: 60
```

See [GitHub Action docs](docs/GITHUB_ACTION.md).

## Example Output

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

The markdown report explains each surviving mutant with file, line, mutator, original code, replacement code, covering tests, why it matters, and a suggested test idea.

## Fix Prompt Workflow

1. Run `tautest run`.
2. Open `.tautest/fix-prompt.md`.
3. Give it to Claude Code, Cursor, Codex, or a human.
4. The prompt tells the agent to edit tests only.
5. Run the normal test suite.
6. Run Tautest again and confirm the mutant is killed.

Agent workflow docs:

- [Claude Code workflow](docs/CLAUDE_CODE_WORKFLOW.md)
- [Cursor workflow](docs/CURSOR_WORKFLOW.md)
- [Codex workflow](docs/CODEX_WORKFLOW.md)

## Examples

- [Vitest basic](examples/vitest-basic)
- [Vitest React](examples/vitest-react)
- [Jest basic beta](examples/jest-basic)

## Limitations

- Tautest is not a mutation engine. It uses StrykerJS.
- Runtime depends on your project and test runner speed.
- Monorepo support is detect-and-warn level in v1.
- Jest support is beta.
- AI-author detection is best effort, not proof.
- Vitest browser mode and unusual runner setups may need manual Stryker config.

See [limitations](docs/LIMITATIONS.md).

## Roadmap

- Harden Jest beta.
- Improve monorepo package selection.
- Add richer config examples for path aliases and ESM/CJS.
- Publish standalone `tautest-dev/tautest-action`.
- Explore report formats for review tools.

See [roadmap](docs/ROADMAP.md).

## Contributing

Issues and small reproducible examples are the most useful contributions right now. Please include your test runner, package manager, Node version, Stryker version, and the generated `.tautest/report.json` when reporting bugs.
