> Read-only preview from a one-line source excerpt and recorded mutant/test metadata. This sample is for `analyze` only; regenerate the complete report using the pinned helper before `verify`. Full source/test bodies are omitted.

# Imported Stryker Report

## Summary

- Verdict: **WEAK**
- Mutation score: **50.00%**
- Killed: **1**
- Survived: **1**
- No coverage: **0**
- Runner: **vitest**
- Timeout: **0**
- Runtime error: **0**
- Compile error: **0**

> No threshold was evaluated; 1 surviving mutant still needs review. A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change.

## Mutated Files

- `src/lib/active-session/roster.ts`

## Top Surviving Mutants

| File | Line | Mutator | Original | Replacement |
| --- | ---: | --- | --- | --- |
| `src/lib/active-session/roster.ts` | 153 | EqualityOperator | id.length > 0 | id.length >= 0 |

## Mutant Details

### 1. `src/lib/active-session/roster.ts:153` EqualityOperator

- Status: **Survived**
- Original code:

```ts
id.length > 0
```

- Replacement code:

```ts
id.length >= 0
```

- Covering tests:
  - `src/lib/active-session/roster.test.ts` - session identity matches the same members in the same raid, in any order
  - `src/lib/active-session/roster.test.ts` - session identity matches a Roster that grew between polls
  - `src/lib/active-session/roster.test.ts` - session identity matches a Roster that shrank between polls
  - `src/lib/active-session/roster.test.ts` - session identity matches when the tracked player changed but the Roster did not
  - `src/lib/active-session/roster.test.ts` - session identity does not match the same members in a different raid
  - `src/lib/active-session/roster.test.ts` - session identity does not match unrelated or partly overlapping Rosters in the same raid
  - `src/lib/active-session/roster.test.ts` - session identity follows an open fireteam across polls as its Roster changes
  - `src/lib/active-session/roster.test.ts` - session identity forgets an open fireteam that is no longer on the page
  - `src/lib/active-session/roster.test.ts` - session identity toggles one fireteam open and shut, leaving other open fireteams alone
- Category: boundary
- Likely missing behavior: The exact boundary value 0 may not be protected by a test that distinguishes the original expression from the mutant. Confirm the two sides actually produce different results before treating this as a gap.
- Why this matters: A comparison boundary can move by one value while existing tests still pass, but some boundary shifts (for example a redundant guard) never change the observable result and are equivalent mutants rather than gaps.
- Suggested test idea: If 0 and its neighbor produce different observable results, add a boundary test for the exact value 0. If they behave the same either way, this is likely an equivalent mutant; consider a documented Stryker ignore instead of writing a test.


## Review queue

Imported report only; no tests or configuration were executed. The raw mutation score is not a new quality-gate result.
All recorded mutant states are terminal.
Local source context is unavailable or stale; analysis is read-only and review decisions cannot be recorded. Use the matching project checkout to record decisions within the documented snapshot limits.

- 2f47bf4d8bb2e86588f208f507369319619a27caf36954502a5883db7cb9cc79: src/lib/active-session/roster.ts:153 (1 mutants), unreviewed
