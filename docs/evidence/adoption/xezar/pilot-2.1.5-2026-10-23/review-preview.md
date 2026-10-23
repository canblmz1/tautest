> Read-only preview generated from the analyze-only one-line source sample. No project tests or engine ran during this import. Regenerate the complete pinned report before verification; this excerpt is not a verify input.

# Imported Stryker Report

## Summary

- Verdict: **WEAK**
- Mutation score: **33.33%**
- Killed: **1**
- Survived: **2**
- No coverage: **0**
- Runner: **vitest**
- Timeout: **0**
- Runtime error: **0**
- Compile error: **0**

> No threshold was evaluated; 2 surviving mutants still need review. A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change.

## Mutated Files

- `packages/xezar/src/mcp/api-reference.ts`

## Top Surviving Mutants

| File | Line | Mutator | Original | Replacement |
| --- | ---: | --- | --- | --- |
| `packages/xezar/src/mcp/api-reference.ts` | 109 | EqualityOperator | performing.length > 0 | performing.length >= 0 |
| `packages/xezar/src/mcp/api-reference.ts` | 109 | EqualityOperator | performing.length > 0 | performing.length <= 0 |

## Mutant Details

### 1. `packages/xezar/src/mcp/api-reference.ts:109` EqualityOperator

- Status: **Survived**
- Original code:

```ts
performing.length > 0
```

- Replacement code:

```ts
performing.length >= 0
```

- Covering tests:
  - `packages/xezar/src/mcp/api-reference.test.ts` - buildMcpApiReference — the listings the live registry does not produce (#352) #450 T-30: the real leader_events listing shows operationId required by ack, attach and stop, and by nothing else
- Category: boundary
- Likely missing behavior: The exact boundary value 0 may not be protected by a test that distinguishes the original expression from the mutant. Confirm the two sides actually produce different results before treating this as a gap.
- Why this matters: A comparison boundary can move by one value while existing tests still pass, but some boundary shifts (for example a redundant guard) never change the observable result and are equivalent mutants rather than gaps.
- Suggested test idea: If 0 and its neighbor produce different observable results, add a boundary test for the exact value 0. If they behave the same either way, this is likely an equivalent mutant; consider a documented Stryker ignore instead of writing a test.

### 2. `packages/xezar/src/mcp/api-reference.ts:109` EqualityOperator

- Status: **Survived**
- Original code:

```ts
performing.length > 0
```

- Replacement code:

```ts
performing.length <= 0
```

- Covering tests:
  - `packages/xezar/src/mcp/api-reference.test.ts` - buildMcpApiReference — the listings the live registry does not produce (#352) #450 T-30: the real leader_events listing shows operationId required by ack, attach and stop, and by nothing else
- Category: boundary
- Likely missing behavior: The exact boundary value 0 may not be protected by a test that distinguishes the original expression from the mutant. Confirm the two sides actually produce different results before treating this as a gap.
- Why this matters: A comparison boundary can move by one value while existing tests still pass, but some boundary shifts (for example a redundant guard) never change the observable result and are equivalent mutants rather than gaps.
- Suggested test idea: If 0 and its neighbor produce different observable results, add a boundary test for the exact value 0. If they behave the same either way, this is likely an equivalent mutant; consider a documented Stryker ignore instead of writing a test.


## Review queue

Imported report only; no tests or configuration were executed. The raw mutation score is not a new quality-gate result.
All recorded mutant states are terminal.
Local source context is unavailable or stale; analysis is read-only and review decisions cannot be recorded. Use the matching project checkout to record decisions within the documented snapshot limits.

- 792e0884aaf0a9b0d161aeaf98135b0250127a67a42d0bd1789fe2a9414bc907: packages/xezar/src/mcp/api-reference.ts:109 (2 mutants), unreviewed
