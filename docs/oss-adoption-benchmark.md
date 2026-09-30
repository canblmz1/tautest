# Sprint 2 benchmark: Tautest against direct, full-file and incremental Stryker

**Status: protocol, registered on 2026-09-30 before any measurement.** The results are appended below after the runs. Nothing in this section is changed after the first measurement; departures are listed in an addendum, as in [docs/oss-adoption-corpus.md](oss-adoption-corpus.md).

## Question

Does scoping mutation testing to the lines a pull request changes, with the **published** Tautest, save meaningful time compared with what a maintainer would otherwise run, and on which pull requests does it not?

This is the runtime half of [docs/KILL_CRITERIA.md](KILL_CRITERIA.md): "Runtime is not meaningfully better than a normal StrykerJS run on small PRs", and the hard stop benchmark, "Tautest cannot complete a changed-line mutation run with useful output in under 10 minutes or under 50% of the equivalent full-file/full-project mutation run, whichever is more forgiving".

## Corpus

The ten **measured** rows of [docs/oss-adoption-corpus.md](oss-adoption-corpus.md), at their frozen base and head SHAs, with the harness options that produced them ([rows.json](evidence/benchmark/rows.json)):

| Row | Runner, package manager |
| --- | --- |
| unjs/ohash#196, #151, #195 | Vitest, pnpm (#151 and #195 exclude `test/bundle.test.ts` from the mutation runs only) |
| unjs/defu#156, unjs/destr#136 | Vitest, pnpm |
| radashi-org/radashi#486, #485, #481 | Vitest, pnpm |
| pmndrs/zustand#3469 | Vitest, pnpm (the project's `minimumReleaseAge` is waived for the Tautest packages only) |
| moment/luxon#1787 | Jest, npm, Stryker 9.6.1, `TZ=America/New_York` |

Not benchmarked, because they are not valid corpus rows: zustand#3511 (no mutants), luxon#1790 (statuses change between runs, in direct Stryker too) and cli-testing-library#50 (flaky normal suite).

## What is timed

The published **`tautest@2.0.5`** (npm `latest` since 2026-09-29), installed into each fresh clone by the corpus harness, with Stryker 10.0.0 (9.6.1 for the Jest row). Seven variants, all on the clone of the row's PR head:

| Variant | What runs |
| --- | --- |
| `tautest` | `tautest run --base <base>` |
| `direct-matched` | Stryker with Tautest's effective config on the same line ranges. The gap to `tautest` is the wrapper overhead. |
| `direct-defaults` | Stryker with its own defaults on the same line ranges, so `vitest.related` / `jest.enableFindRelatedTests` is on. Tautest turns both off on purpose; this is the out-of-the-box behaviour. |
| `full-file` | Tautest's effective config on the whole changed production files: what running Stryker on the changed files costs. |
| `incremental-cold` | `full-file` with `incremental: true` and no incremental file. |
| `incremental-warm` | `full-file` with `incremental: true`, starting from the incremental file of a run at the **PR base**: what a cache from the base branch holds. Run only where the changed files exist at the base. |
| `incremental-rerun` | `full-file` with `incremental: true`, starting from the incremental file of a run at the PR head itself: the best case. |

"Tautest's effective config" is the Stryker configuration Tautest itself passes (`coverageAnalysis: perTest`, `disableTypeChecks`, `timeoutMS: 5000`, `timeoutFactor: 1.5`, `vitest.related: false` or `jest.enableFindRelatedTests: false`, `incremental: false`, default concurrency), read from Tautest's own raw report and reused for every variant except `direct-defaults`. The exact config of every variant is kept in `bench/configs/`.

## Environment

One machine, one container at a time. The container is `node:22-bookworm` in Docker Desktop's WSL 2 virtual machine (8 CPUs, 7.6 GiB), on a Windows 11 laptop (Intel Core i5-11300H, 8 logical CPUs, 15.8 GiB) on AC power with the Balanced power plan. Each row runs in a disposable container with `corepack enable`, so the project's own package manager is used; the clone lives inside the container. The versions of Node, the OS and the image are recorded per row (`container-environment.txt`, `host-docker.txt`).

