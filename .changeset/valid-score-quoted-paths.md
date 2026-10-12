---
"@tautest/core": patch
"tautest": patch
---

Exclude runtime-error and compile-error mutants from Stryker's mutation-score denominator while retaining their counts and diagnostics. Runs without valid mutants now retain an undefined score and UNKNOWN verdict.

Decode Git's quoted UTF-8 byte paths and C-style escapes before removing patch prefixes, so non-ASCII source filenames remain in the correct changed-line mutation scope.
