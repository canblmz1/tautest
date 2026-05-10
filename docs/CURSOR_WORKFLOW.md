# Cursor Workflow

1. Generate a Cursor-oriented prompt:

```bash
tautest run --base origin/main --prompt-style cursor
tautest prompt --style cursor
```

2. Paste the prompt into Cursor.
3. Keep the edit scope to test files.
4. Reject changes that:
   - edit production code
   - remove assertions
   - skip tests
   - add snapshots instead of behavior checks
   - add dependencies

5. Run:

```bash
pnpm test
tautest run --base origin/main
```
