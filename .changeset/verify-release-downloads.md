---
"tautest": patch
"@tautest/core": patch
---

Verify both exact published package versions can be downloaded with matching registry integrity before marking the main release workflow successful. Retry temporary registry propagation failures within a bounded check; retain the existing fail-closed publish decision and never republish from verification.
