# Changelog

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
