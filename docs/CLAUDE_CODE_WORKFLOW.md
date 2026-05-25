# Claude Code Workflow

1. Run Tautest:

```bash
tautest run --base origin/main --prompt-style claude-code
```

2. Open `.tautest/fix-prompt.md`.
3. Give the full prompt to Claude Code.
4. Ask Claude Code to follow the prompt exactly.
5. Verify:

```bash
pnpm test
tautest run --base origin/main
```

The prompt tells Claude Code not to edit production code, not to weaken assertions, and not to add filler tests.

If Claude Code finds a real production bug, it should stop and report it rather than silently rewriting implementation.

## Optional Suggestion Artifact

For repositories with an approved provider wrapper, you can ask Tautest to create a redacted suggestion artifact:

```bash
tautest prompt --from .tautest/report.json \
  --style claude-code \
  --suggest \
  --provider-command node \
  --provider-arg scripts/tautest-llm-provider.mjs \
  --model internal-wrapper
```

Review `.tautest/llm-suggestion.md` before making any edits. Tautest does not apply agent suggestions automatically.
