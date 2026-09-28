---
"tautest": patch
"@tautest/core": patch
---

Show `tautest doctor` only for missing-module or zero-test compatibility errors, with a missing-module hint that also covers generated project imports. Initial-test-run and out-of-memory failures keep their specific guidance without an unrelated dependency hint; timeouts point to the supported Stryker timeout settings.
