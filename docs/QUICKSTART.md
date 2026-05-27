# Quickstart

This guide assumes a TypeScript or JavaScript project that already uses Vitest or Jest.

If you want to see the value before wiring Tautest into your own project, run the [copy-paste demo](DEMO.md) first.

## 1. Install

Vitest:

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
```

Jest:

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/jest-runner
```

Use the equivalent `npm install -D`, `yarn add -D`, or `bun add -d` command for your package manager.

## 2. Initialize

```bash
pnpm exec tautest init --yes --runner vitest --no-install
```

For Jest:

```bash
pnpm exec tautest init --yes --runner jest --no-install
```

This creates `tautest.config.ts`, adds `.tautest/` to `.gitignore`, and adds missing Stryker dependencies to `package.json`.

Tautest includes tested Jest examples for CommonJS, native ESM, and Babel TypeScript. If your Jest config is not at the project root, add an explicit config path:

```ts
export default defineConfig({
  testRunner: 'jest',
  stryker: {
    jestConfigFile: 'config/jest.config.cjs'
  }
});
```

For Jest projects, run `pnpm exec tautest doctor` before the first mutation run. Doctor warns about `ts-jest`, missing `babel-jest`, missing `jest-environment-jsdom`, custom environments, and non-root config paths so the setup problem is visible before StrykerJS starts.

## 3. Check Setup

```bash
pnpm exec tautest doctor
```

Fix errors first. Warnings are usually actionable but not always blocking.

## 4. Run On A Diff

```bash
pnpm exec tautest run --base origin/main
```

Tautest writes:

- `.tautest/report.md`
- `.tautest/report.json`
- `.tautest/fix-prompt.md`
- `.tautest/mutation.json`

## 5. Use The Prompt

```bash
pnpm exec tautest prompt --style codex
```

Give the prompt to your agent. It should strengthen tests only, then rerun:

```bash
pnpm test
pnpm exec tautest run --base origin/main
```
