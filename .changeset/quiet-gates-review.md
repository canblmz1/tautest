---
"@tautest/core": patch
"tautest": patch
---

Keep review warnings neutral when no mutation threshold was evaluated, including imported `analyze` reports, instead of claiming "Threshold passed" or new patch coverage. Mirror the guidance in the GitHub Action. Explicit thresholds, including zero, retain their existing behavior; scores, mutant states, verdicts, JSON contracts and exit codes are unchanged.
