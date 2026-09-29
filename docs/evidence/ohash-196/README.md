# unjs/ohash#196: accepted corpus row, reproduced with the corpus harness

**Date:** 2026-09-29. This is the accepted row for the failure ledger in [docs/oss-adoption-corpus.md](../../oss-adoption-corpus.md). It was produced by one run of `scripts/oss-adoption-corpus-run.mjs`, the harness from the same change, with the published Tautest 2.0.3 installed inside the cloned project.

## Command

The SHAs come from `gh api repos/unjs/ohash/pulls/196 --jq .base.sha` and `.head.sha`.

```bash
node scripts/oss-adoption-corpus-run.mjs \
  --repo=https://github.com/unjs/ohash.git --pr=196 \
  --base=2c6e231ccfc229ab90a3e026635984f1ccd89b1d \
  --head=a65d622c4c390061baf408b0ecdf4d5031753c69 \
  --runner=vitest --package-manager=pnpm --tautest-version=2.0.3 --build --repeat=2
```

It ran in a disposable `node:22-bookworm` container with `corepack enable`, so the project's own pnpm (11.2.2) was used.

## Environment and toolchain

From [environment.txt](environment.txt) and `toolchain` in [result.json](result.json):

| | |
| --- | --- |
| OS | Debian GNU/Linux 12 (bookworm), WSL2 kernel 6.6.87.2, 8 CPUs |
| Node / pnpm | 22.23.3 / 11.2.2 |
| Install | `pnpm install --frozen-lockfile` succeeded (`installMode: frozen-lockfile`) |
| Tautest / core | 2.0.3 / 2.0.3, resolved from the clone's `node_modules` |
| Stryker / vitest-runner | 10.0.0 / 10.0.0 |
| Vitest | 4.1.7, the project's own; the runner loads the same copy |

## Result

| Step | Result |
| --- | --- |
| tracked files changed by setup | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, all restored before measuring |
| PR files | `src/utils/diff.ts`, `test/utils.test.ts` |
| normal suite | 75 passed, twice |
| Tautest run 1 | 8 mutants: 5 killed, 3 timeout; 100% |
| direct Stryker, Tautest's effective config, `.stryker-tmp-direct` | the same 8 mutants with the same statuses |
| Tautest run 2 | same mutate scope; the same 8 statuses |
| harness status | `ok`, no step failures |

## Files

- [result.json](result.json): the harness's full result row.
- [stryker.config.json](stryker.config.json): the direct Stryker config.
- [corpus-run-1.json](corpus-run-1.json), [corpus-run-2.json](corpus-run-2.json) and [stryker-direct-report.json](stryker-direct-report.json): the raw Stryker reports. The per-file `source` text is removed, since the frozen SHA reproduces it; every mutant and test field is verbatim.

Timings in `result.json` are single samples on a shared machine and are not an overhead estimate.
