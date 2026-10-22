---
"tautest": patch
"@tautest/core": patch
---

Load the selected Vitest or Jest Stryker runner explicitly during verification when no plugin list is configured. This prevents pnpm installations from failing to find an installed runner through Stryker's default plugin discovery, while preserving explicit plugin configuration and verification checks.
