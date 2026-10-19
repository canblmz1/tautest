Vimsplain ex-command test gaps

Upstream issue: https://github.com/oller/vimgym/issues/35
Original report run: https://github.com/oller/vimgym/actions/runs/39107669320
Frozen revision: e65d98ca48f6432779b6bf2cb677d1a9116400d8
Passing Linux proof: https://github.com/canblmz1/tautest/actions/runs/39242909016
Published package: tautest@2.1.2, installed separately from the project engine.
Recipe/candidate: scripts/adoption-proof/vimsplain/

Original complete package suite: 372 passing tests. With two new ex-command
tests: 374 passing. Production source, configuration, original tests unchanged.

Mutation campaign scope: full src/handlers/command.ts only, TypeScript checker
retained, original Vitest config, incremental cache disabled, concurrency one.
Before: 52 mutants, 42 Killed, 4 Survived, 6 CompileError.
After:  52 mutants, 44 Killed, 2 Survived, 6 CompileError.
The two remaining survivors are the substitution regex and cancel-command text.
This is not the full package's mutation score.

Tautest verify independently reran both exact MethodExpression targets from
the fresh before report, requiring the initial suite to pass, executed tests
and candidate-file attribution. Both targets were killed by the NEW whitespace
test (which asserts both explanation and empty remaining input). The second
new test pins processing of a subsequent dd command; it is not claimed as
either target's recorded killer. Test names are retained in evidence.json.

The workflow checks out frozen public source, installs the locked dependencies,
installs the public CLI separately, and runs the proof without source patches.
Source and raw full reports are available in the run artifact, not vendored in
this evidence folder. All experiments are our own, not external adoption.
