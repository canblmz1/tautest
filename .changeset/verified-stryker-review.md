---
"tautest": minor
"@tautest/core": minor
---

Analyze existing raw Stryker JSON reports without changing the project's mutation setup. Group actionable mutants by source expression and record manual review decisions that expire when the report or project files change, preserving raw statuses and scores.

Add sandboxed test-fix verification with an execution budget. A successful result requires a passing initial suite and an executed killing test in the selected candidate file for the exact original mutant; timeouts and incomplete runs never count as verified fixes.
