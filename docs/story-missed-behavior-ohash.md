# A missing test that coverage can't see

This is a real, small example of the specific gap Tautest is built to find: a test suite that passes, on code that runs, but doesn't actually pin down the behavior a fix was supposed to add.

## The PR

[unjs/ohash#196](https://github.com/unjs/ohash/pull/196), "fix(utils): diff falsy primitive values," merged into a well-maintained, widely used library. The fix is one line, in `_toHashedObject`:

```diff
 function _toHashedObject(obj: any, key = ""): DiffHashedObject {
-  if (obj && typeof obj !== "object") {
+  if (obj === null || typeof obj !== "object") {
     return new DiffHashedObject(key, obj, serialize(obj));
   }
```

The old condition `obj && typeof obj !== "object"` is false whenever `obj` is falsy — so the `false` in `diff(true, false)` and the `null` in `diff("value", null)` would fall through to the object-diffing branch instead of being compared directly as primitives, producing a wrong diff for exactly the inputs most likely to be edge cases: `0`, `false`, `null`, `""`.

The PR's own test file adds the obviously-needed case:

```ts
it("formats falsy primitive changes", () => {
  expect(diff(true, false)).toMatchInlineSnapshot(`
    [
      "Changed \`\` from \`true\` to \`false\`",
    ]
  `);
  expect(diff("value", null)).toMatchInlineSnapshot(`
    [
      "Changed \`\` from \`"value"\` to \`null\`",
    ]
  `);
});
```

This is a well-tested PR by a careful author. The point of this example isn't that the fix was sloppy — it's what happens if that one test is ever weakened, skipped, or lost in a later refactor, and nothing downstream would notice.

## Reproducing it

Running Tautest against this PR's diff (`tautest run --base 2c6e231c`, scoped to the single changed line `src/utils/diff.ts:46`) with the real test suite in place (first lines of the actual output; runtime varies per run):

```
Tautest: STRONG (100.00%, threshold 60.00%)
Runner: vitest | Runtime: 11.5s | Files: 1 | Changed lines: 1 | Mutate patterns: 1
Killed: 5 | Survived: 0 | No coverage: 0 | Timeout: 3
```

Clean. Now remove the one test that covers the case the fix was about — `it.skip` on "formats falsy primitive changes," nothing else changed:

```
Tautest: STRONG (87.50%, threshold 60.00%)
Runner: vitest | Runtime: 12.1s | Files: 1 | Changed lines: 1 | Mutate patterns: 1
Killed: 4 | Survived: 1 | No coverage: 0 | Timeout: 3
Threshold passed; 1 surviving mutant still needs review before treating this patch as fully covered. A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change.
```

The normal test suite still reports **74 passed, 1 skipped** — nothing red, nothing to notice in a CI summary. But the surviving mutant points at exactly the right place:

```
- src/utils/diff.ts:46 ConditionalExpression - One branch direction may be forced without the current tests failing. Confirm both directions actually produce different observable results before treating this as a gap.
```

The mutant is `obj === null` replaced with `false` — the one part of the fix that only the skipped test exercises. It brings back the `null` half of the original bug: `diff("value", null)` treats `null` as an object again. (The `diff(true, false)` half still works under this mutant, since `typeof false` is not `"object"`.)

A note on the gate itself: with the default 60% threshold, an 87.50% score **passes**, and it still does — the threshold math and exit code are unchanged. What changed is the report. The published 2.0.0 release already counted and listed this survivor, but under a `STRONG (87.50%)` verdict and a passing gate, with nothing tying the two together; the next release adds the "Threshold passed; 1 surviving mutant still needs review" line shown above, because a passing score is not the same claim as "no gaps remain," and this PR is a real instance of the difference.

## Why coverage alone would not have caught this

We measured it. `vitest run --coverage` on `src/utils/diff.ts`, with and without the falsy-value test:

| | Tests | % Stmts | % Branch | % Funcs | % Lines | Uncovered lines |
| --- | --- | --- | --- | --- | --- | --- |
| with the test | 75 passed | 86.36 | 81.81 | 77.77 | 86.36 | 69, 99, 106-110 |
| test skipped | 74 passed, 1 skipped | 86.36 | 81.81 | 77.77 | 86.36 | 69, 99, 106-110 |

The coverage report is **identical** — every column, down to the list of uncovered lines. Line 46 stays covered either way, because plenty of other tests call `diff()` with non-null values and execute that line. Removing the only test that pins down the fixed behavior is invisible to coverage. It is not invisible to mutation testing, which goes from 0 survivors to 1, on that exact line.

Coverage answers "did this line run," and the answer stays yes. Mutation testing answers "if this line's logic changes, does anything fail" — and that's the question that actually protects the falsy-value case.

## Reproduce this yourself

```bash
node scripts/oss-adoption-corpus-run.mjs \
  --repo=https://github.com/unjs/ohash.git --pr=196 \
  --base=2c6e231ccfc229ab90a3e026635984f1ccd89b1d \
  --head=a65d622c4c390061baf408b0ecdf4d5031753c69 \
  --runner=vitest --package-manager=pnpm --build
```

The script prints where it left the clone. In that checkout, delete the `stryker.config.json` the harness wrote for its direct-Stryker comparison, `it.skip` the "formats falsy primitive changes" test in `test/utils.test.ts`, and rerun Tautest from your Tautest checkout's build — `node <path-to-tautest>/packages/cli/dist/index.js run --base 2c6e231ccfc229ab90a3e026635984f1ccd89b1d` — to see the survivor appear. Full run data, including the direct-Stryker cross-check, is in [`docs/oss-adoption-corpus.md`](oss-adoption-corpus.md#unjsohash196--fixutils-diff-falsy-primitive-values).

Apart from installing Stryker and the one `it.skip` used to demonstrate the gap, none of this touched ohash's code or tests — the point is what a maintainer or reviewer would see if they ran this on their own next PR.
