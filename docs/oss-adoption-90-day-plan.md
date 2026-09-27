# Plan: 90 days to test Tautest's OSS adoption

**Date:** 2026-09-27  
**Timebox:** 12 weeks  
**Product boundary:** JS/TS pull-request mutation feedback on top of StrykerJS; Vitest-first.

## Outcome, not vanity metrics

By day 90, aim for **3 independent external repositories** that keep Tautest in CI across at least **3 separate PRs each**, and **2 test improvements accepted by their maintainers** because of a Tautest finding. The maintainer's own repositories do not count. Stars, downloads and one-off installs are secondary signals. Count public workflow runs or maintainer-shared results only; add no default telemetry.

The working hypothesis is that a trustworthy, reviewable *patch mutation finding* is worth the installation and review cost. It is not that Tautest's mutation engine is faster than Stryker's: Tautest uses Stryker. Stryker already supports line-range targeting and incremental runs, so compare against those modes honestly.

The first users to pursue are maintainers of active JS/TS libraries already using Vitest and GitHub Actions, with green tests but limited time for full-repository mutation runs. Do not pitch Tautest to every developer. The possible moat is a trusted, low-friction PR decision loop and accumulated evidence, not a proprietary mutation algorithm or a static AI prompt.

Starting evidence: on two real `unjs/ohash` PRs, the published 2.0.0 release produced useful findings in roughly 12-29 seconds. It also left `.stryker-tmp` test copies that broke a later plain Vitest run, needed explicit exclusion of a bundle-size test in one repository, called an 87.5% run with a genuine survivor `STRONG` under the default 60% gate, and reported several functionally equivalent mutants as missing behavior. These are adoption blockers, not reasons for a new engine.

## Sprint 1 - Trust before reach (weeks 1-2)

**Demo:** A clean external Vitest checkout can run normal tests, Tautest, then normal tests again. A failing Stryker dry run leaves the project test command usable. Reports never state that every survivor necessarily represents changed observable behavior.

1. **Isolate/clean Stryker sandboxes.** In `packages/core/src/stryker/config-generator.ts`, `packages/core/src/stryker/runner.ts` and their tests, put temporary sandboxes outside ordinary test discovery or clean only the exact Tautest-owned path in `finally`. Dependency: none. Validate success and failure paths on the `ohash` fixture: plain `vitest run` after each run must find the original tests only; the worktree must not gain `.stryker-tmp/`.
2. **Explain instrumented dry-run failures, never silently skip tests.** In `packages/cli/src/commands/run.ts`, `packages/cli/src/lib/doctor.ts` and `docs/TROUBLESHOOTING.md`, surface the failing test and an explicit recipe for an opt-in mutation-only Vitest config when instrumentation breaks bundle/performance assertions. Dependency: task 1 only for clean reproduction. Validate with a bundle-size fixture that still runs the full normal suite.
3. **Separate threshold pass from finding status.** In `packages/core/src/report/{insights,terminal,markdown,json}.ts`, `packages/github-action/src/{summary,pr-comment}.ts`, and tests, say "threshold passed; N survivors need review" when appropriate. Remove the generic claim that a survivor always changes observable behavior. Keep raw score and existing exit-code compatibility; document an advisory first week for new CI users in `README.md` and `docs/GITHUB_ACTION.md`. Dependency: none. Validate a one-survivor/87.5% fixture and an equivalent-mutant fixture. Do not silently discard mutants or change the default gate in a patch release.
4. **Preserve the Vitest 5 safety stop.** Keep the compatibility matrix and `doctor`/`run` guard until the upstream runner is fixed and a packed-release matrix passes. Dependency: none. Validate 4.x works and 5.x fails loudly, never with a misleading score.

## Sprint 2 - Reproducible proof and onboarding (weeks 3-4)

**Demo:** A stranger can reproduce a short benchmark table and get a first report from one copy-paste recipe in under 15 minutes, excluding the host project's existing dependency install/build time.

