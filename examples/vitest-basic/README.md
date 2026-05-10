# Vitest Basic Example

Small TypeScript + Vitest project with intentionally weak boundary coverage.

## Weak Test

`src/discount.test.ts` checks age `70`, but not the exact senior boundary `65`.

Expected surviving mutant:

```text
src/discount.ts:2 EqualityOperator
Original: age >= 65
Replacement: age > 65
```

## Try It

```bash
pnpm install
pnpm --filter tautest-example-vitest-basic test
pnpm --dir examples/vitest-basic exec tautest run --base HEAD
```

## Expected Tautest Output

```text
Tautest: MIXED (75.00%, threshold 60.00%)
Killed: 3 | Survived: 1 | No coverage: 0 | Timeout: 0
Top surviving mutants:
- src/discount.ts:2 EqualityOperator
```

## Fixed Test Example

See `fixed/discount.test.ts`. The important assertion is:

```ts
expect(calculateDiscount(65, 100)).toBe(20);
```

That test passes on the original code and fails when `age >= 65` is mutated to `age > 65`.
