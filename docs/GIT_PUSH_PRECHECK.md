# Git Push Precheck

## Summary

Push is not ready from this local environment yet.

The repository hygiene checks are in good shape: `.gitignore` was hardened, Stryker/Tautest runtime artifacts are ignored, `packages/github-action/dist/index.js` and `packages/github-action/dist/index.js.map` remain committable, and no secrets were found.

Release verification is partially blocked by environment/tooling issues:

- `pnpm.cmd typecheck`, `pnpm.cmd lint`, `pnpm.cmd test`, `pnpm.cmd build`, and `pnpm.cmd audit --prod` passed.
- `pnpm.cmd exec tautest --version`, `pnpm.cmd exec tautest --help`, and `pnpm.cmd exec tautest run --base main` failed because `tautest` was not resolved by `pnpm exec` in this Windows workspace.
- The direct workspace shim `.\node_modules\.bin\tautest.CMD` worked for `--version`, `--help`, `doctor`, and `run --dry-run`.
- `examples/vitest-basic` mutation smoke produced `.tautest` outputs, but timed out after 300 seconds because Stryker cleanup attempted `taskkill` and received `ERROR: Access denied`.
- `git add -A --dry-run` failed in this sandbox with `fatal: Unable to create 'C:/dev/tauste/.git/index.lock': Permission denied`, so no commit was created.

## Gitignore Changes

`.gitignore` was expanded to ignore local dependencies, runtime mutation artifacts, logs, caches, temporary files, package tarballs, and OS/editor files.

Important behavior verified with `git check-ignore -v`:

- Ignored: `node_modules/`, `.pnpm-store/`, `.tautest/`, `reports/`, `coverage/`, `.stryker-tmp/`, `stryker.log`, `mutation.json`, `stryker-incremental.json`, `*.log`, `*.tmp`, `*.temp`, `.env`, `.env.*`, `.DS_Store`, `Thumbs.db`, `.turbo/`, `.nx/`, `.vite/`, `.vitest/`, `.cache/`, `.parcel-cache/`, `playwright-report/`, `test-results/`, `*.tgz`, `packages/core/dist/`, and `packages/cli/dist/`.
- Explicitly not ignored: `.env.example`, `packages/github-action/dist/index.js`, and `packages/github-action/dist/index.js.map`.

The GitHub Action bundle remains intentionally committable:

```gitignore
dist/
packages/*/dist/

!packages/github-action/dist/
!packages/github-action/dist/index.js
!packages/github-action/dist/index.js.map
```

## Files That Must Not Be Committed

The following categories were checked and are covered by `.gitignore`:

- Dependency folders: `node_modules/`, `.pnpm-store/`
- Tautest and Stryker runtime output: `.tautest/`, `reports/`, `.stryker-tmp/`, `stryker.log`, `mutation.json`, `stryker-incremental.json`
- Test and build caches: `coverage/`, `.vitest/`, `.vite/`, `.cache/`, `.turbo/`, `.nx/`, `.parcel-cache/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo`
- Logs and temporary files: `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`, `pnpm-debug.log*`, `*.tmp`, `*.temp`
- Local secrets: `.env`, `.env.*`
- OS/editor files: `.DS_Store`, `Thumbs.db`, `.idea/`, most `.vscode/*`
- Package artifacts: `*.tgz`

`git status --ignored --short` confirmed generated local artifacts are ignored, including root `.tautest/`, `examples/vitest-basic/.tautest/`, `examples/vitest-basic/.stryker-tmp/`, package `node_modules/`, and non-action package `dist/` folders.

## Files Intentionally Committed

These files and folders should be committed once the remaining blockers are resolved:

- `README.md`
- `LICENSE`
- `.gitignore`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `.github/workflows/**`
- `docs/**`
- `examples/**`
- `packages/core/src/**`
- `packages/core/test/**`
- `packages/core/package.json`
- `packages/cli/src/**`
- `packages/cli/test/**`
- `packages/cli/package.json`
- `packages/github-action/src/**`
- `packages/github-action/test/**`
- `packages/github-action/action.yml`
- `packages/github-action/dist/index.js`
- `packages/github-action/dist/index.js.map`

