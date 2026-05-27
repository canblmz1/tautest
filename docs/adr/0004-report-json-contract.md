# ADR 0004: Treat report.json As The Integration Contract

## Status

Accepted

## Context

The CLI, GitHub Action, static HTML report, IDE experiments, and future review tooling all need a stable machine-readable contract.

## Decision

Use `.tautest/report.json` and `docs/report.schema.json` as the public integration contract. New integrations should consume the schema instead of importing private implementation modules.

## Consequences

- Schema changes must be intentional and tested.
- IDE and PR tooling can evolve without coupling to internal core files.
- Breaking report contract changes require a schema version update and migration notes.

