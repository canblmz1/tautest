# User validation progress

This is a running index. Dated checkpoint documents remain historical snapshots; later merges and trials do not change what had happened at their recorded time.

## 22 October 2026 continuation

- The user delegated merge decisions to the main assistant. Product and evidence PRs are reviewed and checked before merge; this does not waive the existing separate release/publication approval boundary.
- [PR #55](https://github.com/canblmz1/tautest/pull/55) merged at 19:38:15 UTC as `b66fbd0ded72530572c256f6f62743bc2b8f228e`. Its reviewed head `5eb249be04221e1a838b78853bc426eae661b136` had 13/13 successful checks. The subsequent [main Release validation](https://github.com/canblmz1/tautest/actions/runs/39841839214) passed and updated the separate 2.1.5 version PR. The runner-discovery fix is in main; no new package publication is claimed.
- [PR #54](https://github.com/canblmz1/tautest/pull/54) is a generated version-only candidate. Its automatic workflow approvals were granted for checks on the observed candidate head; this grants CI execution, not a merge or npm publication. Final version validation and publication authorization remain separate steps.
- R01: new-project published 2.1.4 installation through `analyze` passed; its verification blocker is fixed in main. README report-review and Action source pins are updated to the already-published 2.1.4 source, rather than describing an unreleased fix as installed.
- R02: [the ledger](validation-ledger.json) records independent use separately from maintainer controls and downloads.
- R03: [current report-only imports](current-report-review-2026-10-22.json) passed for Vimgym and TriAD. A new disposable current-source TriAD unit baseline/pilot is in progress; the old SHA guard has not been removed or reused silently.
- R04/R07/R08: independent maintainer trial, benefit and later-change reuse remain unconfirmed. Existing invitations have not been repeated. No automatic telemetry is added.
- R05: the bounded fallback checkpoint remains 28 October. No broad candidate search or additional invitation is being used to fill a numeric target early.

The published first-look report path and the historical/full pilot recipes are distinguished in the [handoff](pilot-handoff-2026-10-22.md). The next adoption milestone is 5 November: two maintainer-owned runs and one confirmed benefit. These are learning criteria, not promised results.
