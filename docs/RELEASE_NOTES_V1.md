# Tautest v1.0.0 Release Notes

Tautest v1 is the first public release candidate for PR-focused mutation testing workflows on top of StrykerJS.

## Highlights

- Changed-line mutation testing from Git diffs.
- Vitest-first CLI workflow.
- Jest beta support.
- Markdown, JSON, and terminal reports.
- Deterministic AI test-fix prompts for Claude Code, Cursor, Codex, and humans.
- GitHub Action with sticky PR comments, artifacts, and cache support.
- Three examples:
  - Vitest basic
  - Vitest React
  - Jest basic beta

## Packages

- `tautest`
- `@tautest/core`

## GitHub Action

The action can be mirrored to:

```text
tautest-dev/tautest-action
```

Use a moving `v1` tag plus immutable `v1.0.0` tag.

## Known Limitations

- Tautest uses StrykerJS; it is not a mutation engine.
- Jest support is beta.
- Monorepo support is detect-and-warn level in v1.
- Runtime depends on project test speed.
- GitHub PR comments depend on token permissions.
