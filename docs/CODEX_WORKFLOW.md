# Codex Workflow

1. Generate a Codex prompt:

```bash
tautest run --base origin/main --prompt-style codex
```

2. Give `.tautest/fix-prompt.md` to Codex.
3. Codex should inspect nearby tests, make a small test-only patch, and run verification.
4. The fix is complete only when:
   - the normal test suite passes
   - Tautest score improves or remains strong
   - the listed surviving mutant is killed

Do not accept production-code rewrites unless the agent explicitly reports a real production bug and you decide to handle that separately.

## Optional Suggestion Artifact

For repositories with an approved provider wrapper, generate a redacted suggestion artifact instead of manually pasting the prompt:

```bash
tautest prompt --from .tautest/report.json \
  --style codex \
  --suggest \
  --provider-command node \
  --provider-arg scripts/tautest-llm-provider.mjs \
  --model internal-wrapper
```

Review `.tautest/llm-suggestion.md` before editing tests. Tautest records prompt SHA-256, redaction metadata, and provider provenance, but it does not apply the suggestion.
