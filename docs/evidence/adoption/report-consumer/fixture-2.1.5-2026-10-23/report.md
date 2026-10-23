# Imported Stryker Report

## Summary

- Verdict: **MIXED**
- Mutation score: **75.00%**
- Killed: **3**
- Survived: **1**
- No coverage: **0**
- Runner: **vitest**
- Timeout: **0**
- Runtime error: **0**
- Compile error: **0**

> No threshold was evaluated; 1 surviving mutant still needs review. A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change.

## Mutated Files

- `src/eligibility.ts`

## Top Surviving Mutants

| File | Line | Mutator | Original | Replacement |
| --- | ---: | --- | --- | --- |
| `src/eligibility.ts` | 2 | EqualityOperator | age >= 18 | age > 18 |

## Mutant Details

### 1. `src/eligibility.ts:2` EqualityOperator

- Status: **Survived**
- Original code:

```ts
age >= 18
```

- Replacement code:

```ts
age > 18
```

- Covering tests:
  - `test/eligibility.test.ts` - accepts an adult
  - `test/eligibility.test.ts` - rejects an underage applicant
- Category: boundary
- Likely missing behavior: The exact boundary value 18 may not be protected by a test that distinguishes the original expression from the mutant. Confirm the two sides actually produce different results before treating this as a gap.
- Why this matters: A comparison boundary can move by one value while existing tests still pass, but some boundary shifts (for example a redundant guard) never change the observable result and are equivalent mutants rather than gaps.
- Suggested test idea: If 18 and its neighbor produce different observable results, add a boundary test for the exact value 18. If they behave the same either way, this is likely an equivalent mutant; consider a documented Stryker ignore instead of writing a test.


## Review queue

Imported report only; no tests or configuration were executed. The raw mutation score is not a new quality-gate result.
All recorded mutant states are terminal.
Local source context is unavailable or stale; analysis is read-only and review decisions cannot be recorded. Use the matching project checkout to record decisions within the documented snapshot limits.

- 74fc6500404fb6c0628b719e5620b729d1a51460bbdde51e2687d2ef0e1a2a31: src/eligibility.ts:2 (1 mutants), unreviewed
