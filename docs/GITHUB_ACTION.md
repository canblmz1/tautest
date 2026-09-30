# GitHub Action

The Tautest action runs `tautest run` on a pull request. It then posts a sticky comment, writes a job summary and uploads the reports as an artifact. It ships from this repository at `packages/github-action`.

The action runs the Tautest CLI installed in your project (`node_modules/.bin/tautest`). Install `tautest` and Stryker as dev dependencies first, as in the [Quickstart](QUICKSTART.md), so your lockfile pins their versions. Without a local install, the action falls back to `npm exec`, `yarn exec`, `pnpm exec` or `bunx`, and with npm or Bun that can download whatever Tautest version is newest.

## Advisory Workflow

Start here. A low score is reported but does not fail the job:

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
          node-version: 22

      # Reads the pnpm version from "packageManager" in package.json; without that field, add `with: version`.
      - uses: pnpm/action-setup@v4

      - run: pnpm install --frozen-lockfile

      # tautest@2.0.5. Pin the commit of the release you install; the old `v1` tag is the 1.x action.
      - uses: canblmz1/tautest/packages/github-action@df9d2e1bf5c02970149d97ed11e6d6fa4b152208
        with:
          fail-on-threshold: false
```

- **Git history.** `fetch-depth: 0` is required: Tautest diffs the pull request against its base.
- **Base.** The action uses the pull request's base commit unless you set `base`.
- **Build step.** If your tests need one, run it before the Tautest step. Set any environment variable your tests need, such as `TZ`, on the job or step.
- **Advisory mode.** `fail-on-threshold: false` changes only the threshold outcome (exit code `1`). A configuration, Stryker or git error still fails the job, because the score would be meaningless.
- **Version pin.** Pin the action to the commit tagged with the Tautest release you installed, as above. The `v1` tag still points at the 1.x action from May 2026. That action runs on Node 20 and has no `annotations` input.

## Pull Requests From Forks

A `pull_request` run from a fork gets a read-only token, so the sticky comment cannot be written. The action logs a warning and carries on. The same report is in the job summary and in the `tautest-report` artifact.

Do not switch to `pull_request_target` to get the comment back. That trigger runs with a write token, and this job executes the pull request's code: Stryker runs its tests.

## Turning On The Gate

Keep the job advisory until all of these hold:

- the normal suite passes repeatedly on the unmodified code;
- repeated Tautest runs on the same commit give the same mutate scope and mutant statuses;
- the team has reviewed real pull requests and knows which survivors it treats as real gaps and which as equivalent mutants.

Then drop `fail-on-threshold: false`, or set it to `true`, to fail the job when the score is below `threshold`. If mutant statuses change between runs, see [Mutant Statuses Change Between Runs](TROUBLESHOOTING.md#mutant-statuses-change-between-runs) first.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `base` | PR base SHA | Base ref or SHA passed to `tautest run --base`. |
| `threshold` | `60` | Minimum mutation score. |
| `fail-on-threshold` | `true` | Fails the job when the score is below `threshold`. Start with `false`. |
| `max-files` | empty | Optional changed source file budget passed to `tautest run --max-files`. |
| `max-changed-lines` | empty | Optional changed production line budget passed to `tautest run --max-changed-lines`. |
| `comment` | `changes` | Sticky PR comment mode: `always`, `changes`, or `never`. |
| `annotations` | `never` | Inline annotation mode: `never` or `survivors`. |
| `config` | empty | Optional path to `tautest.config.ts/js/mjs/json`. |
| `prompt-style` | config default | Fix-prompt style: `agent`, `human`, `claude-code`, `cursor`, `codex`, or `opencode`. |
| `working-directory` | `.` | Project directory where Tautest runs. |
| `package-manager` | `auto` | `auto`, `npm`, `pnpm`, `yarn`, or `bun`. |
| `install` | `false` | Runs a dependency install before Tautest. Most workflows should install dependencies in their own step. |
| `cache` | `true` | Restores and saves `.tautest/stryker-incremental.json`; see [Cache](#cache). |
| `github-token` | `${{ github.token }}` | Token used for sticky PR comments. |

## Outputs

| Output | Description |
| --- | --- |
| `score` | Mutation score. |
| `verdict` | Tautest verdict. |
| `threshold` | Configured mutation score threshold. |
| `killed` | Killed mutant count. |
| `surviving` | Surviving mutant count. |
| `no-coverage` | No-coverage mutant count. |
| `report-path` | Markdown report path. |
| `json-path` | JSON report path. |
| `prompt-path` | Fix prompt path. |
| `mutation-json-path` | Raw mutation report path. |
| `runtime-ms` | Tautest runtime in milliseconds. |
| `changed-source-lines` | Changed production source lines considered by Tautest. |

## CI Budgets

Use `max-files` and `max-changed-lines` to keep CI predictable on large pull requests:

```yaml
with:
  fail-on-threshold: false
  max-files: 5
  max-changed-lines: 25
