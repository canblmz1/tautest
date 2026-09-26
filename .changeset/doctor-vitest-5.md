---
"tautest": minor
---

`tautest doctor` now reports an error when Vitest 5 is installed with `@stryker-mutator/vitest-runner` 10.0.0 or older. That runner executes no tests for mutants on Vitest 5 (stryker-mutator/stryker-js#6210), so every mutant would come back Survived; doctor suggests pinning `vitest` to `^4` until the runner supports Vitest 5.