`package-lock.json` is currently tracked but deleted in the working tree. That deletion is expected for the pnpm workspace migration and should be staged with the release candidate commit.

## Secret Scan Result

No secrets were found.

Commands run:

```powershell
git grep -n "OPENAI_API_KEY\|OPENROUTER_API_KEY\|GITHUB_TOKEN\|NPM_TOKEN\|SECRET\|PASSWORD\|PRIVATE_KEY\|BEGIN RSA\|BEGIN OPENSSH"
git grep -n "sk-\|ghp_\|github_pat_\|xoxb-\|AKIA"
rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!**/node_modules/**' --glob '!.tautest/**' --glob '!**/.tautest/**' --glob '!**/.stryker-tmp/**' --glob '!**/dist/**' "OPENAI_API_KEY|OPENROUTER_API_KEY|GITHUB_TOKEN|NPM_TOKEN|SECRET|PASSWORD|PRIVATE_KEY|BEGIN RSA|BEGIN OPENSSH"
rg -n --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!**/node_modules/**' --glob '!.tautest/**' --glob '!**/.tautest/**' --glob '!**/.stryker-tmp/**' --glob '!**/dist/**' "sk-|ghp_|github_pat_|xoxb-|AKIA"
```

All returned no matches.

## Local Verification

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm.cmd install --frozen-lockfile` | PASS | Initial sandbox run failed with `EPERM` while unlinking `node_modules`; rerun with elevated filesystem permission passed. |
| `pnpm.cmd typecheck` | PASS | Workspace TypeScript checks passed for core, CLI, and GitHub Action. |
| `pnpm.cmd lint` | PASS | Workspace lint scripts passed across packages and examples. |
| `pnpm.cmd test` | PASS | Core, CLI, GitHub Action, Vitest examples, React example, and Jest beta example tests passed. |
| `pnpm.cmd build` | PASS | Core, CLI, and GitHub Action builds passed. Action bundle generated `dist/index.js` and `dist/index.js.map`. |
| `pnpm.cmd audit --prod` | PASS | `No known vulnerabilities found`. |
| `pnpm.cmd exec tautest --version` | FAIL | `tautest` was not resolved by `pnpm exec` in this Windows workspace. |
| `pnpm.cmd exec tautest --help` | FAIL | Same `pnpm exec` binary resolution issue. |
| `.\node_modules\.bin\tautest.CMD --version` | PASS | Returned `1.0.0`. |
| `.\node_modules\.bin\tautest.CMD --help` | PASS | Printed CLI help with `init`, `doctor`, `run`, `prompt`, and `report`. |
| `pnpm.cmd tautest --help` | FAIL | `tautest` was not recognized as a pnpm script or command. |
| `pnpm.cmd exec tautest doctor` | FAIL | Same `pnpm exec` binary resolution issue. |
| `pnpm.cmd exec tautest run --dry-run` | FAIL | Same `pnpm exec` binary resolution issue. |
| `.\node_modules\.bin\tautest.CMD doctor` | PASS | Root doctor passed with 0 errors and 2 warnings: no root runner config and monorepo detected. |
| `.\node_modules\.bin\tautest.CMD run --dry-run` | PASS | Dry-run produced mutate scope without running Stryker. |
| `pnpm.cmd install --frozen-lockfile` in `examples/vitest-basic` | PASS | Initial sandbox run failed with `EPERM`; rerun with elevated filesystem permission passed. |
| `pnpm.cmd exec tautest doctor` in `examples/vitest-basic` | FAIL | Same `pnpm exec` binary resolution issue. |
| `..\..\node_modules\.bin\tautest.CMD doctor` in `examples/vitest-basic` | PASS | Example doctor passed with 0 errors and 1 monorepo warning. |
| `pnpm.cmd exec tautest run --base main` in `examples/vitest-basic` | FAIL | Same `pnpm exec` binary resolution issue. |
| `..\..\node_modules\.bin\tautest.CMD run --base main` in `examples/vitest-basic` | FAIL | Timed out after 300 seconds. Stryker cleanup failed on Windows with `taskkill ... ERROR: Access denied`; `.tautest` reports were still written and ignored by Git. |
| `git add -A --dry-run` | FAIL | Sandbox Git metadata write failed with `fatal: Unable to create 'C:/dev/tauste/.git/index.lock': Permission denied`. No commit was created. |

## Git Status Before Commit

`git status --short` before creating this report:

```text
 M .gitignore
 M examples/vitest-basic/package.json
 M examples/vitest-basic/src/discount.ts
 M examples/vitest-basic/vitest.config.ts
 D package-lock.json
 M package.json
 M scripts/prototype-run.ts
