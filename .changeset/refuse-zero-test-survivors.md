---
"@tautest/core": patch
"tautest": patch
---

Refuse to score a Stryker run in which surviving mutants executed zero tests. `@stryker-mutator/vitest-runner` 9.x and 10.0.0 report every mutant as Survived on Vitest 5 without running a single test (stryker-mutator/stryker-js#6210). Tautest scored that as WEAK 0% and failed the pull request; it now stops with `STRYKER_ZERO_TESTS_EXECUTED` (exit code 12) and names the known cause.
