# Tautest

[![npm: tautest](https://img.shields.io/npm/v/tautest?label=tautest)](https://www.npmjs.com/package/tautest)
[![npm: @tautest/core](https://img.shields.io/npm/v/%40tautest%2Fcore?label=%40tautest%2Fcore)](https://www.npmjs.com/package/@tautest/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Release Readiness](https://github.com/canblmz1/tautest/actions/workflows/release-readiness.yml/badge.svg)](https://github.com/canblmz1/tautest/actions/workflows/release-readiness.yml)
[![Node >=22](https://img.shields.io/badge/node-%3E%3D22-339933.svg)](package.json)

Mutation testing for the lines a pull request changes, powered by StrykerJS.

Coverage shows that changed code ran. Tautest checks whether your tests fail when that changed behavior is mutated. It takes the changed lines from `git diff`, runs StrykerJS on those lines only, and reports the surviving mutants in a pull request comment, a job summary, and a test-fix prompt for a person or a coding agent.

![Tautest demo](assets/tautest-demo.gif)

The demo is a test suite that passes while Tautest finds a surviving mutant; a boundary test then brings the score to 100%. To try it, see the [copy-paste demo](docs/DEMO.md) or run `tautest demo`.

## Supported setup

One setup is supported. Anything else is listed under [Exceptions](#exceptions).

| | Supported |
| --- | --- |
| Node.js | 22 or 24 |
| Test runner | Vitest 2, 3 or 4 |
| Mutation engine | `@stryker-mutator/core` and `@stryker-mutator/vitest-runner`, 10.0.0 or 9.6.1 |
| Project | A single package with its own `package.json`, installed into `node_modules` with pnpm or npm |
| Git | The base branch's history is available (`fetch-depth: 0` in GitHub Actions) |
| Tests | The normal test suite passes on the unmodified code, every time |

## Try it on a branch

Run these from the project root, on a branch that changes source code:

```bash
# 1. The normal suite must pass first. Tautest cannot score a suite that fails on its own.
pnpm test

# 2. Install Tautest and Stryker with its Vitest runner.
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
pnpm exec tautest init --yes --runner vitest --no-install

# 3. Check the setup. Fix any error before going on.
pnpm exec tautest doctor

# 4. Mutation-test the lines changed since the base branch.
pnpm exec tautest run --base origin/main

# 5. The normal suite still passes: Stryker mutates a sandbox copy, never your files.
pnpm test
```

With npm, use `npm install -D` and `npx tautest`. `tautest init` writes `tautest.config.ts` and adds `.tautest/` to `.gitignore`.

The report is in `.tautest/report.md`. `tautest run` exits with:

- `0` when the mutation score meets the threshold, 60 by default;
- `1` when it does not;
- `2` when there is nothing to mutation-test, for example a change without source lines;
- `10`, `11`, `12` or `20` on a configuration, detection, Stryker or git error.

The [Quickstart](docs/QUICKSTART.md) shows what each step should print.

## Add it to pull requests

Start in advisory mode, where a low score is reported but does not fail the job:

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
          node-version: 22

      # Reads the pnpm version from "packageManager" in package.json; without that field, add `with: version`.
      - uses: pnpm/action-setup@v4

      - run: pnpm install --frozen-lockfile

      # tautest@2.0.5. Pin the commit of the release you install; the old `v1` tag is the 1.x action.
      - uses: canblmz1/tautest/packages/github-action@df9d2e1bf5c02970149d97ed11e6d6fa4b152208
        with:
          fail-on-threshold: false
```

- **Advisory mode.** `fail-on-threshold: false` keeps a low score from failing the job. A configuration, Stryker or git error still fails it.
- **Permissions.** The sticky comment needs `pull-requests: write`. A pull request from a fork gets a read-only token and no comment; its job summary and the `tautest-report` artifact carry the same report.
- **Trigger.** Use `pull_request`, not `pull_request_target`: the job runs the pull request's code.
- **Build step.** If your tests need one, run it before the Tautest step.
- **Blocking gate.** Make the gate blocking only after the normal suite passes repeatedly and repeated Tautest runs on the same commit give the same mutant statuses. See [Mutant Statuses Change Between Runs](docs/TROUBLESHOOTING.md#mutant-statuses-change-between-runs).

The inputs and outputs are in [GitHub Action](docs/GITHUB_ACTION.md).

## Exceptions

| Your setup | What to do |
| --- | --- |
| Vitest 5 | Not supported yet. Stryker's Vitest runner 10.0.0 and older runs no tests for mutants on Vitest 5 ([stryker-mutator/stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210)), so `tautest doctor` flags it and `tautest run` refuses to score it. Stay on Vitest 4. |
| Jest | Beta. Install `@stryker-mutator/jest-runner` instead and run `tautest init --runner jest`. With a Babel 7 config (`.babelrc`, `babel.config.js`), use Stryker 9.6.1: Stryker 10 instruments with Babel 8, which refuses it. See [Jest](docs/TROUBLESHOOTING.md#jest-esmcjs). |
| A package in a monorepo | Run from the package directory (`working-directory` in the Action). A tsconfig `extends` array pointing outside the package is not supported; `tautest doctor` warns about it. Workspace mode (`--workspace`) is beta. See [Monorepo](docs/TROUBLESHOOTING.md#monorepo). |
| Yarn or Bun | Yarn with `node_modules` is beta, and Yarn Plug'n'Play is untested. Bun is experimental. See [package managers](docs/PACKAGE_MANAGERS.md). |
| pnpm `minimumReleaseAge` | pnpm skips releases younger than that window (one day by default since pnpm 11), so an unpinned `pnpm add -D tautest` right after a release installs the previous one. Pin the version and check it with `pnpm exec tautest --version`; see [Quickstart, step 2](docs/QUICKSTART.md#2-install). If the project sets `minimumReleaseAge` itself, pnpm also refuses a pinned release inside the window: wait, or exempt only `tautest` and `@tautest/core` with `minimumReleaseAgeExclude`. |
| Tests that check bundle size, generated output or timing | Stryker's instrumented copy can fail them before any mutant runs. Exclude them from the mutation run only; see [Instrumentation Breaks a Non-Behavioral Test](docs/TROUBLESHOOTING.md#instrumentation-breaks-a-non-behavioral-test). |
| Tests that need CI environment variables | Set the same variables, such as `TZ`, for the Tautest step. |
| A flaky normal suite | Mutant statuses will change between runs. Keep Tautest advisory until the suite passes repeatedly; see [Mutant Statuses Change Between Runs](docs/TROUBLESHOOTING.md#mutant-statuses-change-between-runs). |

## Evidence

Published Tautest was run on 10 merged pull requests from 6 open-source repositories, installed in each project like any user would: unjs/ohash, unjs/defu, unjs/destr, radashi-org/radashi, pmndrs/zustand and moment/luxon (Jest). In every one:

- the normal suite passed twice;
- Tautest's mutants matched a direct Stryker run with the same config, mutant for mutant;
- a repeated Tautest run gave the same statuses.

The failed and rejected attempts are recorded with their reasons in the [corpus](docs/oss-adoption-corpus.md). No speed claim is made: runtime comparisons with direct Stryker, full-file Stryker and Stryker's incremental mode are still being measured.

## What Tautest does and does not do

Tautest:

- scopes mutation testing to the changed source lines from `git diff`;
- runs StrykerJS as the mutation engine;
- writes Markdown, JSON, HTML and terminal reports;
- posts a sticky pull request comment and a job summary in GitHub Actions;
- writes a deterministic test-fix prompt, `.tautest/fix-prompt.md`, that you can hand to Claude Code, Cursor, Codex, OpenCode or a person.

Tautest does not:

- implement its own mutation engine;
- call an LLM API, unless you opt into `tautest prompt --suggest`;
- tell AI-written code apart;
- prove that tests are complete. A surviving mutant can be an equivalent mutant with no observable behavior change.

StrykerJS does the mutation testing. Tautest is the pull request layer around it. If you already run StrykerJS on every pull request and act on its reports, Tautest may not add much. See [Why Tautest?](docs/WHY_TAUTEST.md) and the [Positioning FAQ](docs/POSITIONING_FAQ.md).

## Commands

```bash
tautest init --yes --runner vitest --no-install
tautest doctor
tautest run --base origin/main
tautest run --dry-run --base origin/main   # show the mutate scope without running Stryker
tautest prompt --style codex
tautest report --html
tautest demo
```

Useful `run` options:

- `--threshold <number>` sets the minimum score;
- `--max-files` and `--max-changed-lines` stop before Stryker starts on a change that is too large;
- `--json` prints machine-readable output.

`watch`, `predict-flaky`, `scaffold`, `time-travel` and `chaos` are experimental and outside the supported setup. Python and Java support is parser-only groundwork. See the [CLI reference](docs/CLI_REFERENCE.md).

## Generated files

`tautest run` writes to `.tautest/`: `report.md`, `report.json` (schema version `1`, see [docs/report.schema.json](docs/report.schema.json)), `fix-prompt.md` and Stryker's raw `mutation.json`. These are generated artifacts; do not commit them. Editor integrations should read `report.json`; see the [IDE integration contract](docs/IDE_INTEGRATION.md).

## More documentation

- [Quickstart](docs/QUICKSTART.md), [GitHub Action](docs/GITHUB_ACTION.md), [Troubleshooting](docs/TROUBLESHOOTING.md)
- [CLI reference](docs/CLI_REFERENCE.md), [Configuration reference](docs/CONFIG_REFERENCE.md), [Package managers](docs/PACKAGE_MANAGERS.md)
- [Agent workflows](docs/AGENT_WORKFLOWS.md), [Framework recipes](docs/FRAMEWORK_RECIPES.md), [Examples](examples)
- [Limitations](docs/LIMITATIONS.md), [Trust and safety](docs/TRUST_AND_SAFETY.md), [Roadmap](docs/ROADMAP.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the local development flow.

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Small reproducible examples make the most useful issue reports. Include your test runner, package manager, Node version, StrykerJS version and `.tautest/report.json` when possible. Report security issues as described in [SECURITY.md](SECURITY.md).

## License

MIT.
