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
