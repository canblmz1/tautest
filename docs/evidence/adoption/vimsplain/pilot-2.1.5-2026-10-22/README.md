# Vimgym: published Tautest 2.1.5 whitespace pilot

Need: [Vimgym #35](https://github.com/oller/vimgym/issues/35). The current main SHA was checked again on 2026-10-22 and remains **e65d98ca48f6432779b6bf2cb677d1a9116400d8**. Scope: `packages/vimsplain`, one existing whitespace survivor, one seven-line test. The historical published2.1.3 pilot and its lockfile are unchanged.

This is **old baseline report debt**, not a new discovery or a finding on an active source-changing PR. A fresh read-only diff against historical base `2aca9c37c6a6cc9997af16c1cd48ac365f5f8307` has command.ts new-side ranges **33-44 and 57-63**; the line22 target is outside them. See `scope-context.json` and `historical-source-diff.patch`.

## Actual result

Windows / Node **22.23.2**. Project pnpm **10.34.6**, existing project Vitest **4.1.11**, Stryker core/runner/TypeScript checker **10.0.0**. Separate tool directory: pnpm **10.33.1**, registry **tautest and @tautest/core 2.1.5**. This did not execute a local candidate or relabel the old2.1.3 tool.

| Controlled check | Observed result |
| --- | --- |
| Unmodified full vimsplain suite, twice before mutation | 372/372 and 372/372 pass |
| One selected MethodExpression on line22 | Survived, testsCompleted 13, 13 covering tests recorded |
| New candidate on original source | 373/373 pass |
| Exact replacement applied manually, candidate absent | Original 372/372 pass |
| Same manual replacement, candidate present | 372 pass / 1 expected behavior assertion failure |
| Original source restored, published2.1.5 verify | verified / Killed |
| Second fresh verify | verified / same target Killed |
| Cleanup | All 25 protected tracked package/root files unchanged; tracked tree clean; temporary candidate removed |

The existing suite has four files: coverage 151, fuzz 3, integration 5, vimsplain 213. These are package tests, including its local parser integration tests, not the root app or a Supabase integration claim. The single-target imported score is 0 before the test. It is not a package/repository score or new quality-gate assessment.

The real public behavior is `explainSequence(': w [Enter]')` explaining **write file**. The handler deliberately trims the command before matching known commands. Removing trim returns the generic `run ex command ' w '` explanation, an observable difference. The new test asserts that explanation only; it does not assert internal implementation details or force an equivalent mutant to die.

```text
file: src/handlers/command.ts (relative to packages/vimsplain)
source SHA-256 (LF): 35fbbe1d2eac420e77d4634aa83f959770d88c4283a63c16a305db5117a2d3f5
inclusive start: line22, column19
exclusive end: line22, column29
mutator: MethodExpression
original: cmd.trim()
replacement: cmd
```

Numeric mutant ID0 is supplemented by the source hash, file, positions, mutator and replacement. Both verify reports match this fingerprint. Both recorded killers name `tests/tautest-ex-command-whitespace.test.ts`, `explains a whitespace-padded ex write command as write file`; test ID0 is recorded in both runs. The raw assertion reason is `expected 'run ex command \' w \'' to be 'write file'`. Compilation errors, infrastructure failures and timeouts were not counted as kills. NoCoverage was not observed.

Stryker creates and executes the mutant. Tautest's demonstrated contribution is the imported source/test context and exact-candidate verification, not a new mutation engine or measured speedup. Technical repeatability is not maintainer reuse. Confirmed independent trial/benefit/reuse remain zero; actual independent use is unknown.

## Check the published package identity

`registry-identity.json` records fresh public2.1.5 tarball downloads and SHA-512 integrity validation. The downloaded CLI `dist/index.js`, separate `dist/stryker-worker.js`, and the actual CLI-resolved core `dist/index.js` match the installed/executed files **byte-for-byte**. Both registry integrity strings also match `tools/pnpm-lock.yaml`. The actual `--version` output was2.1.5; the resolved core manifest was2.1.5. Cached package installation is not described as a measured cold install.

## Run it in a disposable copy

Copy this evidence directory to a new scratch location outside a working project. Use Node22 and the pinned pnpm versions; keep existing historical evidence untouched. From this directory:

```sh
git clone https://github.com/oller/vimgym.git project
git -C project checkout --detach e65d98ca48f6432779b6bf2cb677d1a9116400d8
cd project
pnpm --version
pnpm --filter vimsplain install --frozen-lockfile --ignore-scripts
cd ..
cd tools
pnpm --version
pnpm install --frozen-lockfile --ignore-scripts
cd ..
node baseline-current.mjs project fresh-baseline.json
node prove-whitespace-215.mjs project fresh-results fresh-baseline.json
```

The project command should report pnpm10.34.6; the tools command pnpm10.33.1, as their packageManager fields specify. `tools/pnpm-workspace.yaml` marks the tools as their own small workspace so a surrounding Tautest checkout cannot absorb the install; it adds no dependency. The author created the fresh tools lock with `--no-frozen-lockfile`; the supplied lock enables the frozen reproduction above. The project was always installed frozen. The baseline helper and proof command were actually executed on Windows with these same project/tool pins, using output names `baseline.json` and `results-215`. Fresh names above avoid overwriting evidence.

Expected final result: baseline `[372,372]`, candidate-on-original373, manual-mutant old372pass/new372pass+1fail, before Survived, after `[Killed,Killed]`, CLI/core2.1.5, `independentTrial:false`. A stage failure stops and retains evidence without claiming verification. The helper refuses the wrong source revision, changed protected files, existing output or an existing candidate.

The helper temporarily writes the selected package's Stryker config, candidate and exact source replacement. `finally` restores the original source/config bytes, removes only its own candidate, and checks all original package source/test/config files plus root manifest/lock/config. Do not use it in your normal checkout. Engine cache/output can remain in the disposable clone.

For the smallest first look, install only the separate tools lock, then run:

```sh
node tools/node_modules/tautest/dist/index.js analyze --from observed/before.target.json --runner vitest --report-dir fresh-offline-review
```

This compact input was actually analyzed with2.1.5: exit0, score0, one Survived, one group. See `portable-report-check.json`. It reads evidence without executing project tests/config and does not produce a new quality-gate result.

## Setup and limitations

The frozen project install succeeded (599 workspace packages) with lifecycle scripts disabled. Windows warned that the Supabase executable bin was absent because its setup was skipped; vimsplain's normal tests and all selected engine stages still passed. No Supabase/app hook preparation, app test/build, general monorepo behavior or dependency upgrade is claimed. The project source/tests/config/lock were preserved. See `setup.json`.

Execution cwd is `packages/vimsplain`. The original Vitest node environment and test selection remain; tests import `../src/index.js`, not built dist. There is no globalSetup/build command in this package config. Existing project Stryker plugins, TypeScript checker and tsconfig are retained. Controlled overrides are one worker, incremental off, perTest, MethodExpression only, line22, separate reports. Related selection follows the project/runner default and was not changed. Verify's isolated break0 setting is its validation contract, not a committed project threshold change. Linux/Node24 were not run for this new2.1.5 pilot.

The original baselines took49.842s and11.274s on this one Windows host; the first overlapped tool-install I/O. Direct Stryker took48.938s; verify26.795s and42.224s. These are invocation observations, not speedups or user time-to-value measurements.

`candidate.patch` is a test-only proposal and passed `git apply --check` against the pinned clean root. It has not been submitted upstream. Vimgym's AGENTS requires a branch/PR and Changeset for an actual package contribution; this artifact does not bypass that policy. `invitation-draft.txt` is an internal, conditional reply draft only; do not repeat the existing invitation.

## Evidence retained here versus locally

[Recorded byte hashes](recorded-byte-hashes.json) compare the original compact JSON files and pinned tool lock with their public Git blobs: all four are byte-identical. A Windows checkout may materialize CRLF instead of the Git blob's LF; compare downloaded Git bytes when checking capture hashes. Full raw reports remain separate from the compact subsets. Package-tarball integrity and installed-code byte comparisons use original binary buffers, independently of checkout text normalization.

Included: helpers, candidate/patch/license, pinned tools manifest/lock, `registry-identity.json`, scope/setup checks and compact `observed/` evidence. The three `*.target.json` files preserve original target source and every target-mutant identity/status/location field, plus attribution-relevant test IDs/names. Unmutated source files, unrelated tests, test source contents, branding and engine configuration were omitted from these portable subsets. They are **not full raw reports**; original full-report hashes are recorded in `observed/evidence.json`.

Full raw reports, complete normal test JSON/lists, stdout/stderr, verify request/engine logs and sandbox execution outputs remain in the author's local experiment directory `C:/dev/tautest-product-evidence/2026-10-22/roadmap-continue/vimgym-215/results-215` and `baseline.json*`; they were available to the independent reviewer. They are deliberately omitted from this compact repository handoff. No node_modules, disposable clone or historical failed run is included.