```

When a budget is exceeded, Tautest stops before StrykerJS starts and the job fails with a diagnostic. Run `tautest run --dry-run` locally to see the mutation scope.

## Monorepo Packages

Run the action from the package directory with `working-directory`. Workspace mode is beta. To plan which packages a pull request touches, run the CLI planner in a separate job:

```yaml
- run: pnpm exec tautest run --workspace --dry-run --json --base ${{ github.event.pull_request.base.sha }} > workspace-plan.json
```

Small workspaces can run the sequential beta directly:

```yaml
- run: pnpm exec tautest run --workspace --json --base ${{ github.event.pull_request.base.sha }}
```

Large workspaces can build a job matrix from the dry-run JSON and invoke this action with `working-directory: ${{ matrix.packagePath }}`. See [Monorepo](TROUBLESHOOTING.md#monorepo) for the tsconfig layouts Stryker cannot handle.

## PR Comments

The action writes a sticky PR comment with this marker:

```html
<!-- tautest:report v=1 -->
```

If a previous Tautest comment exists, it is updated. Otherwise, a new comment is created. The comment shows:

- `Tautest Patch Mutation Gate: <verdict>`
- the mutation score and threshold
- killed, survived, and no-coverage counts
- a one-line note when the threshold passed but survivors or uncovered mutants still need review
- the top surviving mutants
- likely missing behavior, when the JSON report includes mutant insight data
- a collapsible fix prompt

## Inline Annotations

Set `annotations: survivors` to emit GitHub workflow annotations for the top surviving mutants. Each annotation points to the mutant's file and line when GitHub can map the path. It includes the original expression, the replacement and the likely missing behavior.

Annotations are separate from the sticky comment. With `comment: never`, the pull request thread stays quiet while the Checks UI still shows the survivors.

## Job Summary

When `GITHUB_STEP_SUMMARY` is available, the action writes a job summary with:

- the verdict and mutation score;
- killed, survived and no-coverage counts;
- the top surviving mutants;
- the generated report file paths.

It is the report for fork pull requests, and for runs where comments are off.

## Artifacts

The action uploads a `tautest-report` artifact when files are present under `.tautest/`:

- `report.md`
- `report.json`
- `fix-prompt.md`
- `mutation.json`

## Cache

With `cache: true`, the default, the action restores and saves `.tautest/stryker-incremental.json`. Tautest does not write that file by default: Stryker's incremental mode is off (`stryker.incremental: false`). The cache therefore does nothing unless you configure both settings:

```ts
export default defineConfig({
  stryker: {
    incremental: true,
    incrementalFile: '.tautest/stryker-incremental.json'
  }
});
```

Even then, expect little reuse on a typical pull request. Stryker reuses a mutant's result only if its covering tests are unchanged. The Vitest runner reports no test locations, so a change anywhere in a test file counts as a change to every test in it.

## Security Notes

- The action masks `github-token` before use. Do not log it or other secrets.
- PR comments sanitize dynamic Markdown from reports and prompts.
- Use `pull_request` with `contents: read` and `pull-requests: write`.
- Avoid `pull_request_target`: running StrykerJS on pull request code is code execution by design.

## Troubleshooting

- **No changed production files.** Confirm the pull request changes source files and that `base` points to the expected branch or SHA.
- **Git diff fails.** Confirm `actions/checkout` uses `fetch-depth: 0`.
- **No sticky comment.** Confirm `pull-requests: write` is granted and the pull request is not from a fork.
- **The action cannot find the CLI.** Install `tautest` as a dev dependency and run your package manager's install before the action step.
- **Mutation testing is slow.** Keep pull requests small, set `max-changed-lines`, and see [Slow Test Suite](TROUBLESHOOTING.md#slow-test-suite).

## Local Development

From this repository:

```bash
pnpm install
pnpm --filter @tautest/github-action test
pnpm --filter @tautest/github-action typecheck
pnpm --filter @tautest/github-action build
```

The bundled entrypoint is `packages/github-action/dist/index.js`, which is the file `action.yml` references.
