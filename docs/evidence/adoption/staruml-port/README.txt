StarUML extension-port proof, 2026-10-18

Project: hqqw2h-lgtm/staruml-mcp
Inspected revision: 3a58d812d7c52b559ac920bf17fc0fa1cf19dcf3
Successful public CI: https://github.com/canblmz1/tautest/actions/runs/39158116239
Reproduction: scripts/adoption-proof/staruml/README.txt on this branch.

The proposed patch adds two fetch-mocked tests for the default and custom
extension API ports. Apply with git apply --unidiff-zero extension-port-tests.patch.
No production code, dependency or CI change is proposed to the target project.

The 14 existing client tests passed but did not catch changing
options.extPort ?? DEFAULT_EXT_PORT to options.extPort && DEFAULT_EXT_PORT.
With the patch, all 16 tests pass. Tautest 2.1.0 exact-mutant verification
identified the new default-port test as the killer (3 tests completed, id 2).
The same one-line Stryker scope changed from 1 Survived to 1 Killed, without
NoCoverage, Timeout or RuntimeError findings. Production source bytes match.

This is only src/staruml-client.ts:38-38; it is not a project-wide score or
completion of issue #14's broader performance/fuzzing checklist. The proof
was run by the Tautest maintainer, not by an external user.

before.mutation.json and after.mutation.json retain source, tests and raw
mutant status. evidence.json retains hashes, tool versions and verification.
The project MIT license is included in PROJECT-LICENSE.
