TriAD Address boundary pilot

This is a Tautest-maintainer-run experiment on
Thang4869/TriAD-Backend@7e41358c9936186d5469437584845335ec255ad1.
It is not external adoption and does not close upstream issue #145.

Proposed upstream change: address.test.ts only. It adds two tests: a
500-character normalized address is accepted, and 501 characters are rejected.
No production code, dependencies or CI settings are proposed upstream.

The proof tools are installed separately from the inspected project. The
temporary Stryker/Vitest configs select its existing value-object test file,
then that same file plus the new tests. The reports cover address.ts only.
The script requires the exact inspected revision and checks production source
bytes after execution. It does not run PostgreSQL/Redis integration tests.

Run only in a disposable clone: the helper writes local stryker.config.json,
vitest.tautest-pilot.config.mts, and .tautest outputs. It does not submit a PR,
post messages, use an AI service, or change the project's package manifest.

Reproduction:
  git clone https://github.com/Thang4869/TriAD-Backend.git project
  git -C project checkout --detach 7e41358c9936186d5469437584845335ec255ad1
  npm --prefix project ci --ignore-scripts --no-audit --no-fund
  pnpm --dir scripts/adoption-proof/triad install --frozen-lockfile --ignore-scripts
  Copy address.test.ts to project/tests/unit/shared/value-objects/address.test.ts
  node scripts/adoption-proof/triad/prove-address.mjs project

Use Node 22. Tool versions are pinned in package.json and pnpm-lock.yaml.
The GitHub Actions job runs these steps on Linux and retains raw reports,
portable report copies, initial test output and exact-mutant verification.
The project's source and generated report snippets retain its MIT license
(PROJECT-LICENSE). Never count this maintainer-run reproduction as a user.
