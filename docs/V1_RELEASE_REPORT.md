# V1 Release Report

Date: 2026-05-10

## Executive Summary

Tautest is close to v1 public launch. The npm packages are buildable, packable, smoke-testable, and documented. The GitHub Action package builds a committed `dist/index.js` bundle and passes local action smoke testing.

Release status: **release candidate with two launch gates**.

Launch gates:

- **Live GitHub Action PR smoke**: run the action on a real same-repo pull request to verify sticky comment create/update, artifact upload, and cache restore/save in GitHub-hosted Actions.
- **Standalone action mirror/tag**: mirror `packages/github-action` to `tautest-dev/tautest-action`, commit `dist/`, and create the moving `v1` tag.

Added release support:

- `.github/workflows/release-readiness.yml` runs lint, typecheck, tests, build, production audit, npm pack smoke, clean install smoke, and a local GitHub Action smoke.

## Release Readiness Audit

| Check | Status | Notes |
| --- | --- | --- |
| `pnpm lint` | PASS | Type/lint checks passed across packages and examples. |
| `pnpm typecheck` | PASS | Core, CLI, and GitHub Action typecheck passed. |
| `pnpm test` | PASS | Core, CLI, GitHub Action, Vitest basic, Vitest React, and Jest basic tests passed. |
| `pnpm build` | PASS | Core and CLI build with `tsup`; GitHub Action bundles with esbuild. |
| `pnpm audit --prod` | PASS | No known production vulnerabilities after updating Actions toolkit dependencies. |
| Pack smoke | PASS | `@tautest/core@1.0.0` and `tautest@1.0.0` tarballs generated with `dist`, `README.md`, and `LICENSE`. |
| Clean install smoke | PASS | Installed packed tarballs in a temp project; `tautest --version` returned `1.0.0`; `@tautest/core` import worked. |
| Example smoke | PASS | `examples/vitest-basic`, `examples/vitest-react`, and `examples/jest-basic` test suites pass. |
| GitHub Action local smoke | PASS | Local run produced `score=75`, `verdict=MIXED`, `surviving=1`, and `report-path`. |
| Release readiness workflow | PASS | `.github/workflows/release-readiness.yml` codifies the local audit checks for CI/manual runs. |
| GitHub Action live PR smoke | BLOCKED | Not executable in this local environment; must be verified before public `v1` tag. |

## Package Readiness

| Package | Status | Notes |
| --- | --- | --- |
| `@tautest/core` | READY | Public package metadata, ESM export, types, `files`, README, and optional Stryker runner peers are in place. |
| `tautest` | READY | Public CLI package metadata, `bin.tautest`, exports, types, `files`, README, and dependency on `@tautest/core` are in place. |
| `@tautest/github-action` | READY FOR MIRROR | Private workspace package, action bundle, `action.yml`, local smoke, and docs are ready; publish as separate action repo/tag, not npm. |

Package notes:

- `tautest` packed dependency resolves `@tautest/core` to `1.0.0`, so publish order matters.
- Publish `@tautest/core` first, then `tautest`.
- Root package remains private and should not be published.
- `package-lock.json` was removed; pnpm is the workspace package manager.
- `LICENSE` is included in npm tarballs.

## npm Release Plan

