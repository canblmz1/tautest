---
'@tautest/core': patch
---

`tautest run` no longer stops with exit code 11 (`Expected double-quoted property name in JSON`) when the project's `tsconfig.json` contains comments or trailing commas, as `tsc --init` output and many real projects do. Tautest now reads tsconfig as JSON with comments, and if the file still cannot be parsed it continues without the `baseUrl`/`paths` hints instead of aborting; Stryker and TypeScript read the file themselves.
