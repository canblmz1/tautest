---
'@tautest/core': patch
---

Jest runs now turn off Stryker's `jest.enableFindRelatedTests`, matching the existing `vitest.related: false`. Related-test selection runs only the tests Jest can trace to the mutated file, which can miss tests that reach it indirectly and turn killable mutants into false survivors; on moment/luxon it found no test at all, so Stryker stopped with `No tests were executed`. Stryker's initial run now executes the whole Jest suite, and per-test coverage still limits which tests each mutant runs. A `stryker.userConfig.jest.enableFindRelatedTests: true` is overridden and reported.
