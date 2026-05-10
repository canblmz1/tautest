# Runner Plugin Architecture

## Purpose

Tautest v1 is built around StrykerJS for JavaScript and TypeScript. Future Python and Java support should not be bolted onto Stryker-specific internals. This document proposes a runner plugin architecture that keeps the product workflow consistent while allowing different mutation engines.

## Design Goals

- Keep `@tautest/core` engine-neutral at the report and prompt layer.
- Preserve StrykerJS as the JS/TS default runner.
- Support non-JS engines through adapters, not rewrites.
- Normalize mutation results into one stable Tautest schema.
- Make language limitations explicit in reports and docs.
- Allow plugin packages to version independently.

## Non-Goals

- Tautest will not implement its own mutation engine.
- Tautest will not hide language-specific limitations.
- Python and Java support should not block JS/TS improvements.
- No cloud dependency for plugins.

## Runner Abstraction

Conceptual interface:

```text
MutationRunnerPlugin
- id
- displayName
- languages[]
- detect(projectContext): DetectionResult
- buildPlan(scope, config): RunnerPlan
- run(plan): RunnerRunResult
- parseReport(paths): NormalizedMutationReport
- explainLimitations(projectContext): Limitation[]
```

Important boundaries:

- Detection decides whether the runner can apply.
- Plan generation maps Tautest scope into engine-specific config.
- Run execution owns subprocess/programmatic invocation.
- Parsing converts engine output into normalized Tautest data.
- Reporting and prompt generation consume only normalized data.

## Normalized Report Schema

The normalized schema should be richer than the current Stryker JSON subset but still practical:

```text
NormalizedMutationReport
- version
- runner
  - id
  - name
  - engineVersion
  - language
- scope
  - baseRef
  - changedFiles
  - mutatedFiles
  - packageName
- summary
  - mutationScore
  - killed
  - survived
  - noCoverage
  - timeout
  - errors
  - total
- mutants[]
  - id
  - status
  - filePath
  - line
  - column
  - mutatorName
  - original
  - replacement
  - coveringTests[]
  - engineMetadata
- limitations[]
```

Every plugin must map its engine output to this schema.

## Core Package Changes

New modules:

- `packages/core/src/runner/plugin.ts`
- `packages/core/src/runner/registry.ts`
- `packages/core/src/runner/types.ts`
- `packages/core/src/report/normalize.ts`

Modified modules:

- `packages/core/src/stryker/runner.ts` becomes the Stryker runner plugin.
- `packages/core/src/stryker/report-parser.ts` becomes Stryker normalization.
- `packages/core/src/report/*` reads normalized reports.
- `packages/core/src/prompt/builder.ts` reads normalized surviving mutants.
- `packages/core/src/detect/project.ts` includes language signals.
- `packages/core/src/config/schema.ts` allows runner selection.

Possible package split:

- `@tautest/core`
- `@tautest/runner-stryker`
- `@tautest/runner-mutmut`
- `@tautest/runner-pit`

Do not split until the plugin API stabilizes. Early implementation can live inside core behind internal interfaces.

## Runner Selection

Selection order:

1. Explicit config runner.
2. Explicit CLI runner flag.
3. Detected language and mutation tool.
4. JS/TS default: StrykerJS.
5. No runner with actionable reason.

Example future config:

```ts
export default defineConfig({
  runner: {
    id: "stryker",
    language: "typescript"
  }
});
```

For multi-language monorepos, selection must happen per package/project.

## StrykerJS Runner

Role:

- JS/TS primary runner.
- Owns Stryker config generation.
- Owns Stryker invocation.
- Owns Stryker JSON parsing.

Limitations:

- Vitest browser mode may not work.
- Jest remains beta until compatibility improves.
- Stryker config conflicts need diagnostics.

Launch rule:

- Stryker runner quality must not regress while adding plugin infrastructure.

## Python via mutmut

User value:

- Python teams can use Tautest's diff-scoped report and prompt workflow.

Runner:

- mutmut.

Likely integration:

- detect `pyproject.toml`, `setup.cfg`, `setup.py`, `requirements.txt`
- detect `pytest`
- map changed Python files to mutmut targets
- run mutmut in a temporary or configured mode
- parse mutmut results into normalized schema

Hard problems:

- mutmut configuration differs from Stryker.
- Changed-line scoping may be less precise depending on mutmut capabilities.
- Test discovery and coverage mapping differ from JS.
- Python packaging layouts vary widely.

Language-specific limitations:

- Start with pytest only.
- No full tox/nox matrix support initially.
- No guarantee of exact line-range mutation in first beta.
- Virtual environment management remains user-owned.

Test strategy:

- simple pytest fixture
- package-layout fixture under `src/`
- no-coverage fixture
- mutmut output parser fixtures

Launch criteria:

- beta label
- one documented working pytest path
- normalized report and fix prompt generated
- limitations printed in report

## Java via PIT

User value:

- Java teams can get mutation report summarization and AI test-fix prompts from PIT output.

Runner:

- PIT Mutation Testing.

Likely integration:

- detect Maven or Gradle
- detect PIT plugin configuration
- run PIT with scoped target classes where possible
- parse PIT XML reports
- normalize mutants into Tautest schema

Hard problems:

- Java source file to class mapping.
- Maven versus Gradle execution differences.
- Multi-module Java projects.
- PIT target class selection can be coarse.
- Test runtime can be high.

Language-specific limitations:

- Start with Maven first.
- Gradle beta after Maven.
- Multi-module Java support should wait for monorepo architecture.
- Line-level PR mapping may require source/class correlation.

Test strategy:

- Maven single-module fixture
- simple JUnit fixture
- PIT XML parser fixture
- target class selection tests

Launch criteria:

- beta label
- one documented Maven path
- normalized report and fix prompt generated
- explicit limitations in output

## Report Normalization Rules

All plugins must:

- preserve engine-specific metadata under `engineMetadata`
- map statuses into Tautest statuses
- provide file and line when available
- mark unavailable fields as unknown, not fake them
- expose limitations when exact mutation scope is unavailable

Status mapping:

- killed
- survived
- noCoverage
- timeout
- compileError
- runtimeError
- ignored
- unknown

Unknown status must lower confidence in reports and prompts.

## Prompt Generation Across Languages

The prompt builder should remain language-aware but engine-neutral.

Common hard rules:

- Do not change production code unless a real production bug is found.
- Prefer strengthening tests.
- Each new test must pass on original code and fail on the listed mutant.
- Do not add filler tests.
- Do not weaken assertions.

Language-specific prompt sections:

- JS/TS: Vitest/Jest commands.
- Python: pytest/mutmut commands.
- Java: Maven/Gradle/PIT commands.

## Plugin Versioning

Recommended policy:

- Core schema changes are semver-governed.
- Plugin packages declare compatible core schema versions.
- Engine versions are reported in every run.
- Breaking engine output changes are handled in parser contract tests.

## Security Considerations

Mutation runners execute project tests and toolchains. Plugins must:

- avoid logging secrets
- run commands with argument arrays
- not install dependencies automatically by default
- keep generated temp files inside the project or configured output directory
- document language-specific execution risks

## Launch Sequence

1. Internal runner abstraction around StrykerJS.
2. Normalized report schema.
3. Stryker plugin contract tests.
4. Python mutmut prototype.
5. Java PIT prototype.
6. Public plugin API only after two external runners prove the abstraction.

## Assumptions

- JS/TS remains the main adoption path through v1.x.
- Python and Java support are v2.0 or later unless strong user demand appears earlier.
- Non-JS engines may not support changed-line scoping as precisely as StrykerJS.
- Tautest reports should be honest about confidence and limitations.
