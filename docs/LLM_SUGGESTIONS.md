# Optional LLM Suggestions

Tautest remains deterministic and local-first by default. The normal flow writes `.tautest/fix-prompt.md` and does not call any LLM.

`tautest prompt --suggest` adds an explicit opt-in suggestion artifact for teams that already have an approved provider wrapper.

## Provider Contract

The first supported provider is `external-command`.

- Tautest sends the generated prompt on stdin.
- The command writes a Markdown suggestion on stdout.
- Non-zero exit codes fail the CLI command.
- Tautest writes the suggestion to `.tautest/llm-suggestion.md` unless `--suggestion-out` is provided.
- The artifact includes prompt provenance: provider, optional model, SHA-256, byte count, redaction status, and timestamp.
- Tautest never applies the suggestion automatically.

## One-Off Usage

```bash
tautest prompt --from .tautest/report.json \
  --style codex \
  --suggest \
  --provider-command node \
  --provider-arg scripts/tautest-llm-provider.mjs \
  --model internal-wrapper
```

The wrapper script can call whichever provider your team permits. Keep credentials inside the wrapper's environment and do not print them.

## Config Usage

```ts
import { defineConfig } from '@tautest/core';

export default defineConfig({
  llm: {
    enabled: true,
    provider: 'external-command',
    command: 'node',
    commandArgs: ['scripts/tautest-llm-provider.mjs'],
    model: 'internal-wrapper',
    redact: true
  }
});
```

Then run:

```bash
tautest prompt --from .tautest/report.json --style codex --suggest
```

## Redaction

Redaction is enabled by default. It masks common token and secret patterns before the prompt reaches the external command:

- provider token shapes such as `sk-...`, `ghp_...`, and `npm_...`;
- bearer tokens;
- private key blocks;
- environment assignments such as `OPENAI_API_KEY=...`;
- object properties such as `apiToken: "..."`.

Use `--no-redact` only for a trusted local wrapper where you intentionally want the exact prompt content.

## Review Rules

Treat `.tautest/llm-suggestion.md` as advice, not as a patch:

- review the suggestion before editing files;
- keep accepted changes test-only;
- reject weakened assertions, skipped tests, threshold changes, or production rewrites;
- rerun the normal test suite and Tautest before merging.
