# Package Manager Support

Tautest is validated primarily with pnpm because this repository is a pnpm workspace. The CLI can run under other package managers when the target project provides the matching Stryker runner dependencies.

| Package manager | Status | Notes |
| --- | --- | --- |
| pnpm | Supported | Release readiness, workspace examples, GitHub Action smoke, and local development use pnpm. |
| npm | Supported for single packages | Use `npm install -D` and `npx tautest`; workspace orchestration is not the primary npm path yet. |
| Yarn | Beta | The GitHub Action can install with Yarn when selected, but workspace recipes are not deeply fixture-backed. |
| Bun | Experimental | Bun can install and execute the CLI, but StrykerJS package-manager integration may require fallback behavior. |

Equivalent install commands:

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
npm install -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
yarn add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
bun add -d tautest @stryker-mutator/core @stryker-mutator/vitest-runner
```

For Jest, replace `@stryker-mutator/vitest-runner` with `@stryker-mutator/jest-runner`.

## Smoke Checklist

For a new package-manager recipe, verify:

```bash
tautest init --yes --runner vitest --no-install
tautest doctor
tautest run --dry-run --base origin/main
tautest run --base origin/main
```

In GitHub Actions, set `package-manager` explicitly when auto-detection cannot infer the intended tool from `packageManager` or a lockfile.
