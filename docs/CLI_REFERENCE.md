# CLI Reference

## `tautest analyze`

Analyze a **raw Stryker JSON report** without running tests, evaluating config files, installing a mutation engine, or requiring Git:

```bash
tautest analyze --from reports/mutation/mutation.json
tautest analyze --from mutation.json --runner vitest --json
```

`--from` is required. `--report-dir` defaults to `.tautest/review`. `--runner vitest|jest` overrides the report's runner for the test-fix prompt; `--prompt-style` accepts the same styles as `run`. Without a supported recorded runner, analysis still works and the prompt explains how to choose one. This differs from `report --from`, which reads an already normalized Tautest report.

Outputs: `report.md`, normalized schema-v1 `report.json`, expression groups in `review.json`, and `fix-prompt.md`. All Survived and NoCoverage findings remain in the report. Groups share a source expression; grouping does not prove behavioral equivalence. Unknown or pending states produce `complete: false` and an UNKNOWN verdict. Exit 0 means analysis succeeded, not that the project passed a new mutation gate. Malformed input exits 10; explicit zero-test survivors exit 12.

`analyze` does not evaluate a threshold. When actionable mutants and a known score remain, its Markdown keeps a review warning beginning "No threshold was evaluated" rather than claiming a passed gate or coverage of a new patch. Raw scores and mutant states are unchanged.

JSON reports up to 1 GiB are accepted. Reports above 128 MiB are streamed, omitting only string-valued `files[...].mutants[...].statusReason` diagnostics before assembling the analysis. All other report fields are retained; the retained JSON must fit within 128 MiB. The original file stays unchanged and its SHA-256 identifies the input, including omitted diagnostics. `review.json` records the streamed input size, retained size and omitted string count under `input.importDetails`; the terminal and Markdown report also disclose omission. Consult the original report for diagnostic text. The same importer and limits apply to `verify` and `review`.

The streaming path also rejects property names above 1 MiB and JSON nesting deeper than 1,024 levels before assembling the report.

## `tautest review`

Record a manual judgment using the full group id from `review.json`:

```bash
tautest review GROUP_ID --decision equivalent --reason "Explain why every mutation in this expression is equivalent"
tautest review GROUP_ID --decision accepted-risk --reason "Describe the accepted behavior and impact"
tautest review GROUP_ID --decision needs-test --reason "Add the missing boundary assertion"
```

`--decision` accepts `needs-test`, `equivalent`, or `accepted-risk`; `--reason` is required and nonempty. `--report-dir` selects the analysis directory. Tautest records these as manual judgments, never equivalence proofs, and never changes raw mutant statuses or scores. Manually equivalent or accepted-risk groups leave the generated test-fix queue but remain in the report. A judgment applies to every mutant in its expression group.

Decisions require matching local source and a current project snapshot. They expire when the imported report or project files change, including tests, config and lockfiles. The conservative snapshot skips symlinks, dependencies, Git data, generated `dist`, `coverage`, `reports`, `.tautest`, `.stryker-tmp` directories, and `.env*` files. Snapshot limits are 64 MiB and 20,000 files; when unavailable or exceeded, analysis works but review persistence is disabled. Review from a package root and keep verification-relevant inputs outside skipped generated directories.

## `tautest verify`

Verify a specific survivor against a candidate test file using a fresh, scoped Stryker run:

```bash
tautest verify --from mutation.json --mutant 7 --test test/price.test.js --budget 180
tautest verify --from mutation.json --file src/price.js --mutant 7 --test test/price.test.js --json
```

Required: `--from`, `--mutant`, and `--test`. Use `--file` when ids repeat across files. `--runner vitest|jest` explicitly overrides the local runner; otherwise Tautest uses the project's Stryker config runner, then the report's Vitest/Jest runner. `--report-dir` defaults to `.tautest/verification`; each run gets a unique directory. `--budget` is a whole number of seconds, 1–86400, default 180. It covers worker startup, config loading, build, initial tests and mutation tests. This flag applies to `verify`, not `run`.

Source must match the report and the target must be Survived or NoCoverage. Paths for verification must be project-relative and resolve inside the package. The initial suite must pass, the exact target must be reproduced and Killed with `testsCompleted > 0`, and `killedBy` must identify an executed test in the selected file. Run-local mutant ids may change; identity is matched by file, location, mutator and replacement. This proves attribution to a file, not to one newly added assertion or to every test in the project.

