---
"@tautest/core": minor
"tautest": minor
---

Respect the project's Stryker `mutate` config when scoping a run. Tautest treated every changed file with a source extension as production code, so build scripts touched by a pull request were mutated, came back NoCoverage, and dragged the score down. When the project has a Stryker config with a `mutate` list, changed files outside it are now excluded and reported as "outside Stryker mutate scope" in dry-run and no-op output. Projects without a `mutate` list keep the previous behavior.
