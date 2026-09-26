---
"tautest": patch
---

Treat a run in which Stryker generated no mutants as a no-op instead of a failed threshold. When the changed lines hold no mutable code (comments, imports, declarations), `tautest run` used to report UNKNOWN and exit 1, failing the pull request check. It now exits 2 with status `no-op` and explains why, like a pull request without production changes.
