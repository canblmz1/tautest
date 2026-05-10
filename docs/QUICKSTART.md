# Quickstart

This guide assumes a TypeScript or JavaScript project that already uses Vitest or Jest.

## 1. Install

Vitest:

```bash
pnpm add -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
```

Jest beta:

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
