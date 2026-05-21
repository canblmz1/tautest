# CLI Reference

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
- `--report-dir <dir>`
- `--no-cache`
- `--config <path>`
- `--workspace <path>`
- `--json`
- `--dry-run`
- `--prompt-style agent|human|claude-code|cursor|codex|opencode`

### Workspace path beta

Use `--workspace <path>` from a repository root to run Tautest as if it started inside a package or workspace directory:

```bash
tautest run --workspace packages/api --base origin/main
```

This is a small monorepo beta step. The workspace path must stay inside the current repository directory. Full changed-workspace graph detection is still future work.

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

Changed production files:
- src/discount.ts lines 2 (1 changed line)

Excluded changed files:
- src/discount.test.ts: test file
- README.md: non-source file

Stryker mutate scope:
- src/discount.ts:2-2
```

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
