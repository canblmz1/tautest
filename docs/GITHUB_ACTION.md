# GitHub Action

Tautest ships a JavaScript GitHub Action package in `packages/github-action`. It is designed so it can be mirrored into a standalone action repository such as `tautest-dev/tautest-action`.

## Minimal Workflow

```yaml
name: Tautest

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  tautest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      # Add pnpm/action-setup, yarn setup, or oven-sh/setup-bun when your
      # repository uses a package manager that is not already on PATH.

      - uses: tautest-dev/tautest-action@v1
        with:
          working-directory: .
          package-manager: auto
          install: true
          cache: true
          comment: changes
          threshold: 60
          fail-on-threshold: true
```

`fetch-depth: 0` matters because Tautest compares the PR with the base ref. Shallow clones often do not contain enough history for `git diff`.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `base` | PR base SHA | Base ref or SHA passed to `tautest run --base`. |
| `threshold` | `60` | Minimum mutation score expected by CI. |
| `fail-on-threshold` | `true` | Fails the job when the score is below threshold. |
| `comment` | `changes` | `always`, `changes`, or `never`. |
| `config` | empty | Optional path to `tautest.config.ts/js/mjs/json`. |
| `working-directory` | `.` | Project directory where Tautest runs. |
| `package-manager` | `auto` | `auto`, `npm`, `pnpm`, `yarn`, or `bun`. |
| `install` | `false` | Runs dependency install before Tautest. |
| `cache` | `true` | Restores/saves `.tautest/stryker-incremental.json`. |
| `github-token` | `${{ github.token }}` | Token used for sticky PR comments. |

## Outputs

| Output | Description |
| --- | --- |
| `score` | Mutation score. |
| `verdict` | Tautest verdict. |
| `surviving` | Surviving mutant count. |
| `report-path` | Markdown report path. |

## PR Comments

The action writes a sticky PR comment with this marker:

```html
<!-- tautest:report v=1 -->
```

If a previous Tautest comment exists, it is updated. Otherwise, a new comment is created.

Fork PRs may not have `pull-requests: write` permission. In that case the action warns and continues; mutation testing and artifacts still work.

## Artifacts

The action uploads a `tautest-report` artifact when files are present under `.tautest/`:

- `report.md`
- `report.json`
- `fix-prompt.md`
- `mutation.json`

## Cache

When `cache: true`, the action restores and saves:

```text
.tautest/stryker-incremental.json
```

The cache key includes runner OS, package manager, base ref, head ref, and working-directory hash.

## Security Notes

- Do not log `github-token` or secrets. The action masks the token before use.
- PR comments sanitize dynamic markdown from reports and prompts.
- Avoid `pull_request_target` unless you fully understand the risk. Running untrusted fork code with write-scoped tokens can expose secrets or allow repository mutation.
- Prefer `pull_request` with `contents: read` and `pull-requests: write`.
- Do not use an unsafe checkout of untrusted fork code with elevated credentials.

## Local Development

From this monorepo:

```bash
pnpm install
pnpm --filter @tautest/github-action test
pnpm --filter @tautest/github-action typecheck
pnpm --filter @tautest/github-action build
```

The bundled entrypoint is `packages/github-action/dist/index.js`, which is the file referenced by `action.yml`.
