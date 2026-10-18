TriAD Address boundary evidence — 2026-10-18

This is a Tautest-maintainer-run proof, not external adoption.
Project: https://github.com/Thang4869/TriAD-Backend
Revision: 7e41358c9936186d5469437584845335ec255ad1
Related issue: https://github.com/Thang4869/TriAD-Backend/issues/145
Linux CI: https://github.com/canblmz1/tautest/actions/runs/39157061899

The Address constructor accepts at most 500 normalized characters. The existing
tests did not detect changing its upper bound from > 500 to >= 500. The proposed
address.test.ts adds two cases: accept 500 after trimming and reject 501.

Scope: full src/shared/value-objects/address.ts, first with the existing three
value-object tests, then with those same tests plus the two new tests.
Before: 17 mutants, 13 Killed, 3 Survived, 1 NoCoverage, 0 Timeout.
After:  17 mutants, 16 Killed, 0 Survived, 1 NoCoverage, 0 Timeout.
Raw scores: 76.47% -> 94.12%, for this file and test selection only.
The remaining NoCoverage finding is retained in the report.

Published Tautest 2.1.0 verified the exact EqualityOperator target
normalized.length >= 500. Its initial test run passed, testsCompleted was 1,
and killing test id 3 belongs to the selected new address.test.ts file.
The initial unmutated test selection grew from 3 passing tests to 5 passing
tests. Production source bytes were unchanged.

Toolchain: Node 22.23.3, Stryker and runner 10.0.0, Vitest 4.1.11.
Only address.test.ts is proposed as an upstream change. No dependency, source
or CI change is needed to use these tests. The maintainer can copy it onto
their shared date branch. This does not close all of issue #145, establish a
repository-wide threshold, prove integration tests, or claim a new user.

before.mutation.json and after.mutation.json preserve source, mutant identities,
statuses, executed-test counts and test attribution. Irrelevant engine config
and project-root metadata are omitted from these portable copies. evidence.json
retains original CI execution paths and exact report/source/test hashes.
The full raw captures and worker logs are attached to the linked CI run.

Optional report-only trial from any directory with Node 22+:
  npx tautest@2.1.0 analyze --from before.mutation.json --runner vitest

This reads the downloaded raw report and writes .tautest/review outputs. It
does not run the project, evaluate its config, require Git or install Stryker.
For a fresh engine reproduction in a disposable checkout, see
scripts/adoption-proof/triad/README.txt and the pinned proof workflow.

The inspected project's MIT copyright and permission are in PROJECT-LICENSE.
