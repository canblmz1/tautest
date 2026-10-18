Exact-mutant verification controls

This is a maintainer-run experiment with published Tautest 2.1.1 on a frozen
TriAD Address fixture. It tests three outcomes for the same original survivor:

1. A new test passes normally but does not catch the target: not-verified.
2. The target is killed by another file: not-verified for the selected file.
3. A new boundary-test file is the executed killer: verified.

The initial report is retained from the original public TriAD reproduction.
Its source must match the frozen project byte for byte. Every verification
uses the original mutant id and exact file/location/mutator/replacement. Each
fresh raw report is inspected for the actual target status and killing tests.
The helper checks the normal suites independently and requires positive test
execution. Production source and the original report must stay unchanged.

Attribution is at FILE granularity. A selected file that mixes older and new
tests does not prove a new individual test killed a mutant. This proof puts
the positive tests in a new file and separately checks the killing test name.
It does not measure an agent's output quality or establish a whole-project
mutation score, and it is not evidence of external Tautest adoption.

Run in a disposable Linux clone with Node 22:

  git clone https://github.com/Thang4869/TriAD-Backend.git project
  git -C project checkout --detach 7e41358c9936186d5469437584845335ec255ad1
  npm --prefix project ci --ignore-scripts --no-audit --no-fund
  pnpm --dir scripts/adoption-proof/verification-controls install --frozen-lockfile --ignore-scripts
  node scripts/adoption-proof/verification-controls/prove-controls.mjs project

The helper writes disposable local Stryker/Vitest configuration, two new test
files and .tautest outputs. It does not change the package manifest, contact
maintainers, evaluate an external skill, or call an AI service. All tool
versions are pinned, and project source/report snippets retain the project's
MIT license in PROJECT-LICENSE. GitHub Actions retains full logs and reports.
