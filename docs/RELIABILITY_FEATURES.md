# Reliability Features

Tautest reliability features are local-first helpers around flaky-test risk, change-driven test selection, deterministic time helpers, scaffold generation, and controlled chaos runs.

## Support tiers

| Feature | Tier | Notes |
| --- | --- | --- |
| `predict-flaky` for JS/TS test files | MVP | Deterministic static rules; no automatic LLM calls. |
| `watch` affected-test planning | MVP | Static relative import graph for JS/TS; command hints only. |
| `scaffold` for JS/TS | MVP | Generates Vitest/Jest starter tests. |
| `scaffold` for Python/pytest | Experimental | Boilerplate generation only; not full Python mutation support. |
| `time-travel init` | MVP | Generates Vitest/Jest fake-timer helpers. |
| `chaos` | MVP | App-level Node `fetch` fault injection; no OS-level network manipulation. |

## Design constraints

- Mutation reports keep using `.tautest/report.json`.
- Reliability features write separate artifacts such as `.tautest/flaky-report.json`, `.tautest/watch-report.json`, and `.tautest/chaos-report.json`.
- Risk scores are explainable heuristic scores, not calibrated failure probabilities.
- LLM-based enrichment remains opt-in and is not part of these default commands.
- Hosted dashboards and OS-level packet loss are intentionally out of scope for the MVP.

## Recommended rollout

1. Use `tautest predict-flaky --threshold 80` as an advisory CI signal before making it blocking.
2. Use `tautest watch --json` to validate affected-test selection in repositories with simple relative imports.
3. Generate time helpers with `tautest time-travel init` and wire the setup file into the existing runner config manually.
4. Use `tautest chaos` on focused suites first, with fixed seeds, before expanding to larger integration suites.
