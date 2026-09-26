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

Stryker reported mutants as Survived although the test runner ran no tests against them, so any score would be meaningless and Tautest refuses to report one. A known cause is Vitest 5 with `@stryker-mutator/vitest-runner` 9.x or 10.0.0 ([stryker-mutator/stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210)).

Fix until the runner supports Vitest 5:

```bash
pnpm add -D vitest@^4
```

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