5. **Create a frozen external-PR corpus.** In `scripts/` and a single new validation report under `docs/`, record exact base/head SHAs for at least 10 PRs from at least 5 non-owned JS/TS repositories, including Vitest, one Jest beta path, small and large diffs, and known real/equivalent survivors. Dependency: sprint 1. Validate each PR with normal tests, Tautest, and direct full-file Stryker; record setup time, mutation runtime, scope agreement, findings, false alarms and required configuration. Never cherry-pick only green runs.
6. **Benchmark the actual alternative.** Add direct Stryker line-range/incremental comparisons to the corpus rather than comparing only with full-repository scans. Dependency: task 5. Publish the median and slow tail (p90) and cases where Tautest adds no value. If scoped runs routinely exceed the team's CI budget, make the Action advisory or opt-in for those projects.
7. **Make one golden onboarding path.** In `README.md`, `docs/QUICKSTART.md` and `docs/GITHUB_ACTION.md`, keep one Vitest 4 + Node 22+ recipe and a short list of known exceptions. Dependency: tasks 1-6. Validate by a fresh install performed by someone other than the maintainer; log each point of hesitation. Do not bulk-rewrite old docs.

## Sprint 3 - Earn distribution (weeks 5-8)

**Demo:** At least five opt-in external maintainers have tried the Action or CLI, and their objections are recorded. At least one evidence-backed public post is published and discussed without promotional PR spam.

8. **Recruit ten opt-in pilot conversations.** Track repository, runner version, install success, first report, repeat PR usage, acted-on findings, and rejection reason in a small private/consented log; publish only aggregate counts. Dependency: task 7. Ask for permission before changing anyone's CI or posting a promotional PR. Respond to setup issues within 48 hours when possible.
9. **Publish two technical stories, not a launch blast.** First: the Vitest 5/Stryker zero-test failure, clearly crediting upstream and explaining Tautest's guard. Second: a real missed behavior exposed by mutation testing (for example the `ufo`/`ohash` case), including a runnable before/after test. Put drafts in `docs/` only after reproduction and maintainer-sensitive review. Dependency: task 5. Measure qualified trial requests and follow-up, not impressions.
10. **Contribute upstream where the fault lives.** Validate the current state of Stryker issue #6210 and offer a minimal Vitest 5 runner fix or regression test if maintainers welcome it. Dependency: task 4. Timebox this to about one engineering week; do not promise Vitest 5 support in Tautest before an upstream release passes the matrix.
11. **Fix the two most common pilot blockers.** Pick from task 8's actual reports, with a regression fixture and docs recipe for each. Dependency: task 8. Defer Marketplace packaging unless pilots explicitly cite the subdirectory Action path as an install/discovery obstacle; GitHub Marketplace requires root action metadata or a separate action repository.

## Sprint 4 - Prove repeat value or narrow (weeks 9-12)

**Demo:** A pilot maintainer can point to a specific PR where Tautest changed a test decision, or the team can confidently explain why the standalone workflow did not earn continued investment.

12. **Evaluate the fix prompt against raw Stryker output.** On 8-10 corpus findings, randomize the order and give the same coding agent and time budget either Tautest's prompt or raw Stryker JSON plus source context. Count *tests that pass on original and kill the target mutant*, time, and invalid/overfitted tests. Dependency: task 5. If there is no clear lift, stop marketing prompts as differentiation.
13. **Prototype verification only if pilots ask for it.** A disposable-worktree command may check that a proposed *test-only* change passes normal tests and kills a selected mutant. No automatic PR commits, source edits, secrets, or LLM API requirement. Dependency: tasks 8 and 12. Validate against known real and equivalent mutants; ship only if it saves real review time.
14. **Make the day-90 decision.** Dependency: tasks 8-13. Continue as a standalone OSS product if the north-star threshold is met and support load is sustainable. If 1-2 repositories repeat but setup is expensive, narrow to the proven runner/workflow. If no independent repeat use after ten genuine trials, preserve the code but stop feature expansion and offer the useful pieces as a Stryker recipe, plugin or Action. Publish an honest retrospective.

## Guardrails and rollback

- Do not build a custom mutation engine, broad equivalent-mutant AI filter, dashboard, Python/Java execution, or auto-commit bot during this timebox.
- No survivor is automatically "a missing test": it may be equivalent or intentionally accepted. Keep raw Stryker status visible and use Stryker's documented disable/ignore mechanisms with a reason after review, not blanket mutator suppression.
- Keep test changes separate from production changes in external repositories. Do not add silent telemetry or require elevated GitHub permissions for the core CLI.
- Each code task gets unit tests, a packed-package smoke, and at least one external fixture. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and the compatibility matrix before release.
- If a new policy or report field would break existing users, keep the current behavior available, version the contract, and provide a migration note. Revert a faulty release through a new patch release; do not rewrite published npm versions or move an existing user's pinned SHA.
