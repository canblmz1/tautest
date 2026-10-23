# Second user-validation round

Started 22 October; continued 23 October 2026 UTC. The user explicitly asked to keep pursuing an accepting maintainer, so the bounded second round was brought forward from the roadmap's 28 October checkpoint. This changes the research timing, not the evidence standard or one-invitation-per-project limit.

## Existing invitations

[All 15 public threads](existing-outreach.json) were reread on 23 October: thirteen prospect projects and two upstream Stryker discussions. No explicit Tautest trial acceptance or independent run was found. Other people's task assignments, a mutation-wave closure and upstream runner bug confirmations are not Tautest use. Actual private/global usage and the reasons for silence remain unknown.

Two existing comments were [updated in place](existing-invitation-updates.json): [Vimgym](https://github.com/oller/vimgym/issues/35#issuecomment-6265939618) and [TriAD](https://github.com/Thang4869/TriAD-Backend/issues/145#issuecomment-6253934597). Their original comment IDs remain; no new invitation comment was added. Stale commands were replaced with a smaller report-only first step and published 2.1.5. Both imports were actually [checked](first-look-controls.json): input unchanged, score/status retained, no evaluated-threshold success claim, no engine or project test execution.

The Vimgym engine proof uses 2.1.5. The separate TriAD engine proof remains pinned to 2.1.4 and project `902dec9`, even though current main has advanced. The new report-only check does not relabel that engine run. Earlier complete local comment snapshots are retained for provenance.

Observable friction in the old invitations included several setup steps, mixed test-contribution and tool-trial requests, and historical version pins. These observations do not establish why recipients have not answered. The smaller ask is to try one report-review step and share the first result or setup error in the same issue.

## Qualification limits

- [Waypoint #551](https://github.com/toxroxmysox/Waypoint/issues/551): explicit Stryker/Vitest pure-logic need. The [published 2.1.5 pilot](../waypoint/pilot-2.1.5-2026-10-23/README.md) shows 15 original tests passing while trim removal survives; one proposed padded-timezone assertion passes original code and fails the exact replacement. Verification matches and kills the target twice. Whether padded stored timezones are a desired contract remains the maintainer's decision.
- [Destiny #181](https://github.com/agrorithms/destiny-public/issues/181): the owner already identified the blank-ID gap. The [published 2.1.5 pilot](../destiny/pilot-2.1.5-2026-10-23/README.md) confirms 31 existing tests pass the exact replacement, while one added public-output assertion catches it; exact-target verification succeeds twice. Its changed-line pipeline already shipped in #182; the proposed value is report context and candidate verification, not replacing that pipeline or claiming a new discovery.
- [Kstack #97](https://github.com/kstackhq/kstack/issues/97): [read-only published 2.1.5 scope planning](kstack-plan/evidence.json) selected 82 TypeScript/TSX lines in five production files on the pinned comparison. No tests, mutation engine, installation compatibility or speedup were measured. Contact is deferred; the contribution policy's requirement for human participation in entirely LLM-authored contributions was not treated as an explicit autonomous-comment exception. No user permission question or upstream code/spec PR was introduced.
- onury/notation: no relevant open issue found. No unsolicited marketing issue was created.
- folioneer/folioneer #65: the mutation sweep is Rust, despite a Vitest frontend; no demonstrated JS/TS need.
- nicklemmon/utils #47: Vitest 5 and a temporary runner patch remain outside the supported engine trial.
- trevclev0/terminal-quiz #326: owner PR #348 already addresses the triage work; its current artifact contains only HTML. An open issue title was insufficient evidence of another unmet need.
- hivecommons/rationguard #331: node:test/command-runner work, already claimed by its own automation. No parallel tool integration was offered.

## Counting

An explicit agreement to try Tautest is an acceptance, not a completed run. A maintainer-owned run, confirmed benefit, resulting test improvement and later-change reuse remain separate milestones. Our baselines, reports, patches and repeated verification do not increase independent-user counters. No new feature, release, paid action or telemetry is part of this round.

## Evidence and review

Both new pilots retain their source SHA, exact mutant fingerprint, test identities, original/candidate/replacement results, repeat verification and protected-file cleanup. The [current-head comparison](current-heads-2026-10-23.json) records the selected files separately from each full repository head: Waypoint still matches its pin; Destiny main advanced, but the five checked source/test/manifest/lock/config files have identical LF-normalized hashes. No complete experiment on Destiny's newer head is claimed.

Each pilot has a small generated report preview and an analyze-only sample containing all raw mutant records from its bounded source file. Only one short source line and relevant test names are included. Actual `npx --yes tautest@2.1.5 analyze` calls succeeded on both samples; no project installation or engine execution is needed for this first look. Samples cannot be used for verification; the full helper regenerates the complete report in a disposable pinned checkout.

Two separate agents built the experiments and reviewed each other's raw evidence, source hashes, ranges, actual assertion failures, test selection and cleanup. Both then reviewed the other pilot's final first-look sample and invitation. No blocking issue remained; reviewers did not rerun the engine or npx. Public immutable links must resolve before either invitation is sent. Until a posted invitation or a maintainer response is recorded below, neither is implied by this artifact.
