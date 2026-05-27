# ADR 0003: Keep Tautest Local-First By Default

## Status

Accepted

## Context

Tautest runs user code and test suites. It also emits prompts for coding agents, but automatic provider calls can introduce token, privacy, and trust-boundary risks.

## Decision

Keep the default workflow local-first and deterministic. Tautest may produce Markdown, JSON, HTML, and prompt artifacts, but it must not call external LLM providers unless the user explicitly opts into a separate suggestion command or provider integration.

## Consequences

- Generated fix prompts stay safe to review, paste, and version-control as local artifacts.
- Provider integrations must be opt-in, documented, and isolated from the deterministic core path.
- Hosted dashboards or remote orchestration are outside the current product boundary.

