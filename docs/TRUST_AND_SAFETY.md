# Trust and Safety

Tautest is local-first tooling for changed-line mutation testing. It is intentionally not a hosted service, generic AI evaluation platform, or StrykerJS replacement.

## What Runs Locally

Tautest reads the Git diff, generates a StrykerJS mutation scope, runs StrykerJS in the current project, and writes reports under `.tautest/`.

Generated files:

- `.tautest/report.md`
- `.tautest/report.json`
- `.tautest/fix-prompt.md`
- `.tautest/mutation.json`
- `.tautest/stryker-incremental.json` when cache is enabled

These files may contain source snippets, mutant replacements, test names, and file paths. Treat them as project data.

## What Tautest Does Not Do

- Tautest does not call LLM APIs.
- Tautest does not send source code to hosted AI services.
- Tautest does not upload reports outside GitHub Actions artifacts.
- Tautest does not mutate production files on disk.
- Tautest does not automatically apply agent-written fixes.

The fix prompt is deterministic Markdown. Developers choose whether to paste it into Claude Code, Cursor, Codex, OpenCode, or use it manually.

## GitHub Actions Boundary

The action runs project tests and StrykerJS on checked-out pull request code. That is code execution by design.

Use the least-privilege workflow shape:

```yaml
on:
  pull_request:

permissions:
  contents: read
  pull-requests: write
```

Use `actions/checkout` with full history:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

Avoid `pull_request_target` for untrusted code unless you have a separate, reviewed security design. Running untrusted PR code with write credentials is dangerous.

## Token Handling

The GitHub Action masks `github-token` before use. The token is used only for sticky pull request comments.

If comment permissions are unavailable, the action should still provide useful feedback through the job summary and artifacts.

## Markdown Safety

PR comments and job summaries include dynamic data from mutation reports. The action sanitizes dynamic markdown before writing GitHub output.

Still, treat report content as untrusted when consuming `.tautest/report.json` in custom automation.

## CI Cost Controls

Mutation testing can be expensive. Keep CI predictable with:

```yaml
with:
  max-files: 5
  max-changed-lines: 25
```

Use local dry-run preview before raising budgets:

```bash
tautest run --base origin/main --dry-run
```

## Safe Agent Use

Agent prompts must stay test-only.

Accept an agent patch only when:

- production code is unchanged;
- existing assertions are not weakened;
- no tests are skipped or deleted;
- no new dependency is added;
- normal tests pass;
- Tautest score improves, remains strong, or the listed mutant is killed.

If the agent finds a real production bug, stop and handle that as a separate implementation change.

## Reporting Security Issues

See [../SECURITY.md](../SECURITY.md) for vulnerability reporting.
