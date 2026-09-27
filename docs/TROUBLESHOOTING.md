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

V1 detects monorepo signals and warns. Run Tautest from the package root and pass `working-directory` in GitHub Actions.

## Path Aliases

If tests pass normally but fail under Stryker, make sure your runner config and `tsconfig.json` are discoverable from the package root.

## Jest ESM/CJS

Native Jest ESM usually needs Node's `--experimental-vm-modules` flag in the test command. See `examples/jest-esm`.

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

Tautest does not run destructive cleanup commands. To uninstall, remove the package dependencies, delete `tautest.config.ts` if you no longer need it, and remove `.tautest/` plus the `.tautest/` entry in `.gitignore` if desired.
