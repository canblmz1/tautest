Check the intended mutant and the selected test file

Published Tautest 2.1.1, StrykerJS 10.0.0, Vitest 4.1.11, Node 22.
Passing public CI: https://github.com/canblmz1/tautest/actions/runs/39160543364
Frozen fixture: Thang4869/TriAD-Backend@7e41358c9936186d5469437584845335ec255ad1
Reproduction: scripts/adoption-proof/verification-controls/README.txt

The original Address survivor changes `normalized.length > 500` to
`normalized.length >= 500`. That incorrectly rejects a valid 500-character
address. Its original report id is 11; its id in every scoped replay was 6.
The target is matched by file, location, mutator and replacement, not by
assuming a fresh Stryker run preserves numeric ids.

Measured cases

Selected file                         Exact target     Tautest result
empty-only test, 4 normal tests pass   Survived          not-verified
empty-only test, boundary file loaded  Killed elsewhere  not-verified
new boundary-test file                Killed by it      verified

The baseline has 3 passing tests. Adding only the weak empty-address test
gives 4 passing tests. Adding the 2 boundary tests gives 6 passing tests.
Every replay executes the exact target: testsCompleted=1 in all three cases.
In the successful case, the fresh report names
"Address length limit accepts exactly 500 characters after trimming" as the
killer in the selected new file. The wrong-file case is rejected even though
the mutant is Killed, because its killer belongs to the other file.

This is an exact-target contribution check, not a whole-project score.
Production source and the original raw report stayed unchanged. The original
report is retained at ../triad-address/before.mutation.json. Each portable
case report retains all raw mutants/test attribution within the line-6 scope;
non-target mutants are not filtered out. Test JSON results and source license
are retained alongside the verification evidence.

Using the workflow in a StrykerJS project

1. Choose the actual survivor id and file from the original raw report.
2. Put the candidate assertions in a NEW test file, included by the project's
   existing test configuration. Run the normal suite and require it to pass.
3. Install Tautest alongside the project's existing Stryker and test runner,
   then invoke the project-local CLI, for example:

   npm install --save-dev tautest@2.1.1
   npx tautest verify --from reports/mutation/mutation.json --mutant TARGET_ID --file src/module.ts --test test/new-regression.test.ts --budget 120

Use the project's real report/id/paths, not these placeholders. Verification
uses its local Stryker configuration, scopes mutation to the target lines and
requires the initial suite to pass. Inspect verification.json and the fresh
mutation.json testFiles/killedBy mapping for the actual killing test names.
Refresh the existing full Stryker report to measure the remaining score.

Important boundary: Tautest attributes a kill to the selected FILE. Selecting
a file containing both old and new tests does not itself prove the new test
was the killer. Use a wholly new candidate file as here, or independently
check the named killing tests before claiming an individual new-test result.

This fixture uses a supported Node/Vitest/Stryker setup. It does not establish
support for Vitest 5, Python, arbitrary hand-rolled harnesses or build-time
checks. It is a Tautest-maintainer experiment, not an external user's run or
an evaluation showing that agents write better tests with Tautest.
