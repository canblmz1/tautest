---
"tautest": minor
"@tautest/core": minor
---

Add an explicit opt-in LLM suggestion flow for generated fix prompts. `tautest prompt --suggest` can send a redacted prompt to a configured external command, write `.tautest/llm-suggestion.md`, and record prompt provenance without applying changes.
