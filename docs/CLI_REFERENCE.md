# CLI Reference

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

Checks include Node, Git, shallow clone status, package.json, runner detection, Stryker dependencies, runner config, monorepo signals, existing Stryker config, `.tautest/` gitignore, and package manager.

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
- `2`: no changed production source files.
- `10`: config error.
- `11`: detection error.
- `12`: Stryker error.
- `20`: Git error.
