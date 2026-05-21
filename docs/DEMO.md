# Tautest Demo

This demo shows the core Tautest loop:

```text
regular tests pass -> changed line survives mutation -> add missing boundary test -> mutant is killed
```

It uses the repository's small Vitest example project. The example is intentionally missing one boundary test so Tautest has something useful to find.

## What the demo proves

Coverage can tell you that code ran. Tautest checks whether tests fail when changed behavior is mutated.

In this example, the production code contains a senior discount boundary:

```ts
if (age >= 65) {
  return roundCurrency(subtotal * 0.2);
}
```

The starting tests cover `age = 70`, but they do not cover the exact `age = 65` boundary. A mutation from `>=` to `>` can survive until the missing boundary test is added.

## 1. Prepare the repository

From a fresh clone:

```bash
git clone https://github.com/canblmz1/tautest.git
cd tautest
pnpm install --frozen-lockfile
pnpm build
```

Create a temporary demo branch so the working tree can be restored easily:

```bash
git switch -c tautest-demo-run
```

## 2. Confirm regular tests pass

```bash
pnpm --dir examples/vitest-basic test
```

Expected result:

```text
Test Files  1 passed
Tests       3 passed
```

At this point the normal test suite is green.

## 3. Create a tiny source diff

Tautest works from a Git diff, so this command makes a harmless source-line edit on the boundary line:

```bash
node -e "const fs=require('node:fs'); const p='examples/vitest-basic/src/discount.ts'; const s=fs.readFileSync(p,'utf8'); fs.writeFileSync(p,s.replace('if (age >= 65) {','if (age >= 65) { // senior boundary'))"
```

The behavior is unchanged, and the regular tests still pass:

```bash
pnpm --dir examples/vitest-basic test
```

## 4. Run Tautest

```bash
pnpm --dir examples/vitest-basic exec tautest run --base HEAD --threshold 80 --prompt-style codex || true
```

The command is allowed to exit non-zero because the demo intentionally starts with a surviving mutant.

Expected shape:

```text
Tautest: MIXED
Killed: 3 | Survived: 1 | No coverage: 0

Top surviving mutants:
- src/discount.ts:2 EqualityOperator - The exact boundary value 65 is not protected by a test that distinguishes the original expression from the mutant.
```

The important finding is the survived equality/operator boundary mutant. The tests pass, but they do not defend the exact `age === 65` behavior.

Tautest also writes:

- `examples/vitest-basic/.tautest/report.md`
- `examples/vitest-basic/.tautest/report.json`
- `examples/vitest-basic/.tautest/fix-prompt.md`

Open the prompt:

```bash
cat examples/vitest-basic/.tautest/fix-prompt.md
```

The prompt tells a human or coding agent to strengthen tests only and avoid changing production code.

## 5. Add the missing boundary test

```bash
node <<'JS'
const fs = require('node:fs');
const p = 'examples/vitest-basic/src/discount.test.ts';
const s = fs.readFileSync(p, 'utf8');
const boundary = `

  it('applies the senior discount at the exact boundary', () => {
    expect(calculateDiscount(65, 100)).toBe(20);
  });`;

fs.writeFileSync(
  p,
  s.replace(/\r?\n\r?\n  it\('applies the subtotal discount at 100'/, `${boundary}\n\n  it('applies the subtotal discount at 100'`)
);
JS
```

Run the normal test suite again:

```bash
pnpm --dir examples/vitest-basic test
```

Expected result:

```text
Tests  4 passed
```

## 6. Re-run Tautest

```bash
pnpm --dir examples/vitest-basic exec tautest run --base HEAD --threshold 80 --prompt-style codex
```

Expected shape:

```text
Tautest: STRONG
Killed: 4 | Survived: 0
```

The production code did not change. The test suite got sharper.

## 7. Clean up

Return to the original example state:

```bash
git restore examples/vitest-basic/src/discount.ts examples/vitest-basic/src/discount.test.ts
git switch main
git branch -D tautest-demo-run
```

Generated `.tautest/` files are ignored by Git and can be removed if desired:

```bash
rm -rf examples/vitest-basic/.tautest
```

## Why this is the product

This is the Tautest value loop:

1. Start from changed production lines.
2. Run StrykerJS only where the PR changed behavior.
3. Find surviving mutants.
4. Turn them into readable reports and test-fix prompts.
5. Add or strengthen tests only.
6. Re-run normal tests and Tautest.

Tautest does not replace StrykerJS. It makes StrykerJS results easier to use as a PR mutation quality gate.
