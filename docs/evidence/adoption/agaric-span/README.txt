Agaric tokenizer: exact reported ArrayDeclaration survivor

Upstream issue: https://github.com/jfolcini/agaric/issues/3764
Original report run: https://github.com/jfolcini/agaric/actions/runs/39183149461
Frozen source: d52b57959a7ed7781b4f718884200ce1e4eac35f
Passing diagnostic: https://github.com/canblmz1/tautest/actions/runs/39241954473

The 25 original tokenizer tests pass both unchanged code and the exact
reported mutant 63: src/lib/search-query/tokenize.ts:158:39-49,
ArrayDeclaration, [start, i] -> []. A single new test asserts the span
for an unclosed embedded quote. With the exact mutation it fails at its
expected assertion; unchanged source plus the new test passes 26 tests.

Recipe and the authored candidate are in scripts/adoption-proof/agaric-span.
The workflow downloads only frozen upstream source/tests with their original
GPL license into an ignored fixture. No upstream source is vendored here.
Run prepare.mjs, install the isolated fixture dependencies using pnpm, then
run prove.mjs from this repository root, as the workflow does.

This uses Vitest 5.0.3 with a minimal alias-only test config and applies the
report's exact replacement by line AND column, restoring it in finally.
It is not a full project check, a Stryker rerun or a Tautest verify result.
Tautest execution support for Vitest 5 is not claimed. Report-only analyze
was tested separately on the unchanged 96-record report using npm 2.1.2.
The original 85 Killed, 6 Survived and 5 Timeout counts remain unchanged.
Existing accepted equivalents are not reclassified by this experiment.
All experiments were run by the tool maintainer, not an external adopter.
