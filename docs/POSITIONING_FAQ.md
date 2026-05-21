# Positioning FAQ

## How is Tautest different from StrykerJS?

StrykerJS is the mutation testing engine. Tautest is a PR workflow layer around it.

StrykerJS answers:

- Which mutants survived?
- What is the mutation score?
- Which files and tests were involved?

Tautest answers:

- Which changed production lines in this PR should be mutated?
- Which surviving mutants matter most for review?
- What missing behavior should a test cover?
- What deterministic prompt can I give to Claude Code, Cursor, Codex, OpenCode, or a human?
- How should this appear in CI as a sticky PR comment, artifact, and job summary?

If a team already uses StrykerJS directly and is happy with full-project mutation runs, they may not need Tautest.

Tautest is for teams that want mutation testing to fit into the PR review loop.

## Can agents just read Stryker reports?

Yes, capable agents can read Stryker reports.

The problem is not whether an agent can parse a report. The problem is turning mutation output into a narrow, repeatable, test-only workflow that is safe enough to use during code review.

Tautest adds that workflow:

- diff-scoped mutation ranges;
- short reports focused on changed production lines;
- ranked surviving/no-coverage mutants;
- deterministic missing-behavior explanations;
- hard rules for test-only fixes;
- validation commands;
- GitHub sticky comments and artifacts.

That saves humans and agents from rediscovering the same workflow every PR.

## How is this different from coverage?

Coverage says code ran.

Mutation testing asks whether tests would fail if behavior changed.

Tautest keeps that question small by asking it only for changed production lines in a PR.

## Is Tautest an AI testing tool?

Not by itself.

Tautest does not generate tests automatically and does not call LLM APIs. It produces deterministic reports and prompts that make an AI-assisted test-fix task smaller and safer.

The core value still works for humans.

## Is this a generic quality platform?

No.

Tautest should stay focused on this loop:

```text
changed source lines -> mutation testing -> surviving mutants -> readable report -> test-fix prompt -> stronger tests
```

Cloud dashboards, generic AI evaluation, and automatic LLM fixing are intentionally outside the core product.

## When should I not use Tautest?

Do not start with Tautest when:

- your normal test suite is unreliable;
- your project cannot run StrykerJS;
- your PRs are too large for changed-line mutation testing to stay fast;
- your team wants full-project mutation testing instead of PR-focused review;
- you need non-JS language support today.

## What is the best first demo?

Use `examples/vitest-basic`.

The normal tests pass, but Tautest finds a surviving boundary mutant. Add the missing boundary test, rerun Tautest, and the mutation score improves to `100%`.

See [DEMO.md](DEMO.md).
