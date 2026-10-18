External CLI / project engine regression, 2026-10-18 UTC

An external npx/global CLI can live outside the target project. In 2.1.1,
changing cwd did not change where ESM looked for @stryker-mutator/core.
The CLI failed even when the target project had a working engine.

Source fix: https://github.com/canblmz1/tautest/pull/43
Version PR: https://github.com/canblmz1/tautest/pull/44
Release: https://github.com/canblmz1/tautest/actions/runs/39170171604
Both PRs passed all 13 applicable checks. All 233 core tests passed locally.

The fixture was a small JavaScript function returning age >= 18. Tests at
20 and 16 passed but missed age > 18. A real Stryker 10 / Vitest 4.1.11 run
produced the retained before report (four Killed, one Survived).

A new, separate test file asserts that exactly 18 is accepted. With the same
original report, source and candidate test:

  published 2.1.1, external CLI-only install: error, exit 12
  published 2.1.2, clean external CLI-only install: verified, exit 0

Neither CLI installation contained Stryker core or its test runner. The
engine and runner were installed only in the target project. The fresh
verification initial suite ran all three tests; the selected candidate
killed the exact boundary mutant. Only the target source lines were replayed,
so the after report contains four mutants, not the original five.

In 2.1.2, execution resolves the project's Stryker first. When none resolves,
the existing co-installed engine fallback remains available. A broken
installed project engine is reported without switching versions silently.
Absolute/relative cwd, an import failure, a missing installed entry and cwd
restoration have regression coverage.

evidence.json records npm versions, public tarball integrity, clean-install
checks and the before/after target result. The retained mutation reports omit
machine-specific config/projectRoot fields; source, mutant and test records
are unchanged. No project-wide quality score is claimed.

This is a maintainer-run regression experiment, not an external user's run
or evidence that adoption increased. Vitest 5 execution remains unsupported.
