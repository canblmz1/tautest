# Tautest Product Positioning

## One-liner

Tautest is a PR-focused workflow layer on top of StrykerJS that runs mutation testing only where a change matters, translates surviving mutants into actionable feedback, and produces prompts that AI coding agents can use to improve tests.

## What Tautest Does

Tautest helps JavaScript and TypeScript teams use mutation testing in the pull request loop without asking every PR to pay the full cost of a broad mutation run.

Core responsibilities:

- Reads the Git diff between a base ref and a head ref.
- Detects changed production source lines.
- Converts changed line ranges into StrykerJS `mutate` targets such as `src/foo.ts:10-18`.
- Runs StrykerJS as the mutation engine.
- Starts with low-setup Vitest and Jest workflows.
- Consumes StrykerJS machine-readable output, especially JSON mutation reports.
- Filters and summarizes surviving mutants that intersect the changed source lines.
- Produces a readable local report for developers.
- Produces an AI test-fix prompt for tools such as Claude Code, Cursor, Codex, and OpenCode.
- In CI, posts or updates a sticky GitHub PR comment with the mutation result.

The product promise is not "mutation testing from scratch." The promise is "make StrykerJS useful at PR speed, with output shaped for humans and AI coding agents."

## What Tautest Does Not Do

Tautest does not:

- Implement a new mutation testing engine.
- Implement its own mutators.
- Replace StrykerJS.
- Compete with the Stryker dashboard.
- Guarantee that every surviving mutant is a real missing test.
- Automatically modify user tests in v1.
- Host a SaaS dashboard in v1.
- Support Python, Java, .NET, Go, or other non-JS ecosystems in v1.
- Support broad monorepo orchestration in v1.
- Promise full-project mutation scores as the primary workflow.

Tautest intentionally narrows the first product surface to PR-local JavaScript and TypeScript mutation feedback.

## Relationship With StrykerJS

StrykerJS is the infrastructure. Tautest is the workflow layer.

StrykerJS remains responsible for:

- Creating mutants.
- Running mutant test cycles.
- Integrating with Jest, Vitest, and other test runners.
- Reporting killed, survived, no-coverage, timeout, and error mutant states.
- Providing core mutation testing semantics.

Tautest is responsible for:

- Deciding which changed source lines should be sent to StrykerJS.
- Generating temporary Stryker configuration or CLI arguments.
- Running StrykerJS in a repeatable PR-oriented mode.
- Reading StrykerJS output and making it easier to act on.
- Translating surviving mutants into developer-facing explanations.
- Translating the same data into AI-agent prompts.
- Publishing concise PR feedback.

The default integration strategy for early versions should prefer the Stryker CLI and config files over a deep programmatic API dependency. That keeps Tautest aligned with Stryker's documented user workflow and reduces coupling to internal implementation details.

## Why Users Should Use Tautest

Teams should use Tautest when they already value tests but cannot afford full mutation testing on every PR.

Primary user benefits:

- Faster PR feedback: only changed production lines are targeted.
- Lower setup burden: Vitest and Jest projects get a guided path instead of manually tuning Stryker from scratch.
- Better signal: surviving mutants are grouped around the actual diff, not buried in a full mutation report.
- Better handoff to AI tools: Tautest turns mutation findings into concrete test-fix prompts with files, line ranges, mutant descriptions, and acceptance criteria.
- Better PR communication: GitHub comments show mutation results where review already happens.
- Better adoption path: teams can introduce mutation testing as a focused PR check before committing to organization-wide dashboards or full-suite mutation gates.

## Answer: "Stryker Already Exists, What Does This Add?"

StrykerJS answers: "Can your tests kill these mutants?"

Tautest answers: "For this pull request, which changed lines still have surviving mutants, what does that mean, and what should a developer or AI agent do next?"

Tautest adds:

- Git diff scoping: derives mutation targets from changed source lines.
- PR-first defaults: optimized for code review workflows instead of full-project audit runs.
- Runner presets: low-friction Vitest and Jest setup around the Stryker runner ecosystem.
- Report interpretation: turns raw mutation results into a concise explanation of risk.
- AI prompt generation: packages findings as a test-writing task for coding agents.
- Sticky GitHub PR comments: keeps mutation feedback visible and updated in one place.
- Product guardrails: avoids broad mutation gates that are too slow or noisy for early adoption.

This makes Tautest complementary to StrykerJS. Tautest should openly recommend StrykerJS for users who want full mutation testing, custom mutation configuration, dashboard publishing, or non-PR batch workflows.

## Target Initial Users

Best-fit early adopters:

- Small to mid-size TypeScript projects using Vitest or Jest.
- Teams already using GitHub PR review as the main quality gate.
- Teams experimenting with Claude Code, Cursor, Codex, OpenCode, or similar coding agents.
- Libraries and services where unit tests are fast enough that mutation testing on changed lines can complete inside a PR workflow.

Poor-fit early adopters:

- Large monorepos needing package graph orchestration.
- Browser-mode Vitest projects.
- Projects where tests require complex infrastructure bootstrapping.
- Teams looking for a hosted mutation dashboard.
- Teams requiring language support beyond JavaScript and TypeScript.

## Product Principles

- Treat StrykerJS as the engine and partner ecosystem.
- Make PR mutation feedback incremental, not exhaustive.
- Prefer actionable surviving-mutant explanations over broad score vanity.
- Keep v1 local-first and CI-first, not cloud-first.
- Optimize for developer trust: show exactly what changed, what ran, and what was skipped.
- Make AI prompts grounded in concrete artifacts, not generic "write more tests" advice.

## References

- StrykerJS introduction: https://stryker-mutator.io/docs/stryker-js/introduction/
- StrykerJS configuration and `mutate` ranges: https://stryker-mutator.io/docs/stryker-js/configuration/
- StrykerJS incremental mode: https://stryker-mutator.io/docs/stryker-js/incremental/
- StrykerJS Vitest runner: https://stryker-mutator.io/docs/stryker-js/vitest-runner/
- StrykerJS Jest runner: https://stryker-mutator.io/docs/stryker-js/jest-runner/

## Assumptions

- The first public product is for JavaScript and TypeScript projects only.
- The first supported test runners are Vitest and Jest.
- StrykerJS remains the mutation engine for all MVP and v1 work.
- The product optimizes for pull requests, not scheduled full-repository mutation campaigns.
- AI agents consume prompts generated by Tautest, but Tautest does not execute those agents in v1.
- GitHub is the first CI and PR surface.