This is **not an isolated benchmark host**: the laptop stays in normal use, and another idle container (a Zabbix proxy) keeps running. The host's CPU is sampled every 30 seconds while the containers run (`host-cpu.log`) so that a row measured next to a busy host can be told apart. A hosted CI runner is a different, usually slower, machine; absolute times here are not CI times, and the ratios are the transferable part.

## Procedure

1. **Validation.** The harness must give status `ok` on the row: the normal suite passes twice, Tautest and direct Stryker agree mutant for mutant, and a repeated Tautest run agrees. A row that is not `ok` is reported and not timed.
2. **Caches.** The base cache (for `incremental-warm`) and the head cache (for `incremental-rerun`) are built once, before the rounds.
3. **Rounds.** Every round runs each variant once. The order is a cyclic Latin square: round *r* starts the variant list at position *r*, so over seven rounds every variant runs in every position once, and the next seven rounds run the list reversed. A 5 second cooldown separates runs. The order of every round is kept in `bench.json`.
4. **How many rounds.** Up to 7, at least 3; after the third round, stop as soon as the next round would exceed 45 minutes of measuring. A row that stops early has fewer samples and an order that is not fully balanced; its *n* is shown.
5. **Timeouts.** A run is stopped after 20 minutes and counted as 20 minutes, a lower bound, and is shown as censored. A variant that times out in two rounds is not run again.
6. **CI budget.** A run over 10 minutes is over budget, the figure in the kill criteria.

## Statistics

- Median and 90th percentile (nearest rank: with fewer than ten samples the 90th percentile is the slowest sample), minimum and maximum, and *n*.
- Same-round differences, alternative minus Tautest, so slow and fast rounds cancel: their median and range, and in how many rounds Tautest was faster.
- **Cold and warm.** Three separate things: (a) the incremental cache states above (none, from the PR base, from the PR head); (b) the first run in a freshly installed clone against the benchmark rounds, from the validation run; (c) the first benchmark round against the later ones.
- **Order.** Every sample as a fraction of its variant's median, averaged by the position it ran in, to show whether running early or late in a round changes the timing.
- **Setup costs** from the validation run: project install, build, Tautest and Stryker install, one normal test run, and the time to build the base and head caches.
- **Mutant match**, first sample of each variant, identified by file, mutator, span and replacement: Tautest against `direct-matched`; `direct-defaults` against `direct-matched`; `full-file` restricted to the changed line ranges against `direct-matched`; each incremental variant against `full-file`. Also the mutant counts of the line-range and full-file scopes.

## The advantage rule

Declared before measuring. On a row, **Tautest has a runtime advantage over an alternative** only if all three hold:

1. the median saving is at least **10 seconds**;
2. Tautest's median is at most **80%** of the alternative's;
3. Tautest is faster in at least **80%** of the same-round pairs.

The opposite, **the alternative is faster**, needs a median loss of at least 5 seconds, Tautest's median at least 110% of the alternative's, and the alternative faster in at least 80% of the pairs. Everything else is **no clear difference**. A row is published under the verdict the rule gives, including every row where Tautest has no advantage.

## Kill criteria

- **Hard stop benchmark:** a row passes if Tautest's median is under 10 minutes **or** under 50% of the `full-file` median, whichever is more forgiving. Three representative small rows must pass.
- **"Runtime is not meaningfully better than a normal StrykerJS run on small PRs":** answered by the advantage rule against `full-file` (the normal run on the changed files) and against `incremental-warm` (a normal run with a base-branch cache), over the ten rows. `direct-matched` and `direct-defaults` show what the wrapper and its `related: false` choice cost or save.
- The other criteria (report quality, AI prompts, upstream fragility, product message, what early users ask for) are not runtime questions; the recommendation lists what evidence exists for them.

The recommendation is one of **continue**, **narrow** or **stop**, in the terms of [docs/KILL_CRITERIA.md](KILL_CRITERIA.md).

## What this cannot show

Ten small pull requests in six repositories; one laptop, one Linux virtual machine, one Node version; no Windows or macOS rows, no monorepo packages, no Vitest 5, no hosted CI runner. It measures wall time and mutant agreement, not whether the surviving mutants are useful to a maintainer.
