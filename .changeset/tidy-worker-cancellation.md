---
"tautest": patch
"@tautest/core": patch
---

Clean up the verify worker's process group on POSIX SIGINT/SIGTERM before preserving signal termination. Windows signal handlers attempt bounded process-tree cleanup with taskkill; native console cancellation remains unverified. Cancelled verification cannot return a successful verification result or be reported as budget exhaustion. Normal completion and budget enforcement are preserved.
