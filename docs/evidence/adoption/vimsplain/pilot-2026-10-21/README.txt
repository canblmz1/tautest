Vimgym: one whitespace behavior, one executed survivor, one test
=============================================================

Need: https://github.com/oller/vimgym/issues/35
Project SHA: e65d98ca48f6432779b6bf2cb677d1a9116400d8
Real comparison base: 2aca9c37c6a6cc9997af16c1cd48ac365f5f8307
Selected package: packages/vimsplain (not the React/Supabase application).

The current dashboard still lists cmd.trim() -> cmd as a surviving mutation.
Tautest's existing analyze/verify commands connect that finding to covering tests
and verify a focused candidate. Success here means the existing suite passes,
the exact mutant survives it, and one new behavior assertion kills that same
mutant while passing on the original source, including a second verification.

This is an updated reproduction of our earlier suggestion, NOT a new discovery.
No upstream test change or independent user trial is claimed. The two current open
PRs (#43 Actions, #44 dependency manifests/lock) do not contain this test/source fix.
Only the five existing candidates were refreshed; see candidates.json. Ledgr #123
already fixed its price-clause gap and was not reused as a new finding.

WHAT WAS OBSERVED
-----------------
Windows, Node 22.23.2; pnpm 10.34.6; Vitest 4.1.11; Stryker core/runner/checker 10.0.0.
Published tautest AND @tautest/core 2.1.3, installed from this tool's package-lock.
No build from unmerged PR #47/#48/#49 was used. They remain open with 13/13 CI each.

Original package suite: 372 passed (coverage 151, fuzz 3, integration 5, vimsplain 213).
Direct Stryker, exactly one MethodExpression mutant on command.ts 22:19–22:29:
  original: cmd.trim()
  replacement: cmd
  before: Survived, testsCompleted: 13, coveredBy: 13 existing tests.
With one new test: 373 passed on original source.
Tautest verify: verified / Killed; verify-repeat: verified / Killed.
Both kills are attributed to tests/tautest-ex-command-whitespace.test.ts:
  explains a whitespace-padded ex write command as write file
Both raw reports show the behavioral assertion failure:
  expected 'run ex command \' w \'' to be 'write file'
No compile error, infrastructure error or timeout is counted as a kill.

The public input explainSequence(': w [Enter]') must explain "write file".
The production handler deliberately trims the ex command before its known-command
lookup. Removing trim instead produces the generic explanation, an observable
difference; this is not an equivalent mutant or a request to assert implementation
details. The proposed test has one assertion on the public explanation only.

Mutant matching uses source hash + file + inclusive start/exclusive end + mutator + replacement,
not numeric ID. The candidate test ID changed from 372 to 0 between verifications;
both map to the same new test file/name. Source bytes and original tests/config
were preserved; the temporary candidate was removed after the experiment.
Cross-platform source hashes use explicit LF normalization; raw byte hashes are
also retained. Full fingerprints, lock hashes and measured step durations are in
observed/evidence.json. Durations are one-host observations, not speedup claims.

TAUTEST'S CONTRIBUTION AND SCOPE
-------------------------------
Stryker generates and executes the mutant. Tautest analyze shows cmd.trim() beside
cmd and the 13 recorded covering-test names, then verify establishes that the chosen
test kills the exact target. The producer was direct project Stryker; no faster-than-
Stryker or new mutation algorithm claim is made.

The separate actual diff dry-run uses the real comparison base above and the
unmodified project mutation include/exclude rules, with rangeCoalesceGap 0. Its 202
selected source lines match raw git new-side hunk coordinates exactly. For command.ts
the ranges are 33–44 and 57–63, NOT 22. Other selected files/ranges are recorded in
observed/scope-proof.json and recent-source.diff; no mutants were run in those files.
The whitespace target is old baseline debt imported for review, NOT a finding from
that recent diff. The base is historical, not a current open source-change PR.

This is one artificially narrowed target, not a package/repository score or gate.
Analyze executes no tests/gate. Do not interpret its generic "Threshold passed"
text as a repository quality-gate pass; its imported score describes this target.
NoCoverage was not observed here. A NoCoverage result would require checking
selection/effective config/attribution before alleging missing tests (#49 policy).

RUN IT YOURSELF (DISPOSABLE CLONE ONLY)
-------------------------------------
Use Node 22 and npm. Obtain this directory from the public evidence branch or from
the vimgym-whitespace-pilot workflow artifact's handoff directory. In that directory:

  git clone https://github.com/oller/vimgym.git project
  git -C project checkout --detach e65d98ca48f6432779b6bf2cb677d1a9116400d8
  npx --yes pnpm@10.34.6 --dir project --filter vimsplain install --frozen-lockfile --ignore-scripts
  npm ci --ignore-scripts --no-audit --no-fund
  node pilot.mjs project pilot-output
  node collect-public.mjs pilot-output fresh-observed

When running from a Tautest repository clone, use npm --prefix <this-directory> ci
and node <this-directory>/pilot.mjs project pilot-output instead. These commands
were executed on Windows; the included branch-only workflow replays them on Linux.
Use a NEW output directory on every run; the helper refuses to overwrite evidence.
Expected final status: verified, baseline 372, withCandidate 373, before Survived,
after["Killed","Killed"]. A failed stage stops without claiming verification.

The script checks source SHA, exact installed versions and a clean tracked tree.
It runs baseline before mutations, analyzes the fresh report, temporarily adds the
test, validates it and verifies twice. It restores the original Stryker config and
removes its candidate in finally; it never edits production source. Untracked engine
cache/output files may remain in the disposable clone. No message or telemetry is sent.

Manual adaptations: package commands run from packages/vimsplain, not app root.
The engine is temporarily constrained to one worker, incremental=false, perTest,
MethodExpression only and source line 22. Existing Vitest config and TypeScript checker
are retained. verify changes break:null to 0 for this isolated verification, not the
project's committed gate. Source/config restoration is checked. No dependency upgrade
or package manifest change is made in Vimgym. The tool dependency is isolated here.
Install scripts were disabled to avoid app hooks/Supabase setup; no extra native build
was needed for the tested package. Windows warned that supabase.EXE was absent;
the relevant package's 372/373 tests and all engine stages still passed. This does not
validate the root app, Supabase or other operating-system/native integrations.

RETAIN OR APPLY THE TEST
------------------------
candidate.patch is a seven-line new test, intended for review, not automatically
submitted. From the project root, inspect and apply it using git apply with its
absolute path. Upstream AGENTS.md requires a branch/PR; do not commit directly to
main or bypass the maintainer's Changeset policy. No external PR has been opened.
The helper itself removes its temporary copy, so it does not leave a surprise test.

SMALL PUBLIC EVIDENCE
--------------------
observed/before.target.json, verify.target.json and verify-repeat.target.json are
portable subsets of the original engine reports: original source/mutant fields
and only attribution-relevant tests are retained, with IDs/statuses unchanged.
They are NOT the complete raw reports or a whole-suite mutation baseline.
The branch workflow artifact also retains complete raw reports, normal-test lists,
effective engine settings, request files, command logs and local verification files.
An optional offline first look after npm ci:
  node node_modules/tautest/dist/index.js analyze --from observed/before.target.json --runner vitest --report-dir offline-review
This command reads the supplied report only; it does not independently rerun tests.

Workflow: .github/workflows/pilot-vimgym-whitespace.yml
Public branch: https://github.com/canblmz1/tautest/tree/pilot/vimgym-whitespace
Run history: https://github.com/canblmz1/tautest/actions?query=branch%3Apilot%2Fvimgym-whitespace
Invitation: invitation-draft.txt (DRAFT ONLY; not sent or repeated).

ADOPTION TRACKING
-----------------
Our pilot and CI runs are not independent adoption. Maintainer execution, confirmed
benefit and reuse on another date/change remain separate, unconfirmed milestones.
Silence is not an abandonment reason. Actual independent usage is unknown.
Next request, if contact is later authorized: run this pilot, report the first error
or whether the explanation/verification helped, then try a different real change.
No merge, release, package publication, deployment or external comment occurred.
