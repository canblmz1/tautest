---
"@tautest/core": patch
"tautest": patch
---

Preserve changed-line mutation scope when source hunk content resembles Git file headers. Adding `++ counter;` or removing `-- counter;` no longer changes the parsed file path or skips the changed line.
