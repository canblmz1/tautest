---
"@tautest/core": patch
"tautest": patch
---

Sandbox cleanup is now scoped to the run that created it. Each run gives Stryker its own `.stryker-tmp/tautest/run-<pid>-<random>/` directory and removes only that afterwards, so two runs sharing a checkout no longer delete each other's sandbox (2.0.1 removed every `sandbox-*` directory under `.stryker-tmp/tautest`). Run directories left by a process that is no longer alive, for example after Ctrl+C, are removed at the start of the next run, and `.stryker-tmp/` is removed when that leaves it empty. The whole `.stryker-tmp/tautest` root is kept out of Stryker's sandbox copy, so another run's directory is never copied into this one.
