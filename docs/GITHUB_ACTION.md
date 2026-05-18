# GitHub Action

Tautest ships a JavaScript GitHub Action from this monorepo at `packages/github-action`.

Use the monorepo action path:

```yaml
uses: canblmz1/tautest/packages/github-action@v1
```

## Workflow Example

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

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - uses: canblmz1/tautest/packages/github-action@v1
        with:
          base: ${{ github.base_ref }}
          threshold: 60
          comment: changes
          cache: true
```

`fetch-depth: 0` is required because Tautest compares the pull request with the base ref.

`pull-requests: write` is required for sticky pull request comments. If the token cannot write comments, mutation testing and artifacts can still run, but the comment step will warn instead of updating the PR.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `base` | PR base SHA | Base ref or SHA passed to `tautest run --base`. |
| `threshold` | `60` | Minimum mutation score expected by CI. |
| `fail-on-threshold` | `true` | Fails the job when the score is below threshold. |
| `comment` | `changes` | PR comment mode: `always`, `changes`, or `never`. |
| `config` | empty | Optional path to `tautest.config.ts/js/mjs/json`. |
| `working-directory` | `.` | Project directory where Tautest runs. |
| `package-manager` | `auto` | `auto`, `npm`, `pnpm`, `yarn`, or `bun`. |
| `install` | `false` | Runs dependency install before Tautest. Most workflows should install dependencies explicitly before invoking the action. |
| `cache` | `true` | Restores and saves `.tautest/stryker-incremental.json` when available. |
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

## Job Summary

When `GITHUB_STEP_SUMMARY` is available, the action writes a GitHub job summary with:

- verdict and mutation score
- killed, survived, and no-coverage counts
- top surviving mutants
- generated report file paths

This summary is useful when PR comments are disabled, unavailable for fork PRs, or hidden in a busy pull request discussion.

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

The v1 source PR smoke validated graceful cache handling. A real cache hit was not proven before v1, so better cache observability is tracked as follow-up work.

## Security Notes

- Do not log `github-token` or secrets. The action masks the token before use.
- PR comments sanitize dynamic markdown from reports and prompts.
- Prefer `pull_request` with `contents: read` and `pull-requests: write`.
- Avoid `pull_request_target` unless you fully understand the risk.
- Running StrykerJS on pull request code is code execution by design.

## Troubleshooting

- If no changed production files are found, confirm the PR changes source files and that `base` points to the expected branch or SHA.
- If Git diff fails, confirm `actions/checkout` uses `fetch-depth: 0`.
- If no sticky comment appears, confirm `pull-requests: write` is present and the PR token has permission to write comments.
- If the action cannot find the CLI, make sure dependencies are installed and `pnpm build` completed before the action step.
- If mutation testing is slow, start with smaller PRs and review StrykerJS runner configuration.

## Local Development

From this monorepo:

```bash
pnpm install
pnpm --filter @tautest/github-action test
pnpm --filter @tautest/github-action typecheck
pnpm --filter @tautest/github-action build
```

The bundled entrypoint is `packages/github-action/dist/index.js`, which is the file referenced by `action.yml`.
