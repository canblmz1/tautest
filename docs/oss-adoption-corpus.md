# OSS Adoption Corpus

Sprint 2, task 5-6 of [docs/oss-adoption-90-day-plan.md](oss-adoption-90-day-plan.md): a frozen, non-owned external-PR corpus comparing Tautest against a normal test run and against direct Stryker scoped to the same `mutate` pattern Tautest computed. Every row below is a real run recorded as-is, including failures; nothing is cherry-picked.

Reproduce any row with `scripts/oss-adoption-corpus-run.mjs`:

```bash
node scripts/oss-adoption-corpus-run.mjs \
  --repo=https://github.com/unjs/ohash.git --pr=196 \
  --base=2c6e231ccfc229ab90a3e026635984f1ccd89b1d \
  --head=a65d622c4c390061baf408b0ecdf4d5031753c69 \
  --runner=vitest --package-manager=pnpm --build
```

`--build` runs `<package-manager> run build` — the target commit's own build script through its own locally installed toolchain. Do not hardcode a specific build tool: see the ohash#151 entry below for what went wrong when this script used to do that.

## Status

**4 repositories attempted, 3 usable (ohash, defu, destr), 4 merged PRs, 5 recorded runs.** One attempted entry (ohash#195) failed before any measurement because GitHub no longer serves its recorded base commit — a real corpus-methodology finding, not a Tautest or Stryker issue; see below. The 90-day plan's target is at least 10 PRs across at least 5 non-owned repositories, including a Jest beta path and a large diff. This file is not yet large enough to inform the day-90 decision on its own; still missing: a Jest repo, 2+ more Vitest repos, and same-repo history further back to stress older commits.

## unjs/ohash#196 — `fix(utils): diff falsy primitive values`

Vitest, pnpm. Base `2c6e231c`, head `a65d622c`. 1 changed production line (`src/utils/diff.ts:46`), 2 changed files total (source + test). Requires a build step first: `src/hash.ts` imports `ohash/crypto`, a self-reference that resolves through the package's own `exports` to `dist/`, so without a build `test/hash.test.ts`, `test/serialize.test.ts`, and `test/bundle.test.ts` all fail to load — a pre-existing environment requirement of the repo, unrelated to Tautest or Stryker.

| Step | Result |
| --- | --- |
| `pnpm install` | ok |
| `pnpm run build` (`obuild` at this commit) | ok |
| Normal `vitest run` | **75 passed** |
| Tautest (`tautest run --base 2c6e231c`) | 8 mutants, **5 killed, 3 timeout, 0 survived**, STRONG 100% (threshold 60%) |
| Tautest runtime | first run in a fresh clone: 20.8s; second run, same state: 11.7s |
| Direct Stryker, same `mutate: ["src/utils/diff.ts:46-46"]` and `plugins: ["@stryker-mutator/vitest-runner"]` | 8 mutants, **5 killed, 3 timeout, 0 survived** — identical mutant-level result to Tautest |
| Direct Stryker runtime | 9.7s on the first measurement; independent reruns of this exact command by two reviewers measured 17.3-23.3s wall time on the same PR |

**Scope agreement:** exact — Tautest's computed `mutate` pattern reproduced the identical kill/timeout/survive breakdown under raw Stryker in every rerun, including both independent reviewer reruns. No false inclusion or exclusion in this case.

**Required manual config raw Stryker did not warn about:** the direct-Stryker config needed `plugins: ["@stryker-mutator/vitest-runner"]` explicitly, or Stryker fails with `Cannot find TestRunner plugin "vitest"`. Tautest's config generator (`packages/core/src/stryker/config-generator.ts`) wires this automatically. Small, but a real first-run difference between "use Tautest" and "hand-roll a scoped `stryker.config.json`".

### Induced regression (same PR, `it.skip` on the new test)

Skipping the PR's own new test (`test/utils.test.ts` → "formats falsy primitive changes", the test that protects the exact line changed):

- Normal `vitest run`: still **74 passed, 1 skipped** — nothing here would fail a normal CI job.
- Tautest: 8 mutants, **4 killed, 3 timeout, 1 survived**, verdict **STRONG 87.50%** (threshold 60%), runtime 10.1s.
- Report line, confirmed live: *"Threshold passed; 1 surviving mutant still needs review before treating this patch as fully covered. A survivor is not automatically a missing test — it can be an equivalent mutant with no observable behavior change."*
- `.stryker-tmp/tautest` was empty after both this and the passing run, confirming the sandbox-cleanup fix (`packages/core/src/stryker/runner.ts`) holds on the exact case that originally surfaced the leftover-sandbox problem.

## unjs/defu#156 — `fix: prevent prototype pollution via __proto__`

Vitest, pnpm, no build step needed. Base `89df6bb1`, head `5767f6f0`. 1 changed production line.

| Step | Result |
| --- | --- |
| `pnpm install` | ok |
| Normal `vitest run` | passed |
| Tautest | 1 mutant, **1 killed**, STRONG 100% (threshold 60%), 8.65s |
| Direct Stryker, same `mutate: ["src/defu.ts:10-10"]` | 1 mutant, **1 killed** — identical to Tautest | 8.47s |

Matches the README's own "Validated on real pull requests" claim for this PR (STRONG 100%, 1 mutant) with a fresh, independently reproduced run. Tautest/direct-Stryker timing near-identical (8.65s vs 8.47s) — no measurable overhead in this run.

## unjs/destr#136 — `perf: faster plain string and known value checks`

Vitest, pnpm, no build step needed. Base `7b506be3`, head `50d6c82b`. Multi-line perf change across two ranges.

| Step | Result |
| --- | --- |
| `pnpm install` | ok |
| Normal `vitest run` | passed |
| Tautest | 39 mutants, **30 killed, 9 survived**, MIXED 76.92% (threshold 60%), 13.8s |
| Direct Stryker, same `mutate` (`src/index.ts:36-42`, `src/index.ts:47-68`) | 39 mutants, **30 killed, 9 survived** — identical, same survivor positions | 14.1s |

Matches the README's own claim for this PR (39 mutants, MIXED 77%, 9 survivors) with a fresh, independently reproduced run, including the exact same 9 survivor positions. Tautest/direct-Stryker timing near-identical (13.8s vs 14.1s).

## unjs/ohash#151 — `perf(serialize): optimized sorting algorithm`

Vitest, pnpm. Base `d7f7f9da`, head `d76fb98e`. 88/-20 lines, 4 changed files — the largest entry so far, and the one that surfaced two real, useful failures before producing a clean measurement.

**Failure 1 — hardcoding a build tool broke this older commit.** The corpus script used to run `npx obuild` unconditionally for ohash (copied from the #196 entry). At this earlier commit, ohash's own `package.json` `build` script was `unbuild`, not `obuild` — the repo switched build tools between this PR and #196. `npx obuild` ignored that and fetched the newest `obuild` from the registry, which no longer matched this commit's config shape (`TypeError: rawEntries.map is not a function`). **Fix applied to the script:** `--build` now always runs `<package-manager> run build`, i.e. the commit's own build script through its own locally installed toolchain, instead of a hardcoded tool name. See `scripts/oss-adoption-corpus-run.mjs`.

**Failure 2 — the exact bundle-size dry-run failure the Sprint-1 fix targets, happening unprompted on a different PR.** After fixing the build step, `tautest run` failed with exit 12:

```
ERROR DryRunExecutor One or more tests failed in the initial test run:
	bundle size serialize
		expected 5354 to be less than or equal to 3000
ERROR Stryker There were failed tests in the initial test run.

Error: Stryker's initial test run failed before mutation testing could start. [...]
First confirm the test actually fails on the unmutated code too [...]
```

The normal `vitest run` step (recorded above the failure) had already passed, including this same bundle-size test — confirming it was instrumentation, not a real regression, exactly as the message says to check. `.stryker-tmp` was still fully removed after this failure. Applying the documented recipe ([Instrumentation Breaks a Non-Behavioral Test](TROUBLESHOOTING.md#instrumentation-breaks-a-non-behavioral-test), the no-existing-config variant) resolved it:

| Step | Result |
| --- | --- |
| `pnpm install` | ok |
| `pnpm run build` (`unbuild` at this commit) | ok |
| Normal `vitest run` | passed |
| Tautest, with `vitest.stryker.config.ts` excluding `test/bundle.test.ts` | 79 mutants, **47 killed, 6 timeout, 26 survived**, MIXED 67.09% (threshold 60%), runtime 20.77s |
| Direct Stryker, same 9 `mutate` ranges and the same excluded-test config | 79 mutants, **47 killed, 6 timeout, 26 survived** — identical to Tautest | runtime 20.22s |

**Overhead, cleanly measured this time:** 20.77s vs 20.22s — under 3%, effectively noise. Combined with defu (8.65s vs 8.47s) and destr (13.8s vs 14.1s), the three PRs where Tautest and direct Stryker were run back-to-back on the same machine all show near-zero overhead. The earlier ohash#196 entry's larger, inconsistent gap (and the two reviewers' 17-23s reruns of the same command) looks like machine/network noise from that specific measurement, not a real per-run cost — this is now a supported conclusion from repeated same-machine measurements, not a single-sample guess.

## Attempted and failed before any measurement: unjs/ohash#195

`perf(diff): fused single-pass traversal`, the large (259/-29 line) diff originally slated as the large-diff entry. GitHub's PR API reported `base.sha: a9e658cb8f895c83890a4dca4296440773f14dc4`, but `git cat-file -e` on a fresh full clone fails, and `gh api repos/unjs/ohash/commits/a9e658cb...` returns 404 — **the commit no longer exists in the repository.** This is a real, generalizable corpus-methodology risk: a PR API's recorded `base.sha` is a point-in-time value and is not guaranteed to remain reachable indefinitely (history rewrites, force-pushes, or garbage collection can prune it), even for a merged PR on an active repo. The corpus script's frozen-SHA check caught this correctly (loud `status: "error"`, non-zero exit) instead of silently measuring nothing or a wrong commit. Replaced with ohash#151 above for the large-diff slot; #195 is dropped from the target list rather than worked around with a guessed nearby commit, since that would defeat the point of recording exact SHAs.

## Next entries needed

- A Jest beta repo (none attempted yet).
- 2+ more non-owned Vitest repos beyond the unjs org, for diversity beyond one maintainer's style/tooling.
- A diff larger than ohash#151's 88/-20 lines.
