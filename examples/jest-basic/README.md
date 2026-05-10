# Jest Basic Example

Small CommonJS + Jest project for Tautest's Jest beta path.

## Beta Note

Jest support is beta. This example intentionally avoids ESM, Babel, ts-jest, custom environments, and path aliases.

## Weak Test

`src/shipping.test.js` checks members and non-members below the threshold, but it misses a non-member at the exact `100` free-shipping threshold.

Expected surviving mutant:

```text
src/shipping.js EqualityOperator
Original: cartTotal >= 100
Replacement: cartTotal > 100
```

## Try It

```bash
pnpm install
pnpm --filter tautest-example-jest-basic test
pnpm --dir examples/jest-basic exec tautest run --base HEAD
```

## Expected Tautest Output

```text
Jest beta warning appears in `tautest doctor`.
Top surviving mutants should include the cart total boundary when the file is part of the Git diff.
```

## Fixed Test Example

See `fixed/shipping.test.js`. The key assertion is:

```js
expect(calculateShipping(100, false)).toBe(0);
```
