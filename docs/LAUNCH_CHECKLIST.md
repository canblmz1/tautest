# Launch Checklist

## Repository Polish

- [ ] README badges point to the published npm packages and Release Readiness workflow.
- [ ] README explains that StrykerJS is the mutation engine.
- [ ] README links to the Positioning FAQ for "why not just StrykerJS?" and "agents can read reports" objections.
- [ ] README GitHub Action example uses `canblmz1/tautest/packages/github-action@v1`.
- [ ] GitHub About description is set to `PR-focused mutation testing workflow layer powered by StrykerJS.`
- [ ] GitHub homepage is set to `https://www.npmjs.com/package/tautest`.
- [ ] GitHub topics include mutation testing, StrykerJS, Vitest, Jest, TypeScript, GitHub Actions, AI testing, developer tools, testing tools, and CI.

## Validation Gates

- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm audit --prod` passes.
- [ ] `npx tautest@1.0.0 --version` returns `1.0.0`.
- [ ] `npx tautest@1.0.0 --help` prints CLI help.
- [ ] `npm view tautest@1.0.0 version --registry=https://registry.npmjs.org/` returns `1.0.0`.
- [ ] `npm view @tautest/core@1.0.0 version --registry=https://registry.npmjs.org/` returns `1.0.0`.

## Tag Readiness

- [ ] Git working tree is clean.
- [ ] Published npm versions are verified.
- [ ] Local validation gates pass.
- [ ] Main branch Release Readiness workflow has passed.
- [ ] Source-changing PR smoke has passed.
- [ ] Sticky PR comment create/update is verified.
- [ ] Artifact upload is verified.

## Tag Commands

Run only after every tag readiness item is checked:

```bash
git tag v1.0.0
git push origin v1.0.0
git tag -f v1 v1.0.0
git push origin v1 --force
```

## GitHub Release

Create the GitHub release only after `v1.0.0` exists on GitHub:

```bash
gh release create v1.0.0 --title "Tautest v1.0.0" --notes-file docs/RELEASE_NOTES_V1.md
```

## Post-Launch Watch List

- StrykerJS runner and config edge cases.
- Jest beta failures.
- Monorepo package selection confusion.
- GitHub Action permission behavior on fork PRs.
- GitHub Action cache hit observability.
- Node 20 action runtime deprecation timeline.
