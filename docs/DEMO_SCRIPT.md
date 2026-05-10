# Demo Script

90-second video flow.

## 0-10s: Setup

Open a small Vitest project. Show tests passing and normal coverage-looking confidence.

Narration:

> The tests pass, and coverage can look fine. But coverage only says code ran, not that behavior was meaningfully asserted.

## 10-25s: Introduce Weak Boundary

Show `age >= 65` in production code and a test that checks age `70` but not `65`.

Narration:

> The boundary is the real business rule. The test misses it.

## 25-40s: Run Tautest

```bash
tautest run --base HEAD --prompt-style codex
```

Show terminal summary:

```text
Tautest: MIXED
Top surviving mutants:
- src/discount.ts:2 EqualityOperator
```

## 40-55s: Explain Report

Open `.tautest/report.md`.

Highlight:

- original code
- replacement code
- covering tests
- why this matters
- suggested test idea

## 55-75s: AI Fix Prompt

Open `.tautest/fix-prompt.md`.

Narration:

> The prompt tells the agent to edit tests only, avoid filler tests, and prove that the new test passes on original code but fails on the mutant.

Paste prompt into Claude Code, Cursor, or Codex.

## 75-90s: Verify

Show added boundary test:

```ts
expect(calculateDiscount(65, 100)).toBe(20);
```

Run:

```bash
pnpm test
tautest run --base HEAD
```

Narration:

> The normal tests pass, and the mutant is killed. The implementation did not change; the tests got sharper.
