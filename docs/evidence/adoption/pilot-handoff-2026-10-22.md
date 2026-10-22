# R02/R03: existing pilot handoff refresh

Checked 2026-10-22 (UTC); exact query time, public asset metadata and SHA-256 values are in `pilot-refresh.json`. This refresh used GitHub API reads and local evidence reads. It did not install packages, rerun tests/mutants, send an invitation, or establish independent adoption.

## Current status

| Project | Current main | Last invitation | Other replies after invitation |
| --- | --- | --- | --- |
| [Vimgym #35](https://github.com/oller/vimgym/issues/35) | `e65d98ca48f6432779b6bf2cb677d1a9116400d8` | [2026-10-19](https://github.com/oller/vimgym/issues/35#issuecomment-6265939618) | None found |
| [TriAD #145](https://github.com/Thang4869/TriAD-Backend/issues/145) | `902dec9b1178e84dc927499705b75f083a95dd90` | [2026-10-18](https://github.com/Thang4869/TriAD-Backend/issues/145#issuecomment-6253934597) | None found |

Both issues remain open. Confirmed independent trial / benefit / resulting test improvement / reuse: **0 / 0 / 0 / 0** in these inspected public threads. Actual independent usage is **unknown**. Our pilot executions and repeated `verify` calls are not user reuse.

Open-PR refresh: Vimgym has only dependency update PRs [#43](https://github.com/oller/vimgym/pull/43) and [#44](https://github.com/oller/vimgym/pull/44); TriAD has no open PRs. No separate new mutation/test-fix PR was found in this list.

## First handoff: Vimgym

### Current published report-review path: verified 2.1.4

On 2026-10-22, Windows / Node 22.23.2, the separately installed registry CLI at `clean-install-v2/project/node_modules/tautest/dist/index.js` reported **2.1.4**, with core 2.1.4. Two immutable public input reports were freshly downloaded and analyzed into new directories. Both commands exited 0; input hashes and raw status counts were preserved. Neither output says “Threshold passed”; both explicitly say no threshold was evaluated and retain the imported-report notice.

| Input | Observed raw data | Review groups | CLI time |
| --- | --- | --- | --- |
| Vimgym before.target.json | 1 Survived, score 0 | 1 | 339 ms |
| TriAD before.mutation.json | 13 Killed / 3 Survived / 1 NoCoverage, score 76.47058823529412 | 3 | 384 ms |

The TriAD NoCoverage explanation asks to verify test selection, configuration and attribution before adding tests. Invocation times exclude downloads/install and are not a speed comparison or maintainer time-to-value measurement. Full command arrays, package integrity, CLI/lock/input hashes, output and limitations: [`current-report-review/evidence.json`](current-report-review/evidence.json). This was our report-only check, not independent adoption or a fresh engine run.

For a current report-only first look in a new directory, use the existing immutable URLs with published **2.1.4**:

```sh
curl -fL https://raw.githubusercontent.com/canblmz1/tautest/fd1b777868e945070df0ed7fc6bbcd27bc1f9521/docs/evidence/adoption/vimsplain/pilot-2026-10-21/observed/before.target.json -o vimgym-before.target.json
npx --yes tautest@2.1.4 analyze --from vimgym-before.target.json --runner vitest --report-dir vimgym-review-214
curl -fL https://raw.githubusercontent.com/canblmz1/tautest/ef34753bfdb85973eec73c2a9b9f6b0df8229d04/docs/evidence/adoption/triad-address/before.mutation.json -o triad-before.mutation.json
npx --yes tautest@2.1.4 analyze --from triad-before.mutation.json --runner vitest --report-dir triad-review-214
```

Use `curl.exe` in Windows PowerShell. The executed commands used the already-installed 2.1.4 CLI via `node <full-cli-path>`, rather than performing a new npx install. The npx spelling above is the equivalent entry point; a new npx fetch was not measured. **Historical engine proof dependencies below remain unchanged.**

[Immutable, public handoff directory](https://github.com/canblmz1/tautest/tree/fd1b777868e945070df0ed7fc6bbcd27bc1f9521/docs/evidence/adoption/vimsplain/pilot-2026-10-21) is accessible. Its README, package lock, helper scripts, seven-line test patch, raw target subsets and evidence are present. Current project main is exactly the recorded project SHA, so this is the strongest existing portable pilot.

Recorded result, not newly rerun: Windows / Node 22.23.2; project pnpm 10.34.6, Vitest 4.1.11, Stryker core/runner/checker 10.0.0; published Tautest 2.1.3. Original suite 372 passed; candidate suite 373 passed. `cmd.trim()` -> `cmd` at `src/handlers/command.ts:22:19-22:29` survived 13 executed tests; the new public-behavior assertion killed the identical source/location/mutator/replacement target in two verify runs. The failing assertion expected `write file` rather than the generic command explanation.

The current source's GitHub LF hash matches the recorded normalized source hash. The lockfile's GitHub LF hash (`b387b802...`) differs from the recorded Windows raw hash (`955c90b4...`); explicitly converting the same GitHub blob to CRLF produces exactly the recorded hash. This is a verified line-ending difference, not evidence of dependency drift. Full hashes are in `pilot-refresh.json`.

### Smallest report-only inspection

Node 22 and npm; run in an empty directory. This uses the historical published version deliberately to reproduce the recorded evidence:

```sh
curl -fL https://raw.githubusercontent.com/canblmz1/tautest/fd1b777868e945070df0ed7fc6bbcd27bc1f9521/docs/evidence/adoption/vimsplain/pilot-2026-10-21/observed/before.target.json -o before.target.json
npx --yes tautest@2.1.3 analyze --from before.target.json --runner vitest --report-dir offline-review
```

On Windows PowerShell use `curl.exe` for the first command. The expected view contains one Survived target with `cmd.trim()`, replacement `cmd`, and recorded covering-test names. This reads evidence; it does not execute tests or evaluate a new gate. **Known historical limitation:** 2.1.3 can print the incorrect generic “Threshold passed” advisory for an imported report with no evaluated threshold. The main fix from PR #50 is separate; do not interpret this text as a successful gate or current patch quality. A fresh product trial should use a separately verified current published version; no new publication is assumed here.

### Fresh historical engine reproduction

Use fresh directory names and Node 22; do not run in a maintainer's existing checkout. These commands are assembled from the already executed pilot recipe and inspected scripts, but were not rerun in this refresh:

```sh
git clone https://github.com/canblmz1/tautest.git vimgym-pilot-tools
git -C vimgym-pilot-tools checkout --detach fd1b777868e945070df0ed7fc6bbcd27bc1f9521
git clone https://github.com/oller/vimgym.git vimgym-pilot-project
git -C vimgym-pilot-project checkout --detach e65d98ca48f6432779b6bf2cb677d1a9116400d8
npx --yes pnpm@10.34.6 --dir vimgym-pilot-project --filter vimsplain install --frozen-lockfile --ignore-scripts
npm --prefix vimgym-pilot-tools/docs/evidence/adoption/vimsplain/pilot-2026-10-21 ci --ignore-scripts --no-audit --no-fund
node vimgym-pilot-tools/docs/evidence/adoption/vimsplain/pilot-2026-10-21/pilot.mjs vimgym-pilot-project vimgym-fresh-output
node vimgym-pilot-tools/docs/evidence/adoption/vimsplain/pilot-2026-10-21/collect-public.mjs vimgym-fresh-output vimgym-fresh-observed
```

Expected final evidence: baseline 372, candidate 373, before Survived, after Killed/Killed, verify `verified`. Each new output directory must not exist. The helper is pinned to Tautest 2.1.3 and Node 22; silently replacing dependencies is not the same reproduction.

Limitations: only `packages/vimsplain`, one artificially narrowed target, one worker, incremental off. The source line 22 target is **old baseline debt outside the selected recent diff** (command.ts ranges 33-44 and 57-63). It proves imported review and exact-target candidate verification, not discovery on an active PR. The helper temporarily changes local engine config and adds a test, then restores/removes them; engine caches/output can remain in the disposable clone. Root React/Supabase application behavior is outside scope. A repeat on another change and a maintainer-run benefit statement are still missing.

Next concrete step: accept the first maintainer-owned report-only run or first setup error through the existing invitation. Do not resend the invitation. The current 2.1.4 report-import path is now checked separately; a fresh engine pilot with 2.1.4 still needs separate validation and must retain its identity separately from the historical lockfile.

## Second handoff: TriAD

[Immutable public evidence](https://github.com/canblmz1/tautest/tree/ef34753bfdb85973eec73c2a9b9f6b0df8229d04/docs/evidence/adoption/triad-address) and [pinned proof tools](https://github.com/canblmz1/tautest/tree/ef34753bfdb85973eec73c2a9b9f6b0df8229d04/scripts/adoption-proof/triad) are accessible. They contain before/after reports, evidence, candidate tests, project license, helper, package manifest and pnpm lock.

The proof project SHA is `7e41358c9936186d5469437584845335ec255ad1`; current main is newer. GitHub file content SHA-256 comparisons show **the Address source, existing value-object test file, and package-lock are byte-for-byte identical** between those two SHAs. This narrows staleness risk; it does not establish current config/runtime equivalence or a passing current-main test suite. The existing helper intentionally refuses any project SHA other than the old pinned SHA.

Recorded source SHA-256: `a8148a5f847f43af2a0f9c65d6139fd9735a802d423ceba3ac4a211c2b1101e9`. The target at line 6 columns 36-59 is EqualityOperator replacement `normalized.length >= 500`. The existing three selected value-object tests missed rejection of a valid 500-character normalized address. Two test cases accept 500 after trimming and reject 501. Original 3 tests -> 5 passing tests; file-wide 13 Killed / 3 Survived / 1 NoCoverage -> 16 / 0 / 1. Exact target verification was `verified`; the remaining NoCoverage is retained. Linux / Node 22.23.3, Vitest 4.1.11, Stryker 10.0.0, Tautest 2.1.0. [Historical successful CI](https://github.com/canblmz1/tautest/actions/runs/39157061899).

### Smallest report-only inspection

```sh
curl -fL https://raw.githubusercontent.com/canblmz1/tautest/ef34753bfdb85973eec73c2a9b9f6b0df8229d04/docs/evidence/adoption/triad-address/before.mutation.json -o triad-before.mutation.json
npx --yes tautest@2.1.0 analyze --from triad-before.mutation.json --runner vitest --report-dir triad-offline-review
```

Use `curl.exe` on Windows PowerShell. This historical version predates the later source-span, NoCoverage guidance and unevaluated-threshold fixes. Raw data remain useful, but its prose must not be treated as the current product or a new quality-gate assessment. Analyze runs no project tests.

### Fresh historical engine reproduction

Node 22; fresh disposable checkout only. These are explicit versions/paths from the already executed Linux workflow, not a claim of a new run:

```sh
git clone https://github.com/canblmz1/tautest.git triad-pilot-tools
git -C triad-pilot-tools checkout --detach ef34753bfdb85973eec73c2a9b9f6b0df8229d04
git clone https://github.com/Thang4869/TriAD-Backend.git triad-pilot-project
git -C triad-pilot-project checkout --detach 7e41358c9936186d5469437584845335ec255ad1
npm --prefix triad-pilot-project ci --ignore-scripts --no-audit --no-fund
npx --yes pnpm@10.33.1 --dir triad-pilot-tools/scripts/adoption-proof/triad install --frozen-lockfile --ignore-scripts
node -e "require('node:fs').copyFileSync('triad-pilot-tools/scripts/adoption-proof/triad/address.test.ts','triad-pilot-project/tests/unit/shared/value-objects/address.test.ts')"
node triad-pilot-tools/scripts/adoption-proof/triad/prove-address.mjs triad-pilot-project
```

Expected `project/.tautest/adoption-proof/evidence.json` counts are given above (actual project directory here is `triad-pilot-project`). The script writes local Stryker/Vitest pilot config and output and does not promise to restore those files; use the disposable clone only. It does not mutate production source or project manifests, and checks source bytes. The test selects the existing value-object file plus the new candidate, not PostgreSQL/Redis integration tests.

Next concrete step: before describing this as a current-main engine trial, validate current unit config and normal selected tests, then refresh the controlled proof's SHA guard in a separate evidence-only change. Do not run the old helper against a new SHA by simply removing its guard. No new external PR or repeated invitation is needed for this refresh.

## Evidence and interpretation

No user reason for silence is known. An unanswered invitation is not a refusal or a setup failure. No runtime reduction, faster time-to-value, adoption or repeat-use claim is made. Stryker generates/executes mutants; Tautest's demonstrated contribution here is report context and exact-candidate verification. No production worktree was changed by this refresh.
