---
"@tautest/github-action": minor
"@tautest/core": minor
"tautest": minor
---

Refactor GitHub Action into focused modules (exec, install, package-manager, preflight); expand test coverage with Jest fixture variants, workspace reliability suites, and report.json schema contract tests; add coverage config to all vitest configs; strengthen Docker build with typecheck+test+build validation; add package-manager smoke matrix (npm, yarn) to release-readiness CI.
