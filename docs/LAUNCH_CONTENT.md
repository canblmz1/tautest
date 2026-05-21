# Launch Content

## Hacker News

Title:

```text
Show HN: Tautest, PR-focused mutation testing prompts for AI coding agents
```

Post:

```text
I built Tautest, a workflow layer on top of StrykerJS.

It reads the Git diff for a PR, scopes mutation testing to changed source lines, turns surviving mutants into a readable report, and writes a test-fix prompt you can hand to Claude Code, Cursor, Codex, OpenCode, or a human.

The goal is not to replace Stryker. Stryker is the mutation engine. Tautest is the PR and AI-agent workflow around it.

The motivating problem: tests can pass and coverage can look high while the exact changed behavior is still weakly asserted. Tautest tries to make that gap visible at review time.

Current scope:
- Vitest first
- Jest beta
- CLI
- GitHub Action with sticky PR comments
- deterministic prompts, no LLM API calls

Known limitations are documented. Monorepo support is still limited, and Jest is beta.
```

## Reddit

```text
I'm launching Tautest v1, a small open-source tool for PR-focused mutation testing on top of StrykerJS.

What it does:
- reads your Git diff
- mutates only changed production source lines
- runs StrykerJS
- writes a readable report for surviving mutants
- generates a test-fix prompt for Claude Code, Cursor, Codex, OpenCode, or a human
- can post a sticky GitHub PR comment

It does not implement a mutation engine. StrykerJS does that work.

The prompt is deterministic and file-based; there is no LLM API integration. It tells the agent to edit tests only, avoid filler tests, avoid weakening assertions, and rerun mutation testing until the mutant is killed.

Vitest is the primary path. Jest support is beta.
```

## Reddit objection reply

Question:

```text
How is this different from all the other mutation testing tools? Pretty sure agents can read the reports?
```

Reply:

```text
Fair question.

Tautest is not trying to be a new mutation engine. StrykerJS is the engine and gets full credit for mutation testing.

The difference is the PR workflow around it:
- start from the Git diff
- mutate changed production lines only
- turn the surviving mutants into a short review report
- explain the likely missing behavior
- generate a deterministic test-fix prompt with hard rules like "do not change production code"
- post that in GitHub as a sticky PR comment/artifact

You're right that capable agents can read Stryker reports. The problem is that raw mutation output is not the whole workflow. You still need to decide which changed lines matter, what the agent is allowed to edit, what validation loop it should run, and how reviewers see it in CI.

Tautest packages that into a repeatable local-first loop. If a team already runs Stryker directly on PRs and their agents/reviewers reliably act on those reports, they may not need Tautest.
```

## dev.to

```markdown
# Tautest v1: PR-focused mutation testing for AI-assisted test fixes

Tests passing is not the same thing as behavior being well specified. Coverage can tell you code ran, but mutation testing can tell you whether tests notice meaningful changes.

Tautest is a workflow layer on top of StrykerJS:

1. Read the PR Git diff.
2. Convert changed source lines into Stryker mutate ranges.
3. Run StrykerJS.
4. Convert surviving mutants into readable markdown/json reports.
5. Generate a deterministic test-fix prompt for Claude Code, Cursor, Codex, OpenCode, or humans.
6. Optionally post a sticky GitHub PR comment.

Tautest does not replace Stryker. It gives Stryker a PR-shaped workflow and gives AI coding agents a safer, narrower test-fix task.

Vitest is the primary supported runner. Jest is beta.
```

## Twitter / Bluesky

```text
Launching Tautest v1.

It reads your PR diff, runs StrykerJS only on changed source lines, explains surviving mutants, and generates a test-fix prompt for Claude Code/Cursor/Codex/OpenCode.

Vitest first. Jest beta. No LLM API. Stryker gets full credit as the engine.
```

## GitHub Release Notes

Use `docs/RELEASE_NOTES_V1.md`.

## Demo Video

Use `docs/DEMO_SCRIPT.md`.
