---
"@tautest/core": major
"tautest": major
---

Run the project's own Stryker instead of a bundled one. `@stryker-mutator/core` and `@stryker-mutator/api` are now peer dependencies accepting 9.6.1 or 10.x (like the runners already were), so a project on Stryker 10 no longer runs a nested Stryker 9.6.1 next to its 10.0.0 runner. `tautest init` adds Stryker 10 to new projects. Projects must install `@stryker-mutator/core` themselves; the quickstart and `tautest init` already do.
