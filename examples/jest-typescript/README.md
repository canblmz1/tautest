# Jest TypeScript Example

Small TypeScript + Jest project using `babel-jest` and an explicit Jest config path.

## Why This Fixture Exists

Many Jest projects keep config outside the project root or use transforms. This fixture proves Tautest can pass an explicit Jest config file through `tautest.config.ts`:

```ts
stryker: {
  jestConfigFile: 'config/jest.config.cjs'
}
```

## Weak Test

`src/shipping.test.ts` checks members and non-members below the threshold, but misses a non-member at the exact `100` free-shipping threshold.

## Try It

```bash
pnpm install
pnpm --filter tautest-example-jest-typescript test
pnpm --dir examples/jest-typescript exec tautest run --base HEAD
```