?? .github/
?? LICENSE
?? README.md
?? docs/CLAUDE_CODE_WORKFLOW.md
?? docs/CLI_REFERENCE.md
?? docs/CLOUD_EVALUATION.md
?? docs/CODEX_WORKFLOW.md
?? docs/CONFIG_REFERENCE.md
?? docs/CURSOR_WORKFLOW.md
?? docs/DEMO_SCRIPT.md
?? docs/FINAL_KNOWN_ISSUES.md
?? docs/FINAL_NEXT_STEPS.md
?? docs/FINAL_PROJECT_REPORT.md
?? docs/FINAL_RELEASE_CHECKLIST.md
?? docs/GITHUB_ACTION.md
?? docs/HOW_IT_WORKS.md
?? docs/LAUNCH_CONTENT.md
?? docs/LIMITATIONS.md
?? docs/MONOREPO_DESIGN.md
?? docs/PHASE_1_REPORT.md
?? docs/PHASE_2_REPORT.md
?? docs/PHASE_3_REPORT.md
?? docs/PHASE_4_PROMPT_EVAL.md
?? docs/PHASE_5_REPORT.md
?? docs/PHASE_6_REPORT.md
?? docs/QUICKSTART.md
?? docs/RELEASE_NOTES_V1.md
?? docs/ROADMAP.md
?? docs/ROADMAP_V1_PLUS.md
?? docs/RUNNER_PLUGIN_ARCHITECTURE.md
?? docs/TROUBLESHOOTING.md
?? docs/V1_RELEASE_REPORT.md
?? examples/jest-basic/
?? examples/vitest-basic/.gitignore
?? examples/vitest-basic/README.md
?? examples/vitest-basic/fixed/
?? examples/vitest-basic/tautest.config.ts
?? examples/vitest-react/
?? packages/
?? pnpm-lock.yaml
?? pnpm-workspace.yaml
```

After this report is added, `docs/GIT_PUSH_PRECHECK.md` should also appear as untracked until staged.

## Recommended Commit

Do not commit from this environment until the two execution blockers are resolved or explicitly accepted:

1. `pnpm exec tautest` cannot resolve the `tautest` binary.
2. `examples/vitest-basic` mutation smoke times out during Stryker cleanup on Windows because `taskkill` is denied.

Once resolved, use:

```powershell
git add -A
git status --short
git commit -m "chore: prepare Tautest v1 release candidate"
```

Before committing, confirm that ignored runtime artifacts such as `.tautest/`, `.stryker-tmp/`, `node_modules/`, package caches, logs, and `.env*` files are not staged.

## Recommended Remote Commands

No remote is currently configured.

Prepare the remote only after the release candidate commit is clean:

```powershell
git remote add origin https://github.com/canblmz1/tautest.git
git remote -v
git push -u origin main
```

Do not use `pull_request_target` for untrusted pull request code. The GitHub Action documentation should continue to recommend a normal `pull_request` workflow with `actions/checkout` using `fetch-depth: 0` and least-privilege permissions:

```yaml
permissions:
  contents: read
  pull-requests: write
```
