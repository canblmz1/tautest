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

### Workspace planner beta

Use `--workspace --dry-run --json` from a repository root to inspect the monorepo package plan without running Stryker:

```bash
tautest run --workspace --dry-run --json --base origin/main
```

The planner currently supports `pnpm-workspace.yaml` and root `package.json` workspaces. It prints selected packages, why each package was selected, unselected packages, changed files, workspace confidence, and warnings for conservative selections.

Selection flags:

- `--workspace --dry-run`: select packages affected by changed files.
- `--workspace --packages @repo/api,packages/web --dry-run`: select explicit package names or paths.
- `--workspace --all --dry-run`: select every detected workspace package.
- `--workspace --affected --dry-run`: explicit spelling for the default affected package plan.

Workspace mutation execution is intentionally not enabled in this beta. That is the next phase; this command is for reviewable planning and CI matrix generation.

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

## `tautest prompt`

Prints a fix prompt from `.tautest/report.json`.

```bash
tautest prompt --style codex
tautest prompt --style opencode
tautest prompt --from path/to/report.json
```

## `tautest report`

Prints markdown report content.

```bash
tautest report
tautest report --from path/to/report.md
```

## Exit Codes

- `0`: success and threshold passed.
- `1`: mutation run completed but threshold failed.
- `2`: no changed production source files.
- `10`: config error.
- `11`: detection error.
- `12`: Stryker error.
- `20`: Git error.
