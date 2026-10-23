> Read-only preview from a one-line source excerpt and recorded mutant/test metadata. This sample is for `analyze` only; regenerate the complete report using the pinned helper before `verify`. Full source/test bodies are omitted.

# Imported Stryker Report

## Summary

- Verdict: **WEAK**
- Mutation score: **0.00%**
- Killed: **0**
- Survived: **1**
- No coverage: **0**
- Runner: **vitest**
- Timeout: **0**
- Runtime error: **0**
- Compile error: **0**

> No threshold was evaluated; 1 surviving mutant still needs review. A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change.

## Mutated Files

- `src/lib/shell/trip-time.ts`

## Top Surviving Mutants

| File | Line | Mutator | Original | Replacement |
| --- | ---: | --- | --- | --- |
| `src/lib/shell/trip-time.ts` | 18 | MethodExpression | trip.timezone?.trim() | trip.timezone |

## Mutant Details

### 1. `src/lib/shell/trip-time.ts:18` MethodExpression

- Status: **Survived**
- Original code:

```ts
trip.timezone?.trim()
```

- Replacement code:

```ts
trip.timezone
```

- Covering tests:
  - `src/lib/shell/trip-time.test.ts` - tripTz returns the trip timezone when set
  - `src/lib/shell/trip-time.test.ts` - tripTz falls back to UTC when blank
  - `src/lib/shell/trip-time.test.ts` - tripTz falls back to UTC when the stored value is not a valid IANA zone
- Category: generic
- Likely missing behavior: This mutant survived the current tests. It may point to a missing test, or it may be an equivalent mutant that does not change observable behavior.
- Why this matters: A surviving mutant is not automatically a missing test — confirm the original and replacement code actually disagree on some observable output before treating this as a gap.
- Suggested test idea: If you can find an input where the original and replacement code produce different observable results, add the smallest assertion that passes on the original and fails on the replacement. If no such input exists, this is likely an equivalent mutant; consider a documented Stryker ignore instead of writing a test.


## Review queue

Imported report only; no tests or configuration were executed. The raw mutation score is not a new quality-gate result.
All recorded mutant states are terminal.
Local source context is unavailable or stale; analysis is read-only and review decisions cannot be recorded. Use the matching project checkout to record decisions within the documented snapshot limits.

- 71bc653652cb8e42df676e263a373325baf60e820d75aaad3a3521e1eb506e31: src/lib/shell/trip-time.ts:18 (1 mutants), unreviewed
