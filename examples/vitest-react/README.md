# Vitest React Example

Small React + Vitest project using server rendering so it runs in Node without browser mode.

## Weak Test

`src/PromoBanner.test.tsx` checks a member with cart total `150`, but misses the exact `100` threshold.

Expected surviving mutant:

```text
src/PromoBanner.tsx EqualityOperator
Original: cartTotal >= 100
Replacement: cartTotal > 100
```

## Try It

```bash
pnpm install
pnpm --filter tautest-example-vitest-react test
pnpm --dir examples/vitest-react exec tautest run --base HEAD
```

## Expected Tautest Output

```text
Verdict: MIXED or WEAK
Top surviving mutants include the cart total boundary.
```

## Fixed Test Example

See `fixed/PromoBanner.test.tsx`. The key case renders a member at `cartTotal={100}` and expects the reward message.
