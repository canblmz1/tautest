# Phase 5 GitHub Action Report

## Goal

Add a GitHub Action that runs Tautest in pull request workflows, uploads reports as artifacts, and writes a sticky PR comment without reimplementing core mutation logic.

## What Was Built

- `packages/github-action`
  - `action.yml`
  - `src/index.ts`
  - `src/inputs.ts`
  - `src/pr-comment.ts`
  - `src/cache.ts`
  - `dist/index.js` bundled with esbuild
- Example workflow:
  - `.github/workflows/tautest.yml`
- User documentation:
  - `docs/GITHUB_ACTION.md`

## Inputs

Implemented:

- `base`
- `threshold`
- `fail-on-threshold`
- `comment`
- `config`
- `working-directory`
- `package-manager`
- `install`
- `cache`

Also implemented:

- `github-token`, defaulting to `${{ github.token }}`, for sticky PR comments.

## Outputs

Implemented:

- `score`
- `verdict`
- `surviving`
- `report-path`

## Runtime Flow

1. Read and validate action inputs.
2. Run preflight checks:
   - working directory exists
   - base ref exists or PR context provides base SHA
   - directory is inside a Git repo
   - shallow clone warning
   - package manager detection
   - PR context detection for comments
3. Optionally install dependencies.
4. Optionally restore `.tautest/stryker-incremental.json` cache.
5. Run `tautest run --json`.
6. Parse JSON output and set action outputs.
7. Upload `.tautest/` report files as the `tautest-report` artifact.
8. Optionally create or update the sticky PR comment.
9. Save cache if the incremental cache file exists.
10. Fail the job only when configured:
    - Tautest infra errors always fail.
    - Threshold failures fail only when `fail-on-threshold: true`.

## Sticky Comment

The comment marker is:

```html
<!-- tautest:report v=1 -->
```

The action updates an existing comment with this marker or creates a new one.

Permission failures are handled gracefully with a warning. This is important for fork PRs where `pull-requests: write` may not be available.

## Artifact

The action uploads these files when present:

- `.tautest/report.md`
- `.tautest/report.json`
- `.tautest/fix-prompt.md`
- `.tautest/mutation.json`

## Cache

The cache path is:

```text
.tautest/stryker-incremental.json
```

The cache key is branch/base aware and includes:

- runner OS
- package manager
- base ref
- head ref
- working-directory hash

## Security Decisions

- The GitHub token is masked through `core.setSecret`.
- Dynamic PR comment content is sanitized before rendering.
- Comment permission errors do not fail the mutation run.
- Documentation warns against unsafe `pull_request_target` usage.
- The action does not recommend checking out untrusted fork code with elevated credentials.

## Verification

Commands run successfully:

```bash
pnpm --filter @tautest/github-action test
pnpm --filter @tautest/github-action typecheck
pnpm --filter @tautest/github-action build
```

Local action entrypoint was also executed with `comment: never`, `cache: false`, and `working-directory: examples/vitest-basic`. It successfully ran Tautest and produced these outputs:

- `score`: `75`
- `verdict`: `MIXED`
- `surviving`: `1`
- `report-path`: `C:\dev\tauste\examples\vitest-basic\.tautest\report.md`

Artifact upload was skipped locally because GitHub Actions artifact runtime variables are not available outside the runner.

The build produces:

- `packages/github-action/dist/index.js`
- `packages/github-action/dist/index.js.map`
- `packages/github-action/dist/index.js.map`

## What Was Not Built

- No dashboard.
- No cloud service.
- No LLM API integration.
- No custom mutation engine.
- No duplicate Tautest core or CLI logic inside the action.

## Assumptions

- The standalone action mirror will publish bundled `dist/` files.
- Public usage will eventually install/run the published `tautest` package through `npx` when a local `tautest` binary is not present.
- In this monorepo, local workflows can use the workspace `tautest` binary after `pnpm install` and `pnpm build`.
- If `install: true` is used with pnpm, yarn, or bun, the package manager must be available on PATH. The action attempts `corepack enable` for pnpm/yarn but does not install Bun.
- `pull_request` is the default safe event. `pull_request_target` should be avoided unless repository maintainers explicitly accept and mitigate the security risk.
- Stryker incremental cache only helps when Tautest/Stryker config writes `.tautest/stryker-incremental.json`; missing cache files are treated as a normal no-op.
