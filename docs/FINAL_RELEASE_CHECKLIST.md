# Final Release Checklist

## Required Before npm Publish

- [ ] Confirm `pnpm.cmd install --frozen-lockfile` passes with `CI=true`.
- [ ] Confirm `pnpm.cmd typecheck` passes.
- [ ] Confirm `pnpm.cmd lint` passes.
- [ ] Confirm `pnpm.cmd test` passes.
- [ ] Confirm `pnpm.cmd build` passes.
- [ ] Confirm `pnpm.cmd audit --prod` reports no known vulnerabilities.
- [ ] Confirm `@tautest/core` and `tautest` tarballs pack with `dist`, `README.md`, and `LICENSE`.
- [ ] Re-run clean install smoke outside the Codex Windows shell and verify `pnpm exec tautest --version`.
- [ ] Publish `@tautest/core` first.
- [ ] Publish `tautest` second.
- [ ] Verify `npx tautest@1.0.0 --version` after publish.

## Required Before GitHub Action v1 Tag

- [ ] Run `.github/workflows/release-readiness.yml` on GitHub-hosted Ubuntu.
- [ ] Run `.github/workflows/tautest.yml` on a same-repo pull request.
- [ ] Verify sticky PR comment create.
- [ ] Verify sticky PR comment update.
- [ ] Verify `.tautest` artifact upload.
- [ ] Verify cache restore/save for `.tautest/stryker-incremental.json`.
- [ ] Verify fork PR or restricted-token behavior degrades to warning, not hard failure.
- [ ] Use `canblmz1/tautest/packages/github-action@v1` as the v1 action path.
- [ ] Commit `action.yml`, `dist/index.js`, `dist/index.js.map`, source, tests, and docs.
- [ ] Create immutable `v1.0.0` tag.
- [ ] Move/create major `v1` tag.

## Required Before Public Launch

- [ ] Resolve or explain the Windows/sandbox Stryker cleanup timeout.
- [ ] Verify full `examples/vitest-basic` mutation run on GitHub-hosted Ubuntu with Node 20.
- [ ] Verify README quickstart against published packages.
- [ ] Verify `docs/GITHUB_ACTION.md` workflow against the public action tag.
- [ ] Confirm `docs/FINAL_KNOWN_ISSUES.md` has no P0 issues.
- [ ] Review `docs/LAUNCH_CONTENT.md` for final wording.
- [ ] Review `docs/RELEASE_NOTES_V1.md`.

## Optional After Launch

- [ ] Add Changesets or release automation.
- [ ] Add a job summary fallback for GitHub Action comments.
- [ ] Add more Jest beta fixtures.
- [ ] Add config conflict diagnostics.
- [ ] Start v1.2 monorepo beta design implementation.
- [ ] Add local historical mutation score tracking.
