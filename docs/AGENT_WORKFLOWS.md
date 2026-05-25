# Agent Workflow Packs

Tautest generates deterministic Markdown prompts for agents and humans. It does not call Claude, Cursor, Codex, OpenCode, or any LLM API by default.

Use these workflow packs when a PR has passing normal tests but Tautest reports surviving mutants on changed production lines.

## Core Loop

1. Run Tautest on the PR diff.
2. Open `.tautest/fix-prompt.md`.
3. Give the prompt to an agent or use it as a human checklist.
4. Add or strengthen tests only.
5. Run the normal test suite.
6. Run Tautest again.
7. Accept the patch only when the listed mutant is killed or the mutation score stays strong.

```bash
tautest run --base origin/main
pnpm test
tautest run --base origin/main
```

## Prompt Styles

| Agent or reviewer | Command |
| --- | --- |
| Human reviewer | `tautest run --base origin/main --prompt-style human` |
| Claude Code | `tautest run --base origin/main --prompt-style claude-code` |
| Cursor | `tautest run --base origin/main --prompt-style cursor` |
| Codex | `tautest run --base origin/main --prompt-style codex` |
| OpenCode | `tautest run --base origin/main --prompt-style opencode` |

You can also regenerate a prompt from an existing report:

```bash
tautest prompt --from .tautest/report.json --style codex
```

If your team has an approved provider wrapper, you can explicitly request a suggestion artifact:

```bash
tautest prompt --from .tautest/report.json --style codex --suggest --provider-command node --provider-arg scripts/tautest-llm-provider.mjs
```

This writes `.tautest/llm-suggestion.md` with prompt provenance and redaction metadata. It does not apply the suggestion.

## Acceptance Rules

Accept an agent patch only when all of these are true:

- Production code is unchanged.
- New or edited tests check concrete behavior, not snapshots or filler assertions.
- Existing assertions were not weakened or removed.
- No test was skipped, marked todo, or deleted.
- No new dependency was added.
- The normal test suite passes.
- Tautest score improves, remains strong, or the listed surviving mutant is killed.

## Rejection Rules

Reject and reprompt when the patch:

- changes implementation to satisfy a mutant;
- adds broad smoke tests without checking the missing behavior;
- adds `expect(true).toBe(true)`-style filler;
- changes thresholds instead of improving tests;
- deletes existing tests;
- treats a real production bug as a silent test-only task.

If the agent finds a real production bug, stop the workflow and handle the bug explicitly in a separate change.

## Claude Code Pack

```bash
tautest run --base origin/main --prompt-style claude-code
```

Give Claude Code the full `.tautest/fix-prompt.md` file. Ask it to keep the patch test-only and to run the validation loop before finishing.

Detailed workflow: [CLAUDE_CODE_WORKFLOW.md](CLAUDE_CODE_WORKFLOW.md)

## Cursor Pack

```bash
tautest run --base origin/main --prompt-style cursor
```

Paste `.tautest/fix-prompt.md` into Cursor chat with the changed test files open. Review the diff before accepting edits.

Detailed workflow: [CURSOR_WORKFLOW.md](CURSOR_WORKFLOW.md)

## Codex Pack

```bash
tautest run --base origin/main --prompt-style codex
```

Give Codex the prompt and ask it to inspect nearby tests, make the smallest test-only patch, and run verification.

Detailed workflow: [CODEX_WORKFLOW.md](CODEX_WORKFLOW.md)

## OpenCode Pack

```bash
tautest run --base origin/main --prompt-style opencode
```

Paste `.tautest/fix-prompt.md` into OpenCode and require a test-only patch plus verification output.

Detailed workflow: [OPENCODE_WORKFLOW.md](OPENCODE_WORKFLOW.md)

## CI Pairing

For CI, pair agent prompts with the GitHub Action comment:

1. PR comment shows the top surviving mutants.
2. Developer opens the generated artifact or local `.tautest/fix-prompt.md`.
3. Agent writes tests only.
4. CI reruns Tautest and updates the sticky comment.

This keeps the project local-first and CI-friendly while still giving agents enough context to make useful test patches.
