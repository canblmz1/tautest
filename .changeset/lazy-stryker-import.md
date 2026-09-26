---
"@tautest/core": patch
"tautest": patch
---

Load Stryker only when a mutation run starts. With Stryker as a peer dependency, package managers that do not install peers (yarn 1, npm with `--legacy-peer-deps`) left it missing and the CLI crashed at startup, even for `tautest --version` and `tautest init`. Those commands and `tautest doctor` now work without Stryker installed, and `tautest run` stops with `STRYKER_MODULE_NOT_FOUND` (exit code 12) instead.
