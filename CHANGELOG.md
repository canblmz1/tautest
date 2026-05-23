# Changelog

## 1.4.0 - 2026-05-23

### Added

- Added `tautest demo --run` to execute the local Vitest demo flow end to end and restore fixture files afterward.
- Added richer no-op guidance for runs with no changed production source files, including excluded file reasons and machine-readable `guidance`.

### Changed

- `tautest demo` now points directly to the runnable demo path before listing manual steps.
- CLI no-op output now explains docs-only, test-only, deleted-only, binary-only, and non-source changes more clearly.

## 1.3.0 - 2026-05-23

### Added

- Added `tautest demo` to show the local passing-tests-but-surviving-mutant demo path.
- Added cache restore/save visibility to the GitHub Action job summary.

### Fixed

- GitHub Action CLI fallback now prefers a local `node_modules/.bin/tautest` binary and respects the detected package manager instead of assuming `pnpm`.
- GitHub Action diagnostics now run the version check through the same resolved CLI command path used by the failed run.

### Changed

- Refreshed package metadata keywords for changed-line mutation testing, test quality, GitHub Actions, and AI-assisted testing discovery.

## 1.2.0 - 2026-05-23

### Added

- Release workflow now derives npm package versions from the pushed semver tag before packing and publishing.

### Changed

- Prepared the repository positioning, trust/safety, and AI-agent workflow documentation for the v1 launch line.

## 1.1.0 - 2026-05-18

### Added

- GitHub Action job summary output for mutation score and top surviving mutants.
- OpenCode prompt style for deterministic test-fix prompts.

### Fixed

- Release Readiness package smoke now discovers packed tarballs without hardcoding the package version.

## 1.0.0 - 2026-05-10

### Added

- PR-focused mutation testing workflow over StrykerJS.
- Changed-line mutation scoping from git diff.
- Vitest support.
- Jest beta support.
- Markdown, JSON, terminal reports.
- AI fix prompt generation.
- GitHub Action with sticky PR comments.
- Artifact upload and incremental cache handling.

### Notes

- Tautest does not implement a mutation engine; StrykerJS performs mutation testing.
- Monorepo support is detect-and-warn in v1.
- Jest support is beta.
