# Quickstart

This is the one supported path: a single-package JavaScript or TypeScript project on Node.js 22 or 24, tested with Vitest 2, 3 or 4, installed with pnpm or npm. If your project differs, check the [exceptions](../README.md#exceptions) first.

To see the idea before touching your own project, run the [copy-paste demo](DEMO.md).

## Before You Start

- The normal test suite passes on the unmodified code, several runs in a row. Tautest cannot tell a missing test from a test that fails on its own.
- You are on a branch that changes source files, and the base branch is available locally, for example as `origin/main`.
- The examples use pnpm. With npm, use `npm install -D` and `npx tautest`.

## 1. Run The Normal Suite

```bash
pnpm test
```

It must pass. If it fails or passes only sometimes, fix that first: a failing test would "kill" mutants by accident and inflate the score.

## 2. Install

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
pnpm exec tautest init --yes --runner vitest --no-install
```

`init` creates `tautest.config.ts` and adds `.tautest/` to `.gitignore`. It would also add missing Stryker packages to `package.json`, but the first command already installed them.

## 3. Check The Setup

```bash
pnpm exec tautest doctor
```

Each check prints `OK`, `WARN` or `ERR`, and the last line is `Result: <n> error(s), <n> warning(s)`. Fix every error before going on. Read each warning, together with its suggestion line: some are harmless for your project, but a warning about the test runner, Vitest 5, git history or the tsconfig predicts a failed or misleading run.

## 4. Run On Your Change

```bash
pnpm exec tautest run --dry-run --base origin/main
pnpm exec tautest run --base origin/main
```

The dry run lists the changed files and the line ranges Stryker will mutate without running it. The real run prints a summary like this:

```text
Tautest: MIXED (75.00%, threshold 60.00%)
Runner: vitest | Runtime: 14.2s | Files: 1 | Changed lines: 6 | Mutate patterns: 2
Killed: 3 | Survived: 1 | No coverage: 0 | Timeout: 0
Threshold passed; 1 surviving mutant still needs review before treating this patch as fully covered. A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change.
Stages: scope 45ms | config 3ms | mutation 13.9s | parse 12ms | report 8ms

Top surviving mutants:
- src/discount.ts:2 EqualityOperator - ...

Fix prompt: .tautest/fix-prompt.md
Report: .tautest/report.md
```

The verdict is `STRONG` at 80% or more, `MIXED` at 60% or more and `WEAK` below that. The exit code is:

- `0` when the score meets the threshold (60 by default, `--threshold` to change it);
- `1` when it does not;
- `2` when there is nothing to mutation-test, such as a change with no source lines or one where Stryker generates no mutants (a type-only change, for example).

Any other exit code is an error, and its message says what to fix. `12` covers Stryker's own failures; [Troubleshooting](TROUBLESHOOTING.md) lists the common ones.

Tautest writes:

- `.tautest/report.md`: the readable report;
- `.tautest/report.json`: the same data, for tools;
- `.tautest/fix-prompt.md`: a test-only task for a person or a coding agent;
- `.tautest/mutation.json`: Stryker's raw report.

## 5. Run The Normal Suite Again

```bash
pnpm test
```

It passes as before: Stryker mutates a sandbox copy in `.stryker-tmp/`, never your files, and removes the sandbox when it finishes.

## 6. Act On Survivors

A surviving mutant is a change to your code that no test noticed. Some survivors are equivalent mutants, which change nothing observable; mutation testing cannot tell those from a missing test, so a person has to decide.

To strengthen the tests, give `.tautest/fix-prompt.md` to your coding agent, or print it in the style of a specific agent:

```bash
pnpm exec tautest prompt --style codex
```

The prompt asks for test changes only. Afterwards, rerun steps 1 and 4.

## Next

- Run it on pull requests in advisory mode: [GitHub Action](GITHUB_ACTION.md).
- Tune the threshold, timeouts or runner config: [Configuration reference](CONFIG_REFERENCE.md).
- Something failed: [Troubleshooting](TROUBLESHOOTING.md).
