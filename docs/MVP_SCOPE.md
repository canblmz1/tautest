# Tautest MVP Scope

## Scope Strategy

Tautest should progress from local proof to CLI workflow to GitHub PR integration. Each version must preserve the same product boundary: StrykerJS is the mutation engine; Tautest is the diff, workflow, report, prompt, and PR layer.

## v0.1: Local Technical Proof

Goal: prove that Git diff line ranges can drive StrykerJS mutation runs and produce a useful local report.

Included:

- Local-only command prototype.
- Git base/head diff detection.
- Changed production source file detection for JS/TS files.
- Conversion from changed line ranges to StrykerJS `mutate` range entries.
- StrykerJS execution through CLI/config, not deep programmatic API.
- Vitest happy-path fixture.
- Jest happy-path fixture.
- JSON report parsing.
- Minimal terminal summary:
  - files scoped
  - line ranges scoped
  - mutants generated
  - killed mutants
  - surviving mutants
  - no-coverage mutants
  - timeout/error mutants
- Markdown report artifact.
- Clear unsupported-state messages.

Excluded:

- GitHub Action.
- Sticky comments.
- Monorepo auto-detection.
- Dashboard.
- Cloud service.
- AI prompt quality tuning beyond a first deterministic prompt.
- Auto-fixing tests.

Exit criteria:

- A simple Vitest project can run mutation testing only for changed source lines.
- A simple Jest project can run mutation testing only for changed source lines.
- The report makes at least one surviving mutant understandable without opening Stryker HTML.

## v0.2: CLI

Goal: turn the local proof into a usable developer CLI.

Included:

- Published or publishable CLI shape.
- Commands:
  - `tautest run`
  - `tautest report`
  - `tautest prompt`
- CLI options:
  - `--base`
  - `--head`
  - `--runner vitest|jest|auto`
  - `--config`
  - `--max-mutants`
  - `--timeout`
  - `--report-file`
  - `--prompt-file`
  - `--fail-on-survived`
  - `--report-only`
- Runner auto-detection for straightforward Vitest/Jest projects.
- Generated temporary Stryker config.
- Deterministic Markdown report.
- Deterministic AI fix prompt.
- Basic caps for files, changed lines, mutants, and runtime.
- Exit codes suitable for CI.
- Documentation for setup and troubleshooting.

Excluded:

- GitHub-specific behavior.
- Hosted storage.
- Persistent project history.
- Automatic test selection beyond Stryker/Vitest/Jest capabilities.
- Workspace-wide monorepo orchestration.

Exit criteria:

- A developer can install and run Tautest locally in a small Vitest or Jest repo with minimal configuration.
- CLI output is stable enough to snapshot-test.
- Generated prompts are structured enough to paste into an AI coding agent.

## v0.3: GitHub Action

Goal: show mutation results directly on GitHub pull requests.

Included:

- GitHub Action wrapper around the CLI.
- PR base/head resolution.
- Dependency install guidance.
- Sticky PR comment creation/update.
- GitHub job summary fallback.
- Minimal permissions documentation.
- Safe behavior for forked PRs and Dependabot PRs.
- Configurable failure behavior:
  - fail on surviving mutants
  - warn only
  - report only
- Uploaded report artifact.
- Uploaded AI prompt artifact.

Excluded:

- `pull_request_target` flow that executes untrusted code with write credentials.
- Cloud dashboard.
- Multi-package monorepo orchestration.
- Inline PR review comments per mutant.
- Automatic commits or test fixes.

Exit criteria:

- Same-repository PRs receive one updated sticky comment.
- Fork or restricted-token PRs still receive a job summary.
- The Action can be adopted without broad write permissions.

## v1.0: Public Beta

Goal: make Tautest reliable enough for early external teams using GitHub, Vitest, Jest, JavaScript, and TypeScript.

Included:

- Stable CLI and GitHub Action interfaces.
- Clear compatibility matrix:
  - Node versions
  - StrykerJS versions
  - Vitest versions
  - Jest versions
  - supported project shapes
- Strong error messages for unsupported configurations.
- Fixture test suite covering common project variants.
- Report format versioning.
- Prompt format versioning.
- Config file support.
- Runtime guardrails and visible skipped-work reporting.
- Documentation:
  - positioning
  - install
  - CLI usage
  - GitHub Action usage
  - troubleshooting
  - limitations
  - examples
- Public beta examples for one Vitest project and one Jest project.

Explicitly out of scope for v1.0:

- Monorepo orchestration.
- Hosted dashboard.
- Cloud storage.
- Python support.
- Java support.
- .NET support.
- Go support.
- Custom mutation engine.
- Custom mutator ecosystem.
- Automatic AI agent execution.
- Guaranteed auto-fixing.

Exit criteria:

- External users can understand that Tautest is powered by StrykerJS.
- Setup succeeds in common Vitest/Jest projects without hand-written Stryker expertise.
- PR feedback is short, stable, and actionable.
- Runtime is acceptable on small to medium PRs under documented caps.

## Capability Ladder

| Capability | v0.1 | v0.2 CLI | v0.3 GitHub Action | v1.0 Public Beta |
| --- | --- | --- | --- | --- |
| Git diff line scoping | Yes | Yes | Yes | Yes |
| StrykerJS execution | Yes | Yes | Yes | Yes |
| Vitest support | Happy path | Basic supported | Basic supported | Compatibility matrix |
| Jest support | Happy path | Basic supported | Basic supported | Compatibility matrix |
| Markdown report | Minimal | Stable | PR-ready | Versioned |
| AI prompt | First pass | Stable artifact | Uploaded artifact | Versioned |
| Sticky PR comment | No | No | Yes | Yes |
| Monorepo orchestration | No | No | No | No |
| Dashboard/cloud | No | No | No | No |

## Assumptions

- The repo can start documentation-first and implement code in the next phase.
- Early users accept installing StrykerJS peer/dev dependencies.
- The CLI can be the foundation for both local and GitHub Action usage.
- GitHub is the only v1 PR platform.
- Public beta quality means reliable for early adopters, not feature-complete for every JS project.
