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
- `--json`
- `--dry-run`
- `--prompt-style agent|human|claude-code|cursor|codex`

## `tautest prompt`

Prints a fix prompt from `.tautest/report.json`.

```bash
tautest prompt --style codex
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
