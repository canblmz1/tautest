# Framework Recipes

These recipes keep Tautest focused on the same contract across frontend stacks: run the normal test suite first, then run mutation testing against changed production source lines, then use the generated report and fix prompt to strengthen tests.

## React + Vitest

Use the checked-in example when you want a minimal working fixture:

```bash
pnpm --filter tautest-example-vitest-react test
pnpm --dir examples/vitest-react exec tautest run --base origin/main
```

Recommended config:

```ts
import { defineConfig } from '@tautest/core';

export default defineConfig({
  testRunner: 'vitest'
});
```

## Next.js + Vitest

For App Router or Pages Router projects that use Vitest for unit tests, keep Tautest pointed at production modules instead of route build output.

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner vitest
pnpm exec tautest init --yes --runner vitest --no-install
pnpm test
pnpm exec tautest run --base origin/main --dry-run
pnpm exec tautest run --base origin/main
```

Suggested config:

```ts
import { defineConfig } from '@tautest/core';

export default defineConfig({
  testRunner: 'vitest',
  sourceFileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  stryker: {
    vitestConfigFile: 'vitest.config.ts'
  }
});
```

Notes:

- Prefer unit-level Vitest coverage around changed business logic.
- Avoid mutating generated `.next/` output.
- For Next-specific integration behavior, keep Playwright or framework integration tests in the normal test suite.

## Vue + Vitest

Vue projects should use the Vitest runner and keep component tests close to the changed component or composable.

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner vitest
pnpm exec tautest init --yes --runner vitest --no-install
pnpm test
pnpm exec tautest run --base origin/main --dry-run
pnpm exec tautest run --base origin/main
```

Suggested config:

```ts
import { defineConfig } from '@tautest/core';

export default defineConfig({
  testRunner: 'vitest',
  sourceFileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.vue'],
  stryker: {
    vitestConfigFile: 'vitest.config.ts'
  }
});
```

Notes:

- Add `.vue` to `sourceFileExtensions` only when your Stryker/Vitest setup can mutate and test Vue single-file components reliably.
- If mutation fails inside SFC transforms, start by mutating extracted composables or utility modules.

## Turborepo

Tautest detects `turbo.json` as a workspace capability signal. The current beta still selects packages by workspace package ownership, not by Turbo's task graph.

Recommended flow:

```bash
pnpm exec tautest run --workspace --dry-run --json --base origin/main
pnpm exec tautest run --workspace --base origin/main
```

For large repos, use the dry-run JSON to build a GitHub Actions matrix and run Tautest per selected package.

## Nx

Tautest detects `nx.json` as a workspace capability signal. The current beta still selects packages by workspace package ownership, not by Nx's project graph.

Recommended flow:

```bash
pnpm exec tautest run --workspace --dry-run --json --base origin/main
pnpm exec tautest run --workspace --base origin/main
```

For non-standard Nx layouts, use explicit selectors until project graph expansion lands:

```bash
pnpm exec tautest run --workspace --packages packages/api,packages/web --base origin/main
```