Verification uses installed Stryker and its runner, with the same [supported versions](../README.md#supported-setup). It loads the first local `stryker.config.{json,mjs,js,cjs}` or `stryker.conf.{json,mjs,js,cjs}` and retains runner settings, plugins and other options. Embedded report config is data and is never executed or replayed. Overrides enforce the selected source lines, JSON output, sandbox mode, no incremental reuse, a complete mutation run, zero break threshold and sandbox cleanup. Custom config filenames and TypeScript Stryker config files are not supported by this command yet. Test files are not edited or selected automatically; the selected file must participate in the configured suite.

Cancellation delivered to Node's SIGINT/SIGTERM handlers kills the worker process group on POSIX, then re-sends the original signal to the CLI. On Windows, the handler attempts process-tree cleanup with a bounded `taskkill /T /F`; native console cancellation has not yet been verified. A console broadcast could let the worker exit before taskkill enumerates its descendants. Cancellation does not return a verification result or become a budget timeout; interrupted runs can retain partial logs and sandbox files. Tautest does not delete other runs' files. SIGKILL, external forced termination, and descendants that deliberately leave the POSIX process group cannot be cleaned up by this handler. On Windows, console Ctrl+C can deliver SIGINT, but native SIGTERM is unsupported and `process.kill()` bypasses handlers ([Node signal behavior](https://nodejs.org/docs/latest-v24.x/api/process.html#signal-events)).

Runs that return normally write `verification.json`, `verification.md`, `engine.log`, and the worker request; completed engine runs also contain the fresh `mutation.json`. Exit codes:

- `0`: verified candidate kill and passing initial suite.
- `1`: completed but the required candidate kill was not established.
- `10`: invalid selection, stale source, malformed input or invalid budget.
- `12`: engine failure or incomplete evidence, including budget exhaustion.

On budget exhaustion Tautest terminates the worker process tree and records `incomplete`. A termination failure is recorded in execution evidence. Abrupt termination may leave Stryker sandbox files; inspect the evidence and remove only that run's leftover sandbox. Neither a timeout, a compiler error, nor a failing initial suite is proof of a test fix. Verification never changes the imported report or claims a new full-project score.

## `tautest demo`

Prints a copy-paste demo that shows the core Tautest loop: normal tests pass, changed-line mutation testing finds a surviving boundary mutant, and the generated prompt points to the missing test.

```bash
tautest demo
tautest demo --run
tautest demo --json
```

`tautest demo` prints the short path without changing files.

`tautest demo --run` runs the local `examples/vitest-basic` fixture in a Tautest repository checkout. It temporarily creates the demo source diff, runs the weak test suite, runs Tautest, adds the missing boundary test, runs Tautest again, and restores the fixture files afterward.

## `tautest init`

Creates a local config and prepares Stryker dependencies.

```bash
tautest init --yes --runner vitest --pm pnpm
```

Flags:

- `--yes`: accept detected defaults.
- `--no-install`: edit files but do not install packages.
- `--runner vitest|jest`: choose test runner.
- `--pm npm|pnpm|yarn|bun`: choose package manager.

## `tautest doctor`

Checks project readiness.

```bash
tautest doctor
tautest doctor --json
```

Checks include Node (22 or newer), Git, shallow clone status, package.json, runner detection, Stryker dependencies, whether the installed Vitest and Stryker Vitest runner can run tests together, runner config, monorepo signals, existing Stryker config, `.tautest/` gitignore, and package manager.

An explicit `testRunner` in Tautest config takes precedence over automatic detection. The Stryker dependency check requires the selected runner's package: a Jest runner cannot satisfy a Vitest selection, or vice versa. Missing dependencies remain warnings, so they do not change the exit code to an error. Vitest compatibility is also a warning when either installed version is unavailable; the existing incompatible Vitest 5 combination remains an error. Dependency declarations and these version checks do not prove that mutation tests will execute successfully.

## `tautest run`

Runs mutation testing for changed source lines.

```bash
tautest run --base origin/main --threshold 60
```

Flags:

- `--base <ref>`
- `--threshold <number>`
- `--ai`
- `--max-files <number>`
- `--max-changed-lines <number>`
- `--report-dir <dir>`
- `--no-cache`
- `--config <path>`
- `--workspace`
- `--workspace-path <path>`
- `--packages <selectors>`
- `--affected`
- `--all`
- `--json`
- `--dry-run`
- `--prompt-style agent|human|claude-code|cursor|codex|opencode`

### Workspace execution beta

Use `--workspace --dry-run --json` from a repository root to inspect the monorepo package plan without running Stryker:

```bash
tautest run --workspace --dry-run --json --base origin/main
```

The workspace mode currently supports `pnpm-workspace.yaml` and root `package.json` workspaces. Dry-run prints selected packages, why each package was selected, unselected packages, changed files, workspace confidence, and warnings for conservative selections.

Affected mode is conservative. A root config or lockfile change selects all packages. A source change inside a workspace package selects that package and any direct workspace packages that depend on it through `dependencies`, `devDependencies`, or `peerDependencies`. Aggregate workspace reports include package selection reasons and package-level messages so skipped or failed packages remain visible.

When `turbo.json` or `nx.json` is present, the plan includes a capability warning. The current beta still uses package path ownership; Turbo and Nx project graph expansion are future hardening work.

Selection flags:

- `--workspace --dry-run`: select packages affected by changed files.
- `--workspace --packages @repo/api,packages/web --dry-run`: select explicit package names or paths.
- `--workspace --all --dry-run`: select every detected workspace package.
- `--workspace --affected --dry-run`: explicit spelling for the default affected package plan.

Without `--dry-run`, workspace mode runs selected packages sequentially and writes aggregate reports:

- `.tautest/workspace-report.md`
- `.tautest/workspace-report.json`
- `.tautest/packages/<package>/report.md`
- `.tautest/packages/<package>/report.json`
- `.tautest/packages/<package>/fix-prompt.md`

Sequential execution is intentional in this beta so package output remains deterministic. Concurrency and transitive dependency-graph scheduling are later workspace hardening steps.

### Workspace path compatibility

Use `--workspace-path <path>` from a repository root to run Tautest as if it started inside a package or workspace directory:

```bash
tautest run --workspace-path packages/api --base origin/main
```

For backward compatibility, `--workspace packages/api` still behaves as the legacy path option. New workflows should prefer `--workspace-path` for package-path runs and `--workspace` for workspace planning.

### Mutation budget

Use `--max-changed-lines <number>` to stop large mutation runs before StrykerJS starts:

```bash
tautest run --base origin/main --max-changed-lines 25
```

This budget counts changed production source lines after Tautest filters out tests, docs, deleted files, binaries, and non-source files. Pair it with `--dry-run` to preview the current scope:

```bash
tautest run --base origin/main --dry-run
```

### Dry-run preview

Use `--dry-run` to inspect what Tautest would mutate before paying the cost of a StrykerJS run:

```bash
tautest run --base origin/main --dry-run
```

Example output:

```text
Tautest dry run

Base ref: origin/main
Runner: vitest
Report dir: .tautest
Estimated mutation scope: small
Changed production lines: 1

Changed production files:
- src/discount.ts lines 2 (1 changed line)

Excluded changed files:
- src/discount.test.ts: test file
- README.md: non-source file

Stryker mutate scope:
- src/discount.ts:2-2
```

### No-op guidance

When Tautest finds no changed production source files, it exits with code `2` and prints why the changed files were skipped:

```text
Tautest no-op

No changed production source files found. Nothing to mutate.

Excluded changed files:
- src/discount.test.ts: test file
- README.md: non-source file
```

This is expected for docs-only, config-only, deleted-only, binary-only, or test-only changes. Use `--json` for machine-readable `changedFiles` and `guidance` fields.

When the project has a Stryker config with a `mutate` list, changed files outside it are skipped with the reason `outside Stryker mutate scope`, even if their extension is a source extension.

An explicit `mutate: []` skips all changed source files and exits with code `2` without starting Stryker. Omitting `mutate` keeps Tautest's default changed-source scope.

A run whose changed lines contain no mutable code (for example only comments, imports, or declarations) also exits with code `2` and status `no-op` instead of failing the threshold.

### Machine-readable report

`tautest run` writes `.tautest/report.json` with `version: "1"` and `schemaVersion: "1"`.

The JSON Schema lives at [`docs/report.schema.json`](report.schema.json). Use it when another tool, CI step, or agent workflow consumes Tautest output directly.

## Reliability commands

These commands are local-first reliability helpers. They do not call an LLM by default and they write separate reliability artifacts so the mutation `report.json` contract stays stable.

### `tautest predict-flaky`

Scores test files for deterministic flakiness signals such as floating async work, real-time sleeps, nondeterministic clocks/randomness, shared state, and ambient IO.

```bash
tautest predict-flaky
tautest predict-flaky src/service.test.ts --threshold 75
tautest predict-flaky tests --runner vitest --json
```

Outputs:

- `.tautest/flaky-report.json`
- `.tautest/flaky-report.md`

`--threshold <number>` is a maximum allowed risk score. If the report score is greater than or equal to the threshold, the command exits `1`.

### `tautest watch`

Builds a static JS/TS import graph and plans affected test files from changed source files.

```bash
tautest watch --base origin/main
tautest watch src/math.ts --json
```

Outputs:

- `.tautest/watch-report.json`
- `.tautest/watch-report.md`

The MVP prints affected tests and runner command hints. If no tests are selected, run the normal suite because dynamic imports, path aliases, generated code, or custom resolvers may need a fuller graph.

### `tautest scaffold`

Generates a test scaffold for a source file. It prints to stdout by default and only writes files with `--write`.

```bash
tautest scaffold src/service.ts
tautest scaffold src/service.ts --framework jest --write
tautest scaffold app/service.py --language python --framework pytest --write
```

Python scaffold is experimental and does not imply full Python mutation support.

### `tautest time-travel init`

Writes or prints deterministic fake-timer helpers for async tests.

```bash
tautest time-travel init --runner vitest --setup-file test/time.ts
tautest time-travel init --runner jest --print
```

The generated helper wraps the runner fake timer APIs and restores real timers after each test.

### `tautest chaos`

Runs a command with deterministic app-level chaos injection. The MVP patches Node `fetch` in the test process through `NODE_OPTIONS=--import`; it does not perform OS-level packet loss.

```bash
tautest chaos --command "pnpm test" --profile latency-basic --seed 123
tautest chaos --command "pnpm test" --profile connection-errors --json
```

Profiles:

- `latency-basic`
- `connection-errors`
- `stress`

Outputs:

- `.tautest/chaos-report.json`
- `.tautest/chaos-report.md`

### Reliability HTML reports

`tautest report --html` can render either mutation `report.json` or reliability JSON files:

```bash
tautest report --html --from .tautest/flaky-report.json --out .tautest/flaky-report.html
```

## `tautest prompt`

Prints a fix prompt from `.tautest/report.json`.

```bash
tautest prompt --style codex
tautest prompt --style opencode
tautest prompt --from path/to/report.json
```

Optional provider suggestion mode is disabled by default and never edits files. It sends the generated prompt to an explicitly configured external command on stdin and writes the provider output to `.tautest/llm-suggestion.md`:

```bash
tautest prompt --from .tautest/report.json \
  --style codex \
  --suggest \
  --provider-command node \
  --provider-arg scripts/tautest-llm-provider.mjs \
  --model internal-wrapper
```

Prompt flags:

- `--config <path>`: path to `tautest.config.*`.
- `--suggest`: enable the opt-in external-command suggestion flow.
- `--provider-command <command>`: executable that reads the prompt from stdin and writes Markdown to stdout.
- `--provider-arg <arg>`: argument passed to the provider command; repeat for multiple args.
- `--model <name>`: model or wrapper name recorded in suggestion provenance.
- `--suggestion-out <path>`: custom suggestion artifact path.
- `--no-redact`: disable built-in secret redaction for the provider handoff.

See [LLM suggestions](LLM_SUGGESTIONS.md) and [trust and safety](TRUST_AND_SAFETY.md) before enabling this in a repository.

## `tautest report`

Prints markdown report content, or writes a static HTML report from `report.json`.

```bash
tautest report
tautest report --from path/to/report.md
tautest report --html
tautest report --html --from .tautest/report.json --out .tautest/report.html
```

HTML report flags:

- `--html`: generate a static HTML viewer from `report.json`.
- `--out <path>`: output path for the generated HTML file. Defaults to `report.html` next to the JSON report.

## Exit Codes

- `0`: success and threshold passed.
- `1`: mutation run completed but threshold failed.
- `2`: nothing to mutation-test: no changed production source files, or Stryker generated no mutants for the changed lines.
- `10`: config error.
- `11`: detection error.
- `12`: Stryker error, including a run whose surviving mutants executed zero tests (see [Troubleshooting](TROUBLESHOOTING.md#surviving-mutants-executed-zero-tests)).
- `20`: Git error.
