# Troubleshooting

## Shallow Clone

Symptom: Git cannot diff against the base ref.

Fix in GitHub Actions:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

## Missing Stryker Dependency

Symptom: doctor warns that Stryker core or runner dependency is missing.

Fix:

```bash
tautest init
pnpm install
```

## Surviving Mutants Executed Zero Tests

Symptom: exit code `12` with `STRYKER_ZERO_TESTS_EXECUTED` and a message like `11 of 11 surviving mutants executed 0 tests`.

Stryker reported mutants as Survived although the test runner ran no tests against them, so any score would be meaningless and Tautest refuses to report one. A known cause is Vitest 5 with `@stryker-mutator/vitest-runner` 9.x or 10.0.0 ([stryker-mutator/stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210); root cause and a proposed fix in [stryker-js#6214](https://github.com/stryker-mutator/stryker-js/pull/6214), open and unreviewed as of this writing).

Fix until the runner supports Vitest 5:

```bash
pnpm add -D vitest@^4
```

## Instrumentation Breaks a Non-Behavioral Test

Symptom: exit code `12` with `STRYKER_DRY_RUN_FAILED` and a message that Stryker's initial test run failed.

First rule out a genuinely broken test: run your normal test command against the unmutated code. If the failing test fails there too, it is a real bug in the PR, not this issue; fix the test or the code.

If the normal run passes and only Stryker's initial run fails the same test, the cause is usually that Stryker instruments source files before running tests, which can change bundle size, generated snapshots, or timing enough to fail a test that asserts on one of those instead of on behavior. Scroll up in the CLI output for the specific failing test Stryker reported.

Fix: exclude that test from the mutation run only, keeping it in your normal test suite. Add an opt-in Vitest config for Stryker and point Tautest at it.

If you already have a `vitest.config.ts`, extend it:

```ts
// vitest.stryker.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      exclude: ['**/node_modules/**', 'test/bundle-size.test.ts']
    }
  })
);
```

If you do not have a `vitest.config.ts` (Tautest ran against Vitest's defaults), write a standalone one instead — do not import a config file that does not exist:

```ts
// vitest.stryker.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', 'test/bundle-size.test.ts']
  }
});
```

Either way, point Tautest at the Stryker-only config:

```ts
// tautest.config.ts
import { defineConfig } from '@tautest/core';

export default defineConfig({
  stryker: {
    vitestConfigFile: 'vitest.stryker.config.ts'
  }
});
```

`pnpm test` and CI still run the excluded test normally; only the Stryker mutation run skips it. The same pattern applies to Jest through `stryker.jestConfigFile`.

## Mutant Statuses Change Between Runs

Symptom: the same commit gives different killed/survived counts or a different score from one Tautest run to the next.

Tautest scores whatever Stryker's test runs report. Direct Stryker with the same options changes the same way, so look at the test suite and the machine first:

- **Flaky tests produce false kills.** A test that sometimes fails on unmodified code will sometimes "kill" a mutant, too. This hits hardest for mutants with no covering test (for example module-level code), because Stryker runs the whole suite against them. CPU load makes timing-sensitive tests fail more often, so a busier machine can raise the score.
- **A mutant that makes code hang can be `Killed` or `Timeout`.** Either your test framework's own timeout or Stryker's mutant timeout fires first. Both count as detected, so the score does not change.

To check, run your normal test command several times on the unmodified commit (for example ten `vitest run`s in a row). Then compare the raw `.tautest/mutation.json` of two Tautest runs mutant by mutant: the `killedBy` field names the test that killed each mutant. If a changing status traces to a test that also fails without mutation, fix or quarantine that test.

Until the normal suite passes repeatedly and repeated Tautest runs on the same commit give the same statuses, keep Tautest advisory. In the GitHub Action, set `fail-on-threshold: false` ([Advisory First Week](GITHUB_ACTION.md#advisory-first-week)). If you run the CLI yourself, do not fail the job on exit code `1` (threshold not met). A single clean run, or two runs with the same score, is not enough. See the [cli-testing-library#50 experiment](evidence/cli-testing-library-50/README.md) for a worked example.

## Slow Test Suite

Mutation testing runs tests many times. If it is slow:

- keep Tautest scoped to changed lines
- reduce changed files per PR
- use `--max-files`
- tune Stryker timeout/concurrency
- avoid running full mutation testing on every push

## No Source Changes

Symptom: exit code `2`.

Tautest found no changed production source files in the selected diff, or Stryker generated no mutants for the changed lines. This is expected for docs-only or test-only changes, for changes limited to comments, imports, or declarations, and for files outside the `mutate` list of your Stryker config.

## Monorepo

Run Tautest from the package root and pass `working-directory` in GitHub Actions.

A package whose `tsconfig.json` extends a file outside the package, such as `"extends": "../../tsconfig.base.json"`, works. Stryker copies the package to `.stryker-tmp/sandbox-*` and rewrites relative `extends`, `references`, `include`, `exclude` and `files` paths that leave the package, so they still reach the original files. Tautest 2.0.0 through 2.0.3 ran Stryker in a deeper temp directory, which sent those rewritten paths to the wrong place. Those versions fail on most such packages with `No tests were executed` or `TSCONFIG_ERROR`; upgrade.

Stryker does not rewrite one layout: an `extends` **array** (`"extends": ["../../tsconfig.base.json"]`, TypeScript 5+) whose entries point outside the package. Stryker's initial run then finds no tests (`No tests were executed`), with or without Tautest. The same happens when an in-package `extends` names a file without its `.json` extension and that file extends outside the package: Stryker cannot find it to rewrite it. `tautest doctor` warns about both layouts. Use a single `extends` string with the full file name instead, for example by moving the shared options into one base config. Alternatively, run from the workspace root with a Vitest config limited to the package.

## Path Aliases

If tests pass normally but fail under Stryker, make sure your runner config and `tsconfig.json` are discoverable from the package root.

## Jest ESM/CJS

Native Jest ESM usually needs Node's `--experimental-vm-modules` flag in the test command. See `examples/jest-esm`.

Tautest turns off Stryker's `jest.enableFindRelatedTests`, so Stryker's initial run executes your whole Jest suite rather than only the tests Jest can trace to the changed file; per-test coverage still limits which tests each mutant runs. Jest's related-test lookup can miss tests that reach a file indirectly. On moment/luxon it found none, and Stryker stopped with `No tests were executed`.

Stryker 10 parses your source with Babel 8, which refuses a project Babel 7 config (`.babelrc`, `babel.config.js`) with `Requires Babel "^7.0.0-0", but was loaded with "8.0.6"`. Use `@stryker-mutator/core` and `@stryker-mutator/jest-runner` 9.6.1 for such projects until they move to Babel 8.

If Jest config lives outside the project root, set `stryker.jestConfigFile`:

```ts
export default defineConfig({
  testRunner: 'jest',
  stryker: {
    jestConfigFile: 'config/jest.config.cjs'
  }
});
```

For TypeScript transforms, start from `examples/jest-typescript`. `ts-jest`, custom Babel stacks, custom environments, and path aliases can still require explicit Stryker/Jest configuration.

`tautest doctor` now calls out the common risky Jest paths separately:

- `ts-jest` is detected as beta and not fixture-backed yet.
- `babel-jest` is checked for a matching installed dependency.
- `testEnvironment: "jsdom"` is checked for `jest-environment-jsdom`.
- custom `testEnvironment` values are reported as project-specific wiring risks.

## Permission Denied GitHub Comment

Fork PRs may not have `pull-requests: write`. The action warns and continues. Artifacts are still uploaded.

## Stryker Timeout

Increase `stryker.timeoutMS` or `stryker.dryRunTimeoutMinutes` in `tautest.config.ts`. Also check for hanging tests or tests that depend on wall-clock timing.

## Uninstall / Cleanup

Tautest itself deletes no files. Stryker creates its sandbox in `.stryker-tmp/sandbox-*`. Tautest sets `cleanTempDir: "always"`, so Stryker removes that sandbox after every run, failed or not, and then removes `.stryker-tmp/` if it is empty. Concurrent runs each remove only their own sandbox.

For an in-place run (`stryker.userConfig.inPlace`), Stryker's default applies instead: after a failed run it keeps the backup of your original files.

A run that is killed outright (for example with `kill -9`) can leave `.stryker-tmp/` behind. Delete it, and consider adding `.stryker-tmp/` to `.gitignore`. Tautest 2.0.2 and 2.0.3 used `.stryker-tmp/tautest/run-*`; delete any such leftover directory after upgrading.

To uninstall, remove the package dependencies, delete `tautest.config.ts` if you no longer need it, and remove `.tautest/` plus the `.tautest/` entry in `.gitignore` if desired.
