#!/usr/bin/env bash
# Controlled-instability experiment for crutchcorn/cli-testing-library#50 (v2 plan, Sprint 1 task 4).
# Disposable clone inside a node:22-bookworm container. Workspace-root setup so the package's
# ancestor tsconfig (../../tsconfig.json) is inside Stryker's sandbox.
set -euo pipefail
: "${BASE:?}" "${HEAD:?}"
cd /work/repo
git checkout -q "$HEAD"
test "$(git rev-parse HEAD)" = "$HEAD"

corepack enable >/dev/null
export CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
pnpm install --frozen-lockfile --reporter=silent
pnpm add -Dw --reporter=silent tautest@2.0.2 @stryker-mutator/core@10.0.0 @stryker-mutator/vitest-runner@10.0.0
# Installing rewrote tracked manifests; restore them so Tautest diffs the PR itself.
git diff --stat -- package.json pnpm-lock.yaml pnpm-workspace.yaml
git checkout -- package.json pnpm-lock.yaml pnpm-workspace.yaml
test -z "$(git status --porcelain --untracked-files=no)" || { git status --short; echo "tracked tree differs from PR head"; exit 1; }

# Experiment-only files, hidden from git so they can never enter Tautest's changed-file set.
cat >> .git/info/exclude <<'EOF'
vitest.stryker-root.config.ts
tautest.config.json
runs/
.tautest/
.stryker-tmp/
reports/
EOF

# Same test options as packages/cli-testing-library/vitest.config.ts, minus coverage and
# typecheck (not supported under Stryker's vitest runner), rooted at the workspace.
cat > vitest.stryker-root.config.ts <<'EOF'
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "packages/cli-testing-library/tests",
    watch: false,
    globals: true,
    setupFiles: ["packages/cli-testing-library/tests/setup.ts"],
  },
});
EOF
mkdir -p runs

{
  echo "os: $(. /etc/os-release; echo "$PRETTY_NAME") $(uname -r)"
  echo "node: $(node -v)  pnpm: $(pnpm -v)  cpus: $(nproc)"
  # tautest's package exports hide package.json, so resolve through node_modules symlinks instead.
  t=$(realpath node_modules/tautest); c=$(realpath "$t/../@tautest/core")
  echo "tautest $(node -p "require(\"$t/package.json\").version") $t"
  echo "tautest -> @tautest/core $(node -p "require(\"$c/package.json\").version") $c"
  for p in @stryker-mutator/core @stryker-mutator/vitest-runner vitest; do
    d=$(realpath "node_modules/$p"); echo "$p $(node -p "require(\"$d/package.json\").version") $d"
  done
} | tee runs/versions.txt
