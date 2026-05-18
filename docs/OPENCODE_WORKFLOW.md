# OpenCode Workflow

1. Generate an OpenCode-oriented prompt:

```bash
tautest run --base origin/main --prompt-style opencode
tautest prompt --style opencode
```

2. Paste `.tautest/fix-prompt.md` into OpenCode.
3. Keep the edit scope to test files.
4. Reject changes that:
   - edit production code
   - remove assertions
   - skip tests
   - add dependencies
   - add broad smoke tests instead of behavior checks

5. Run verification:

```bash
pnpm test
tautest run --base origin/main
```

The prompt is deterministic Markdown. Tautest does not call OpenCode or any LLM API.
