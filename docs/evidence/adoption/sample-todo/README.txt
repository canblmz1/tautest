Sample Todo Apps: exact maximum title boundary

Upstream issue: https://github.com/thalesraymond/sample-todo-apps/issues/9
Original report: https://github.com/thalesraymond/sample-todo-apps/actions/runs/39187360049
Frozen revision: 7fd99fa4a6fe5b4471dc2d419b968fe90cda4a7c
Linux proof: https://github.com/canblmz1/tautest/actions/runs/39246296963
Recipe/candidate: scripts/adoption-proof/sample-todo/

The original report has 403 mutants: 295 Killed, 94 Survived, 14 NoCoverage.
The issue's 108 figure combines Survived with NoCoverage. Offline import with
published Tautest 2.1.2 preserves those counts in 102 source-expression groups.

The existing TodoTitle tests reject empty and 256-character strings but do
not accept the maximum valid 255-character title. The exact original target
is EqualityOperator at src/domain/todo-title.ts:8:9-27, > 255 -> >= 255.
It is id 30 in the original whole-app report and id 8 in the scoped proof.

An isolated copy of the frozen TodoTitle module, its original test file and
Vitest setup/config passes 4 tests before and 5 with the authored candidate.
Stryker 9.6.1/Vitest 4.1.5 campaign over the whole TodoTitle source:
  before: 17 total, 16 Killed, 1 Survived
  after:  17 total, 17 Killed, 0 Survived
Published Tautest 2.1.2 verify identifies the exact target and attributes its
kill to the new accepts-exactly-255 test. Original source/tests unchanged.

The fixture narrows the original Vitest include to the two domain test files;
the upstream checkout is untouched. This is NOT a full application test/build/
lint validation or a new application-wide mutation score. No database or live
service was used. The full retained diagnostic is in the CI artifact.
All runs are our own experiments, not independent adoption.
