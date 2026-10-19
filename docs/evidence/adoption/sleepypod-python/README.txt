Sleepypod Python prerequisite: bounded reproduction

Public upstream failure: https://github.com/sleepypod/core/actions/runs/39213449027
Frozen source: d0f5c7690c37850886fdd4449319ff8dfee780c8
Passing diagnostic: https://github.com/canblmz1/tautest/actions/runs/39241180276
Recipe: scripts/adoption-proof/sleepypod-python/prove.mjs
Workflow: .github/workflows/sleepypod-python-proof.yml

The original two integration files pass 18 tests in a normal checkout with
Python 3.10 and its locked dependencies. A Stryker dry run using the original
configuration fails copying the checkout's .venv/lib64 directory symlink.
Ignoring **/.venv/** avoids that copy but reproduces the original missing
interpreter ENOENT. Keeping that exclusion and using the following Stryker
buildCommand creates a fresh environment in the sandbox and passes all 18:

  uv sync --directory modules/piezo-processor --locked --no-install-project

The runner must have Python 3.10 and uv available, like upstream normal CI.
Stryker 9.6.1 invokes this command without a shell. A cd/&& command fails.

Scope: one instrumented file (raw-inspection-child.ts), two integration test
files, dryRunOnly true. This is not a completed six-shard mutation campaign,
a full-project pass, a mutant kill, hardware validation, or external adoption.
Production source and original tests were unchanged, checked by SHA-256.
Upstream source remains in its original AGPL-3.0 repository, not vendored here.

The first diagnostic failed at the directory symlink, and the second at a
shell-only cd command. Neither is represented as a successful repair.
