---
'@tautest/core': patch
---

Packages whose `tsconfig.json` extends a file outside the package, such as `"extends": "../../tsconfig.base.json"`, now work from the package root. Tautest 2.0.0 through 2.0.3 ran Stryker in a nested temp directory, but Stryker rewrites those paths assuming its sandbox sits exactly two directories below the project, so Vitest found no tests (`No tests were executed`) or failed with `TSCONFIG_ERROR`. Tautest now uses Stryker's default `.stryker-tmp` temp directory with `cleanTempDir: "always"`: Stryker removes the sandbox it created after every run, including failed runs, and Tautest no longer deletes any files itself. In-place runs keep Stryker's default of preserving the backup after a failure. Leftover `.stryker-tmp/tautest/` directories from 2.0.2 and 2.0.3 can be deleted.

`tautest doctor` now warns when a tsconfig reaches a file outside the package through an `extends` array or an in-package path without `.json`, which Stryker does not rewrite for its sandbox. Stryker's `No tests were executed` error now maps to the no-tests error, whose suggestion points to `tautest doctor`.
