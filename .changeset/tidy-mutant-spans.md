---
"@tautest/core": patch
"tautest": patch
---

Respect the exclusive end column on its own line when extracting multiline mutant originals. Reports and test-fix prompts no longer include code after the mutant's source span. Single-line extraction and trimming are unchanged.

Review groups whose original text is corrected receive new group IDs. Existing manual decisions are not transferred to those groups; review them again after reimporting the report.
