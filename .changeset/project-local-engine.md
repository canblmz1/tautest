---
"@tautest/core": patch
"tautest": patch
---

Resolve Stryker from the target project before using the engine installed beside Tautest. This lets an external npx/global CLI use the project's existing engine for run and verify; report-only analysis still needs no engine. Keep CLI and core versions aligned.