1. Confirm clean working tree except intended release changes.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm audit --prod`.
4. Pack locally:
   - `pnpm --filter @tautest/core pack`
   - `pnpm --filter tautest pack`
5. Publish core:
   - `pnpm --filter @tautest/core publish --access public --tag latest`
6. Verify core install from npm.
7. Publish CLI:
   - `pnpm --filter tautest publish --access public --tag latest`
8. Verify:
   - `npx tautest@1.0.0 --version`
   - clean Vitest example install and `tautest doctor`

No changesets workflow exists yet. For v1, release notes are maintained in `docs/RELEASE_NOTES_V1.md`; add Changesets in v1.1.

## GitHub Action Release Plan

Current state:

- `packages/github-action/action.yml` targets `runs.using: node20`.
- `packages/github-action/dist/index.js` is generated and not ignored.
- Action dependency audit is clean.
- Local action smoke passed.
- A release-readiness workflow exists for repeatable CI/manual validation.
- README and docs use `tautest-dev/tautest-action@v1`.

Release steps:

1. Mirror `packages/github-action` into `tautest-dev/tautest-action`.
2. Commit `action.yml`, `dist/index.js`, `dist/index.js.map`, source, tests, and docs.
3. Create immutable tag `v1.0.0`.
4. Create or move major tag `v1` to the `v1.0.0` commit.
5. Run a same-repo PR smoke with:
   - `contents: read`
   - `pull-requests: write`
   - `actions/checkout` with `fetch-depth: 0`
6. Verify sticky comment create, sticky comment update, artifact upload, and cache restore/save.
7. Run `.github/workflows/release-readiness.yml` manually before moving the `v1` tag.

## Security Audit

Status: **PASS with documented operational caveats**.

What is covered:

- GitHub token is masked via `core.setSecret`.
- The action does not log secrets or environment dumps.
- PR comment dynamic fields are sanitized before markdown rendering.
- `working-directory` is constrained to stay inside `GITHUB_WORKSPACE`.
- Commands are executed with argument arrays, not interpolated shell strings.
- Package manager input is enum-validated.
- `install` defaults to `false`; when enabled, installs use frozen/lockfile-oriented commands.
- `pull_request_target` risk is documented; examples use `pull_request`.
- `pnpm audit --prod` reports no known production vulnerabilities.

Remaining caveats:

- Running tests and Stryker on pull request code is code execution by design. Keep minimal permissions and avoid `pull_request_target` for untrusted PR code.
- Fork PRs may not have permission to create comments; the action degrades to warnings.
- Live artifact/cache behavior must still be verified in GitHub-hosted Actions.

## README and Docs

Status: **READY**.

Created or polished:

- `README.md`
- `docs/QUICKSTART.md`
- `docs/HOW_IT_WORKS.md`
- `docs/GITHUB_ACTION.md`
- `docs/CLI_REFERENCE.md`
- `docs/CONFIG_REFERENCE.md`
- `docs/CLAUDE_CODE_WORKFLOW.md`
- `docs/CURSOR_WORKFLOW.md`
- `docs/CODEX_WORKFLOW.md`
- `docs/TROUBLESHOOTING.md`
- `docs/LIMITATIONS.md`
- `docs/ROADMAP.md`
- `docs/DEMO_SCRIPT.md`
- `docs/RELEASE_NOTES_V1.md`
- `docs/LAUNCH_CONTENT.md`
- `.github/workflows/release-readiness.yml`

Docs clearly state that Tautest is not a mutation engine and uses StrykerJS as infrastructure.

## Launch Content

Status: **READY TO EDIT FOR VOICE**.

Drafts live in `docs/LAUNCH_CONTENT.md`:

- Hacker News post
- Reddit post
- dev.to post
- Twitter/Bluesky short posts
- GitHub release notes pointer

Demo video flow lives in `docs/DEMO_SCRIPT.md`.

## V1 Acceptance Checklist

| Requirement | Status | Notes |
| --- | --- | --- |
| 3 example repos work | PASS | Vitest basic, Vitest React, Jest beta. |
| Prompt eval sufficient | PASS | Phase 4 eval documented in `docs/PHASE_4_PROMPT_EVAL.md`. |
| GitHub Action PR comment works | BLOCKED | Unit/local smoke pass; real PR create/update still required. |
| Docs complete | PASS | Full docs structure exists. |
| Known limitations written | PASS | `docs/LIMITATIONS.md` and README limitations. |
| Install safe | PASS | Package install smoke passed; action install defaults to false. |
| Uninstall safe | PASS | No destructive uninstall command; users remove packages/config manually. |
| Error messages understandable | PASS | CLI exit codes and doctor checks are documented. |
| npm publish ready | PASS | Publish order must be core first, CLI second. |
| GitHub Action v1 tag ready | BLOCKED | Needs mirror repo and live PR smoke. |

## First 72 Hours After Launch

Watch these issue categories closely:

- Stryker programmatic API failures or runner-specific errors.
- Vitest config, path alias, ESM/CJS, and browser-mode edge cases.
- Jest beta false negatives, config discovery misses, and timeout behavior.
- Git diff range mapping issues around renames, deleted files, generated files, and shallow clones.
- GitHub Action permission failures for forks, Dependabot, and restricted org tokens.
- Runtime complaints on medium and large PRs.
- AI prompt misuse where agents edit production code or add filler tests.
- Package installation issues around `@tautest/core` peer runner dependencies.

## V1.1 Backlog

- Add Changesets or an equivalent release automation.
- Require the release-readiness workflow before moving release tags.
- Add job summary fallback when PR comments are unavailable.
- Harden Jest beta with more fixtures and docs.
- Improve monorepo package selection beyond detect-and-warn.
- Add more path alias and ESM/CJS recipes.
- Add prompt eval automation and regression snapshots.
- Add scheduled dependency audit.
- Add uninstall/cleanup documentation for `tautest init` artifacts.

## Assumptions

- v1 targets Node 20+.
- Vitest is the primary supported runner; Jest is beta.
- Monorepo support remains detect-and-warn in v1.
- The public npm packages will be `@tautest/core` and `tautest`.
- The GitHub Action will be released from a mirrored standalone repository at `tautest-dev/tautest-action`.
- A real GitHub PR runner is required to complete final action comment, artifact, and cache verification.
