StarUML extension-port pilot

Tautest-maintainer-run experiment on hqqw2h-lgtm/staruml-mcp at
3a58d812d7c52b559ac920bf17fc0fa1cf19dcf3. This is not external adoption.

The proposed patch adds only two client tests, asserting the default and
custom extension API ports. Production code and dependency files stay intact.
The mutation scope is exactly src/staruml-client.ts:38-38, not a whole-file or
repository-wide score. Original client tests run before applying the patch.
The helper requires exact-mutant verification and checks that a newly added
test is named among the killing tests, then repeats the same mutation scope.

Use a disposable clone: local Stryker/Vitest configs and .tautest outputs are
written by this helper. Node 22 and proof tool versions are pinned by CI and
the lockfile. No lifecycle scripts or AI service are used in the proof.

  git clone https://github.com/hqqw2h-lgtm/staruml-mcp.git project
  git -C project checkout --detach 3a58d812d7c52b559ac920bf17fc0fa1cf19dcf3
  npm --prefix project ci --ignore-scripts --no-audit --no-fund
  pnpm --dir scripts/adoption-proof/staruml install --frozen-lockfile --ignore-scripts
  node scripts/adoption-proof/staruml/prove-port.mjs project

The included patch and reports containing project source are covered by its
MIT license, retained as PROJECT-LICENSE. The public workflow retains logs,
reports and verification results. Its success is not a maintainer endorsement
or evidence that an external developer has used Tautest.
