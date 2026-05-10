# Phase 6 Documentation And Examples Report

## Goal

Make Tautest understandable and tryable for new users through README, docs, examples, Jest beta documentation, troubleshooting, and limitations.

## What Was Added

- Root `README.md`
- Docs:
  - `docs/QUICKSTART.md`
  - `docs/HOW_IT_WORKS.md`
  - `docs/GITHUB_ACTION.md`
  - `docs/CLI_REFERENCE.md`
  - `docs/CONFIG_REFERENCE.md`
  - `docs/CLAUDE_CODE_WORKFLOW.md`
  - `docs/CURSOR_WORKFLOW.md`
  - `docs/CODEX_WORKFLOW.md`
  - `docs/TROUBLESHOOTING.md`
  - `docs/LIMITATIONS.md`
  - `docs/ROADMAP.md`
  - `docs/DEMO_SCRIPT.md`
- Examples:
  - `examples/vitest-basic`
  - `examples/vitest-react`
  - `examples/jest-basic`

## Jest Beta

- Core config generator already supports `@stryker-mutator/jest-runner` and `jest.config` path wiring.
- `tautest doctor` now emits a Jest beta warning with edge cases:
  - ESM
  - ts-jest
  - Babel
  - custom environments
  - path aliases
- `examples/jest-basic` uses a minimal CommonJS Jest setup to keep the beta path honest and easy to inspect.

## Example Strategy

Each example includes:

- weak tests
- README
- expected Tautest output
- fixed test example under `fixed/`

The fixed tests are outside the normal test include patterns so the examples stay intentionally weak.

## Verification

Run:

```bash
pnpm install
pnpm --filter tautest-example-vitest-basic test
pnpm --filter tautest-example-vitest-react test
pnpm --filter tautest-example-jest-basic test
pnpm test
pnpm typecheck
pnpm build
```

Observed:

- `examples/vitest-basic`: 3 Vitest tests passed.
- `examples/vitest-react`: 2 Vitest tests passed.
- `examples/jest-basic`: 2 Jest tests passed.
- `pnpm test`: passed across workspace packages.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `tautest doctor` in `examples/jest-basic` reports `WARN Jest beta`.

Jest beta is validated through:

- working Jest example tests
- Stryker config-generator unit coverage for `@stryker-mutator/jest-runner`
- doctor warning coverage

Full Jest mutation execution remains documented as beta because ESM, ts-jest, Babel, custom environments, and aliases can require project-specific Stryker/Jest configuration.

## Assumptions

- Published package names are `tautest` and `@tautest/core`; the GitHub Action ships from `canblmz1/tautest/packages/github-action@v1`.
- V1 remains Vitest-first.
- Jest beta should be documented honestly instead of presented as fully hardened.
- Examples should teach the weak-test-to-prompt-to-fixed-test workflow rather than hide the weak test.
