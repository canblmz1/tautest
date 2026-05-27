# Roadmap

The near-term product boundary is a JavaScript/TypeScript PR mutation workflow layer on top of StrykerJS. The project is continuing the current architecture and hardening it in phases rather than rewriting it. See the [hardening and adoption plan](tautest-hardening-adoption-plan.md) and [architecture decision records](adr/0001-continue-not-rewrite.md).

## Support Tiers

| Area | Tier | Roadmap posture |
| --- | --- | --- |
| Vitest JS/TS | Supported | Keep stable while improving reporting, docs, and action feedback. |
| Jest JS/TS | Beta | Harden fixtures, diagnostics, and documented recipes before declaring GA. |
| Workspace execution | Beta | Improve package selection, aggregate reports, and observability before adding concurrency. |
| Python and Java | Alpha groundwork | Keep parser and adapter work clearly experimental until JS/TS reliability is stronger. |
| LLM execution | Opt-in only | Keep deterministic prompts as default; provider calls stay explicit. |
| Hosted dashboard | Out of scope for v1 | Revisit only if local-first CLI and CI adoption justify it. |

## Near Term

- Harden Jest beta with more fixtures.
- Add more config examples for ESM/CJS and path aliases.
- Improve no-coverage explanations.
- Improve GitHub Action cache observability.
- Validate GitHub Action Node 24 runtime migration.

## V1 Scope

- Vitest-first workflow.
- Jest beta.
- Changed-line mutation scope.
- Markdown/JSON/terminal reports.
- AI fix prompts.
- GitHub PR sticky comments.

## Later

- Better monorepo orchestration.
- Evaluate a standalone GitHub Action repository if the monorepo action path remains adoption friction.
- Report format plugins.
- IDE integrations on top of the `report.json` contract and static HTML viewer.
- Runner plugin architecture with Python and Java alpha parsers.
- Richer PR review annotations beyond survivor workflow annotations.
- More test-runner recipes beyond the current framework recipe set.

## Explicitly Out Of Scope For V1

- Custom mutation engine.
- Cloud dashboard.
- Python, Java, or non-JS language support.
- Automatic LLM execution.
- Full monorepo graph scheduling.
