---
"@tautest/core": patch
"tautest": patch
---

Respect an explicitly empty Stryker `mutate` list. Tautest now reports a no-op instead of unexpectedly mutation-testing changed source files when the project disables mutation with `mutate: []`.
