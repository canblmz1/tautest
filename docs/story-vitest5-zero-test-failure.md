# Why Tautest refuses Vitest 5, and what we did about it

Tautest's `doctor` command hard-blocks one specific combination: Vitest 5 with `@stryker-mutator/vitest-runner` 10.0.0 or older. This is a story about why that guard exists, whose bug it actually is, and what we did to help move a fix forward instead of just waiting.

## The bug

If you run StrykerJS with `coverageAnalysis: "perTest"` (StrykerJS's default, and what Tautest uses) on Vitest 5, every mutant that has specific covering tests comes back **Survived** — not because the tests are weak, but because the runner never actually executes them. The reported mutation score can collapse to 0%.

The root cause, precisely diagnosed by `zeilhofe-xp360` in [stryker-mutator/stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210): Vitest 5 changed how it matches `testNamePattern` against a test. Before 5.0, a test `it("returns senior")` inside `describe("classify")` was matched against the plain-space-joined string `"classify returns senior"`. [Vitest 5 changed this to join with `' > '`](https://vitest.dev/guide/migration/) instead. `@stryker-mutator/vitest-runner` still builds its filter pattern with a plain space, so on Vitest 5 the pattern matches nothing, the mutant run selects zero tests, and Stryker reports the mutant as surviving a test suite that never actually ran.

This is not a Tautest bug and not something Tautest's own code can fix — it lives entirely inside `@stryker-mutator/vitest-runner`.

## What Tautest does about it

Two defenses, neither of which fixes the underlying bug:

1. `tautest doctor` detects the exact broken combination (Vitest ≥5.0.0 with `@stryker-mutator/vitest-runner` ≤10.0.0) and reports it as an error before you waste time on a misleading run ([`packages/cli/src/lib/doctor.ts`](../packages/cli/src/lib/doctor.ts)).
2. `tautest run` independently refuses to *score* any run in which even one surviving mutant executed zero tests, regardless of why — exit code 12, `STRYKER_ZERO_TESTS_EXECUTED`, instead of a confident-looking but meaningless score ([`packages/core/src/stryker/report-parser.ts`](../packages/core/src/stryker/report-parser.ts)).

The second one is worth calling out because the same principle, one layer deeper, has an open pull request against StrykerJS itself: [stryker-js#6146](https://github.com/stryker-mutator/stryker-js/pull/6146), titled "never report a mutant run that executed zero tests as survived," by `scolladon`. That PR retries a filtered mutant run that executed nothing and, if it stays empty, reports an error instead of a survivor, inside the runner. Tautest's check sits after the fact, at the report: it can't fix the run, so it refuses to turn it into a score. Different layers, same rule: a run that executed zero tests is not evidence of anything.

## What we did to help

Waiting for an upstream fix without checking on it is how these things sit for months. So instead of just linking the issue and moving on, we did two things:

**Verified the proposed fix actually works.** `scolladon` also opened [stryker-js#6214](https://github.com/stryker-mutator/stryker-js/pull/6214), a fix for the separator bug, with a clear diagnosis and unit tests — but it had sat with zero reviews and no CI checks reported. Its author has no previously merged pull request in the repository, and GitHub by default holds workflow runs from such contributors until a maintainer approves them, which fits what we saw. Reading a diff and trusting it is not the same as knowing it works, so we applied the equivalent change directly to an installed `@stryker-mutator/vitest-runner@10.0.0` and ran a real mutation test against Vitest 5.0.2, before and after:

| | score | killed | survived | tests run per mutant |
|---|---|---|---|---|
| unpatched | 0.00% | 0 | 8 | 0.00 |
| patched with #6214's fix | 100.00% | 8 | 0 | 1.13 |

**Checked a secondary concern raised in the issue thread.** A later commenter reported that *static* mutants (ones that don't need a per-test filter at all) were also affected on their project, which would mean #6214 alone doesn't fully fix things. We built a minimal case specifically to get a genuinely static-classified mutant and ran it on the unpatched runner: it was correctly killed, while the filter-dependent mutants in the same run were falsely reported as survived — matching the original issue's own claim that static mutants are unaffected. That doesn't rule out something project-specific in the other report, but in our reproduction the failure mode described in the issue is explained by the separator bug and fixed by #6214.

We posted both results as a comment on the issue: [stryker-js#6210 (comment)](https://github.com/stryker-mutator/stryker-js/issues/6210#issuecomment-5856700417).

## Where this leaves Tautest

Still blocked, on purpose. Neither #6214 nor #6146 has merged or shipped in a release yet, and we're not going to advertise Vitest 5 support based on an unmerged fork PR, however well-verified. `tautest doctor` keeps refusing the combination, and this file — along with the [compatibility notes in the README](../README.md#install) — gets updated the moment a released `@stryker-mutator/vitest-runner` actually fixes it. If you hit this wall today, the workaround is the one Tautest already tells you: keep `vitest` on `^4` until then.
