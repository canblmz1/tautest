---
"tautest": patch
"@tautest/core": patch
---

Make doctor check the Stryker runner for the selected test runner, respecting an explicit testRunner configuration. Missing matching dependencies and unavailable Vitest compatibility checks produce warnings instead of misleading OK checks; existing warning exit behavior and the Vitest 5 error guard are preserved.
