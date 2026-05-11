# Final Known Issues

## P0 - Release Blockers

No P0 release blockers found after the dependency fix in this audit.

## P1 - Should Fix Before V1

### Full mutation run timed out in the Windows audit environment

Priority: P1

Problem: `..\..\node_modules\.bin\tautest.CMD run --base main` from `examples/vitest-basic` timed out after 240 seconds. Stryker wrote `.tautest/mutation.json`, but cleanup failed with `taskkill ... Access denied`, and the CLI did not complete report/prompt generation for that run.

Impact: The core end-to-end mutation workflow was not successfully re-verified in this Windows/sandbox audit environment, even though existing `.tautest` reports show a previous successful run.

Recommended fix: Run the same smoke on GitHub-hosted Ubuntu with Node 20. If it passes there, document Windows/sandbox as a known limitation. If it fails there, treat as a P0 and investigate Stryker programmatic cleanup or a CLI subprocess fallback.

Related files:

- `packages/core/src/stryker/runner.ts`
- `packages/cli/src/commands/run.ts`
- `examples/vitest-basic`

Estimated difficulty: MEDIUM

### GitHub Action local smoke timed out

Priority: P1

Problem: `node packages/github-action/dist/index.js` with `working-directory=examples/vitest-basic` timed out after 180 seconds. It reached `Running Tautest...` and then hit the same mutation execution path as the CLI smoke.

Impact: Local action smoke is not currently green in this audit environment. The action source, tests, bundle, and metadata are present, but the mutation run must be verified in a real GitHub runner before tagging `v1`.

Recommended fix: Run `.github/workflows/release-readiness.yml` on GitHub-hosted Ubuntu and verify sticky comment, artifact upload, cache restore/save, and threshold handling.

Related files:

- `packages/github-action/src/index.ts`
- `packages/github-action/dist/index.js`
- `.github/workflows/release-readiness.yml`

Estimated difficulty: MEDIUM

### `pnpm exec tautest` failed in this Windows workspace

Priority: P1

Problem: `pnpm.cmd exec tautest --help`, `pnpm.cmd exec tautest doctor`, and clean install smoke with `pnpm -C <dir> exec tautest --version` returned `'tautest' is not recognized...` even though `node_modules/.bin/tautest.CMD` existed and worked directly.

Impact: README and Quickstart recommend `pnpm exec tautest ...`. Direct binary execution works, and packed package bin shims exist, but the documented pnpm path was not verified in this environment.

Recommended fix: Reproduce on a clean terminal outside the Codex shell and on GitHub-hosted Ubuntu. If confirmed, add a package/bin workaround or change docs to prefer `pnpm dlx tautest` after publish.

Related files:

- `packages/cli/package.json`
- `README.md`
- `docs/QUICKSTART.md`
- `docs/CLI_REFERENCE.md`

Estimated difficulty: MEDIUM

### Live GitHub PR workflow remains unverified

Priority: P1

Problem: Sticky PR comment create/update, artifact upload, and cache restore/save cannot be fully verified from the local environment.

Impact: The GitHub Action should not receive the public moving `v1` tag until it has passed on a real pull request with `pull-requests: write`.

Recommended fix: Open a same-repo release smoke PR, run `.github/workflows/tautest.yml` and `.github/workflows/release-readiness.yml`, then verify comment update, artifact, and cache behavior.

Related files:

- `packages/github-action/action.yml`
- `packages/github-action/src/pr-comment.ts`
- `docs/GITHUB_ACTION.md`
- `.github/workflows/tautest.yml`

Estimated difficulty: LOW

## P2 - Can Wait Until V1.1+

### Example-local install failed with EPERM in this sandbox

Priority: P2

Problem: Running `pnpm.cmd install --frozen-lockfile` from `examples/vitest-basic` failed with `EPERM ... open C:\dev\tauste\_tmp_*`. Root workspace install succeeded.

Impact: Example READMEs say `pnpm install`, which may be interpreted as running from the example directory. The workspace install path should be clarified if this reproduces outside the sandbox.

Recommended fix: Update example docs to say "from the repository root, run `pnpm install`" if needed.

Related files:

- `examples/vitest-basic/README.md`
- `examples/vitest-react/README.md`
- `examples/jest-basic/README.md`

Estimated difficulty: LOW

### Report directory can be pointed outside project root

Priority: P2

Problem: CLI `--report-dir` and config `outputDir` are resolved relative to project root but not constrained to stay inside it.

Impact: This is user-controlled local behavior, not a remote exploit in the default path, but safer bounds would reduce accidental writes.

Recommended fix: Add a warning or explicit opt-in for output directories outside the project root.

Related files:

- `packages/cli/src/commands/run.ts`
- `packages/core/src/config/schema.ts`

Estimated difficulty: LOW

### Stryker config conflict diagnostics are still basic

Priority: P2

Problem: Protected Stryker fields are owned by Tautest, but diagnostics explaining the merge are limited.

Impact: Users with existing Stryker configs may need more visibility before trusting generated config behavior.

Recommended fix: Implement the v1.1 config conflict diagnostics described in `docs/ROADMAP_V1_PLUS.md`.

Related files:

- `packages/core/src/stryker/config-generator.ts`
- `docs/ROADMAP_V1_PLUS.md`

Estimated difficulty: MEDIUM

### Monorepo support remains detect-and-warn

Priority: P2

Problem: v1 detects monorepo signals but does not orchestrate package selection or action matrices.

Impact: Users in pnpm workspaces, Turborepo, or Nx will need to run Tautest from package roots.

Recommended fix: Follow `docs/MONOREPO_DESIGN.md` for v1.2.

Related files:

- `packages/core/src/detect/project.ts`
- `docs/MONOREPO_DESIGN.md`

Estimated difficulty: HIGH
