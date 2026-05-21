# Why Tautest?

Tautest exists to make mutation testing practical inside pull request review.

It is not a new mutation engine. It does not replace StrykerJS. It does not call LLM APIs. It does not claim that coding agents cannot read reports.

The value is narrower and more practical:

> Coverage shows that changed code ran. Tautest checks whether tests fail when changed behavior is mutated.

## The problem

Passing tests can still miss important behavior.

A pull request can have:

- green unit tests,
- acceptable line coverage,
- a reviewer-approved diff,
- and still have a changed branch, boundary, or condition that is not really protected by tests.

Coverage is useful, but it answers a limited question: did this line run?

Mutation testing asks a sharper question: if this behavior changes, do tests fail?

The hard part is that broad mutation testing can be slow, noisy, and awkward to use in every pull request.

## What Tautest adds

Tautest uses StrykerJS for mutation testing and adds a pull-request workflow around it.

Tautest:

- reads the Git diff,
- finds changed production source lines,
- turns those lines into StrykerJS mutation targets,
- runs StrykerJS,
- extracts surviving mutants that matter to the changed code,
- writes Markdown, JSON, terminal, GitHub comment, and job summary output,
- and generates a deterministic test-fix prompt for humans or coding agents.

The product shape is:

```text
changed source lines -> mutation testing -> surviving mutants -> readable report -> test-only fix task
```

## How this differs from StrykerJS

StrykerJS is the engine. Tautest is the PR workflow layer.

StrykerJS is responsible for:

- creating mutants,
- running mutant test cycles,
- integrating with test runners,
- calculating mutation results,
- and producing mutation reports.

Tautest is responsible for:

- choosing the changed source lines from a pull request,
- passing that focused scope to StrykerJS,
- filtering and summarizing survivors around the diff,
- turning raw findings into review-ready output,
- posting GitHub feedback,
- and creating a small test-fix task.

If you want full-project mutation testing, custom StrykerJS configuration, or Stryker Dashboard workflows, use StrykerJS directly.

If you want mutation testing to behave like a changed-code PR quality gate, Tautest is the layer around StrykerJS that aims to make that workflow easier.

## How this differs from coverage gates

Coverage can tell you that code ran during tests. It cannot tell you whether the assertions would catch a wrong behavior.

Example:

```ts
return age >= 65;
```

A test suite might execute this line and still miss the exact boundary behavior. A mutation such as this can survive:

```ts
return age > 65;
```

That surviving mutant means the tests did not protect the `age === 65` boundary.

This is the core difference:

- coverage gate: did the changed line run?
- Tautest gate: did tests fail when changed behavior was mutated?

Tautest should feel closer to patch coverage in the PR loop, but the signal is mutation survival rather than line execution.

## How this differs from giving reports to an agent

Coding agents can read mutation reports. That is true, and Tautest should not pretend otherwise.

The point is not that agents cannot read reports. The point is that raw reports are often too broad and underspecified for a safe test-fix workflow.

Tautest tries to give agents and humans a smaller deterministic task packet:

- these changed lines were mutation-tested,
- these mutants survived,
- this is the likely missing behavior,
- strengthen tests only,
- do not change production code,
- run the normal test suite,
- run Tautest again.

That constraint matters. It keeps the workflow focused on improving tests instead of letting an agent "fix" production code to satisfy a mutation report.

## When Tautest may not add much

Tautest is not for every team.

It may not add much if:

- you already run StrykerJS directly on every pull request,
- your mutation runs are already fast enough,
- your team already reviews raw mutation reports effectively,
- your agents already turn those reports into reliable test-only fixes,
- or you need broad full-project mutation campaigns rather than PR-local feedback.

In those cases, direct StrykerJS usage may be enough.

## Best-fit users

Tautest is most useful for:

- TypeScript or JavaScript projects using Vitest or Jest,
- teams that review most changes through GitHub pull requests,
- teams that want stronger test quality gates than coverage alone,
- projects where full mutation testing is too expensive for every PR,
- and teams experimenting with Claude Code, Cursor, Codex, OpenCode, or similar agents.

## One-sentence positioning

Tautest is a PR mutation quality gate for changed JavaScript and TypeScript code.

It uses StrykerJS to find surviving mutants, then turns them into actionable test gaps for humans and coding agents.

## Short answer to the common objection

Question:

```text
How is this different from other mutation testing tools?
Pretty sure agents can read the reports?
```

Answer:

```text
Fair point. Tautest is not trying to be a new mutation engine or claim that agents cannot read mutation reports.

StrykerJS does the mutation testing. Tautest sits around it and focuses on pull requests: it maps the git diff to changed source lines, runs StrykerJS on that smaller mutation scope, extracts the surviving mutants, and turns them into PR-friendly Markdown/JSON, GitHub comments, job summaries, artifacts, and an AI/human test-fix prompt.

So the value is not "agents cannot read reports." They can. The value is giving them a small, deterministic task packet: these changed lines survived mutation, here is the exact missing behavior, strengthen tests only, do not change production code, then rerun the suite.

If you already run StrykerJS on every PR and your agents reliably parse the reports and turn them into good test-only fixes, Tautest may not add much. It is mainly for teams that want mutation testing to become a changed-code PR quality gate with lower setup and review friction.
```
