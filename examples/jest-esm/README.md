# Jest ESM Example

Small native ESM + Jest project for Tautest's tested Jest path.

## Weak Test

`src/shipping.test.js` checks members and non-members below the threshold, but misses a non-member at the exact `100` free-shipping threshold.

Expected surviving mutant:

```text
src/shipping.js EqualityOperator
Original: cartTotal >= 100
Replacement: cartTotal > 100
```

## Try It

```bash
pnpm install
pnpm --filter tautest-example-jest-esm test
pnpm --dir examples/jest-esm exec tautest run --base HEAD
```

The test script uses Node's `--experimental-vm-modules` flag, which is still the common Jest path for native ESM projects.
