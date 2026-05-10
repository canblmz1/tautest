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

## Slow Test Suite

Mutation testing runs tests many times. If it is slow:

- keep Tautest scoped to changed lines
- reduce changed files per PR
- use `--max-files`
- tune Stryker timeout/concurrency
- avoid running full mutation testing on every push

## No Source Changes

Symptom: exit code `2`.

Tautest found no changed production source files in the selected diff. This is expected for docs-only or test-only changes.

## Monorepo

V1 detects monorepo signals and warns. Run Tautest from the package root and pass `working-directory` in GitHub Actions.

## Path Aliases

If tests pass normally but fail under Stryker, make sure your runner config and `tsconfig.json` are discoverable from the package root.

## ESM/CJS

Vitest ESM setups are usually smoother. Jest ESM setups are beta and may require explicit Jest/Stryker configuration.

## Permission Denied GitHub Comment

Fork PRs may not have `pull-requests: write`. The action warns and continues. Artifacts are still uploaded.

## Stryker Timeout

Increase `stryker.timeoutMS` or `stryker.dryRunTimeoutMinutes` in `tautest.config.ts`. Also check for hanging tests or tests that depend on wall-clock timing.

## Uninstall / Cleanup

Tautest does not run destructive cleanup commands. To uninstall, remove the package dependencies, delete `tautest.config.ts` if you no longer need it, and remove `.tautest/` plus the `.tautest/` entry in `.gitignore` if desired.
