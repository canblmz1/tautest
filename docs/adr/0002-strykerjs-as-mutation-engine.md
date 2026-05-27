# ADR 0002: Use StrykerJS As The JS/TS Mutation Engine

## Status

Accepted

## Context

Tautest is differentiated by changed-line PR workflow, reports, GitHub feedback, and deterministic test-fix prompts. It is not differentiated by inventing a new mutation engine.

## Decision

Keep StrykerJS as the mutation engine for JavaScript and TypeScript execution. Tautest should generate the scoped mutate configuration, run StrykerJS, parse its output, and present the results in PR-friendly formats.

## Consequences

- Tautest inherits StrykerJS runner and mutator behavior instead of duplicating it.
- Jest, Vitest, and future JS runner work should be modeled as StrykerJS configuration and diagnostics work first.
- Non-JS language work remains parser and adapter groundwork until a separate execution strategy is accepted.

