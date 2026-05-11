# Phase 4 Prompt Eval

## Goal

Evaluate whether Tautest's markdown report and AI fix prompt give an agent enough context to strengthen tests without changing production code.

This phase does not call an LLM API. The eval is deterministic: fixtures are parsed as Stryker mutation reports, converted into Tautest prompts, and checked for actionable guidance, hard safety rules, and validation-loop instructions.

## Eval Fixture Set

Fixtures live in `packages/core/test/fixtures/prompt-eval`.

| Fixture | Mutant type | Surviving behavior | Expected useful test |
| --- | --- | --- | --- |
| `boundary-condition.json` | Boundary condition | `age >= 65` -> `age > 65` | Add an exact boundary test for age `65`. |
| `boolean-condition.json` | Boolean condition | `isActive && hasBadge` -> `isActive || hasBadge` | Add a truth-table case where only one boolean is true. |
| `arithmetic-operator.json` | Arithmetic operator | `price * quantity` -> `price / quantity` | Add a concrete non-zero numeric assertion. |
| `conditional-expression.json` | Conditional expression | branch forced to `false` | Add a test for the branch that should be taken. |
| `no-coverage.json` | No coverage | equality mutation in unexecuted code | Add a first covering test for the code path. |

## What The Prompt Can Kill

- Boundary condition: high confidence. The prompt identifies the exact boundary value and asks for a focused boundary assertion.
- Boolean condition: high confidence. The prompt asks for a missing truth-table combination instead of a broad smoke test.
- Arithmetic operator: medium-high confidence. The prompt asks for exact numeric assertions with non-zero inputs.
- Conditional expression: medium-high confidence. The prompt asks for taken and not-taken branch coverage.
- No coverage case: medium confidence. The prompt correctly asks for a first covering test, but the agent still needs to infer the most meaningful domain input.

## Production Code Edit Risk

The prompt now explicitly forbids:

- production code changes
- non-test file edits
- weakened assertions
- deleted, skipped, or todo tests
- filler tests such as `expect(true).toBe(true)`
- new dependencies
- silent implementation rewrites when a real production bug is suspected

If a genuine production bug is found, the prompt tells the agent to stop and report it instead of rewriting implementation.

## Validation Loop

Every generated prompt includes this loop:

1. Run the normal test suite.
2. Run Tautest again.
3. Confirm the mutation score increased or stayed strong while the listed mutant was killed.
4. If the score does not improve or the mutant still survives, reread the prompt and adjust the test.
5. Do not change production code to make the mutant disappear.

This is designed to prevent a common failure mode where an agent writes a test that passes but does not kill the mutant.

## Prompt Styles

Supported deterministic styles:

- `agent`
- `human`
- `claude-code`
- `cursor`
- `codex`

The styles change framing and workflow language, not the hard safety rules.

## Known Weak Spots

- The suggested test idea is heuristic. It is strongest for common mutators such as boundaries, boolean logic, arithmetic operators, conditionals, and no-coverage mutants.
- The prompt can point to covering tests reported by Stryker, but it does not inspect full test files or generate exact patches.
- No real agent was executed in this phase, so the eval measures prompt quality and guardrails, not end-to-end autonomous repair success.
- For no-coverage mutants, the prompt can identify missing execution but cannot always infer the best business-level scenario from source alone.

## Verification

Covered by unit tests in `packages/core/test/reporting.test.ts`:

- five fixture prompts are generated
- hard rules are present
- validation loop is present
- boundary, boolean, arithmetic, conditional, and no-coverage guidance appears
- terminal summary stays under 25 lines
- JSON report uses the v1 schema fields

## Result

The prompt is suitable to hand directly to Claude Code, Cursor, or Codex for focused test strengthening. It remains deterministic and file-based, with no LLM API integration.
