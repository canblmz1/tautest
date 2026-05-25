# Multi-Language Alpha

Tautest remains production-focused on JavaScript and TypeScript through StrykerJS. Phase 9 introduces the internal architecture needed for other languages, but Python and Java are still alpha parser prototypes.

## What Exists Now

- Internal runner plugin types and registry in `@tautest/core`.
- Engine-neutral normalized mutation report types.
- StrykerJS adapter that can parse existing Stryker JSON into normalized data.
- `mutmut-alpha` parser helper for Python-shaped mutation results.
- `pit-alpha` XML parser helper for PIT mutation reports.

## What Does Not Exist Yet

- Tautest does not run `mutmut`.
- Tautest does not run Maven, Gradle, or PIT.
- Python and Java reports are not wired into `tautest run`.
- Changed-line mutation scoping is not guaranteed outside StrykerJS.
- IDE/PR annotations for Python and Java need more source mapping work.

## Runner IDs

| Runner ID | Language | Status | Notes |
| --- | --- | --- | --- |
| `stryker-js` | JavaScript/TypeScript | supported path | Existing Tautest behavior remains the default. |
| `mutmut-alpha` | Python | parser alpha | Parses normalized mutmut-like results only. |
| `pit-alpha` | Java | parser alpha | Parses PIT XML into normalized results only. |

## Launch Criteria Before Beta

Python beta requires:

- pytest fixture with documented setup;
- mutmut execution wrapper;
- parser fixtures from real mutmut output;
- honest limitations in terminal, Markdown, JSON, and HTML reports.

Java beta requires:

- Maven fixture with documented PIT setup;
- PIT execution wrapper or documented report-import mode;
- parser fixtures from real PIT XML;
- source file to class mapping notes;
- explicit multi-module limitations.

## Safety Rules

Mutation runners execute project tests and build tools. New language runners must:

- run commands with argument arrays;
- avoid dependency installation by default;
- keep generated files under the configured output directory;
- redact or avoid logging secrets;
- preserve raw engine metadata under normalized `engineMetadata`;
- mark unavailable fields as unknown instead of inventing precision.
