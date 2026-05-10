# Final Next Steps

## If READY_FOR_V1

This audit does not recommend declaring `READY_FOR_V1` yet. If a later GitHub-hosted smoke proves the full mutation and action workflows, proceed with npm publish and the GitHub Action `v1` tag using `docs/FINAL_RELEASE_CHECKLIST.md`.

## If READY_WITH_MINOR_FIXES

Recommended path:

1. Re-run full mutation smoke on GitHub-hosted Ubuntu with Node 20.
2. Re-run clean package smoke in a normal terminal and verify `pnpm exec tautest --version`.
3. Run a same-repo PR with `.github/workflows/tautest.yml`.
4. If those pass, publish `@tautest/core`, then `tautest`, then tag the action.

## If NOT_READY_BLOCKED

Use this path only if the GitHub-hosted smoke reproduces the local timeout:

1. Treat Stryker programmatic execution as the primary blocker.
2. Investigate `packages/core/src/stryker/runner.ts`.
3. Consider a Stryker CLI subprocess fallback that parses JSON when Stryker writes a report but throws during cleanup.
4. Add an end-to-end fixture test that runs `examples/vitest-basic`.
5. Do not publish npm packages or action tags until the fixture passes.

## Recommended Immediate Commands

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm audit --prod
pnpm --filter @tautest/core pack
pnpm --filter tautest pack
pnpm --filter @tautest/github-action test
pnpm --filter @tautest/github-action build
```

GitHub-hosted release smoke:

```bash
gh workflow run "Release Readiness"
gh run list --workflow "Release Readiness" --limit 5
```

Manual local example smoke:

```bash
cd examples/vitest-basic
pnpm exec tautest doctor
pnpm exec tautest run --base main
```

Windows fallback if `pnpm exec` fails in this shell:

```powershell
..\..\node_modules\.bin\tautest.CMD doctor
..\..\node_modules\.bin\tautest.CMD run --base main --dry-run
```
