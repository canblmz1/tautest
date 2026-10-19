---
"tautest": patch
"@tautest/core": patch
---

Import JSON mutation reports up to 1 GiB by streaming reports above 128 MiB and omitting only mutant statusReason diagnostic strings from the analysis. Preserve the original file hash, disclose omissions, retain a 128 MiB budget for remaining data, and reuse that hash for review snapshots without rereading the entire large file.

Keep the core and CLI package versions aligned for the paired release.
