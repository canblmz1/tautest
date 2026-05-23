# Changesets

Use Changesets for user-facing changes that should publish `tautest` and `@tautest/core`.

```bash
pnpm changeset
```

Choose:

- `patch` for fixes, docs shipped in package READMEs, diagnostics, and CI/release hardening.
- `minor` for new CLI flags, report fields, Action inputs, examples, or monorepo beta features.
- `major` for schema-breaking report changes or runner architecture releases.

`@tautest/github-action` is private and intentionally ignored by Changesets. Keep it version-aligned manually only when a release needs that metadata.
