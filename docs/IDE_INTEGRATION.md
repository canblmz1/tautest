# IDE Integration Contract

Tautest IDE integrations should consume `.tautest/report.json` first. The static HTML report is a human-facing companion, not the source of truth.

## Stable Inputs

- `.tautest/report.json`: canonical machine-readable report, validated by [report.schema.json](report.schema.json).
- `.tautest/report.html`: optional static viewer generated with `tautest report --html`.
- `.tautest/fix-prompt.md`: deterministic agent or human remediation prompt.

## Recommended Extension Flow

1. Watch for `.tautest/report.json` changes.
2. Parse `version` and `schemaVersion`; reject unknown major versions.
3. Render diagnostics for `surviving[]` entries using `filePath`, `line`, `mutatorName`, `original`, `replacement`, and `insight`.
4. Link each diagnostic to the matching source file and line.
5. Offer commands to open `.tautest/report.html` and `.tautest/fix-prompt.md`.
6. Never edit production files automatically.

## Diagnostic Mapping

Each surviving mutant has the fields an IDE needs:

- `filePath`: repository-relative file path.
- `line`: one-based source line.
- `location.start` and `location.end`: source range from the mutation report when available.
- `mutatorName`: mutation operator.
- `status`: Stryker status.
- `insight.missingBehavior`: concise diagnostic message.
- `insight.suggestedTestIdea`: quick-fix style hint text.

Suggested severity:

- `Survived`: warning.
- `NoCoverage`: information or warning, depending on team policy.
- `Timeout`, `RuntimeError`, `CompileError`: warning with a run-stability note.

## HTML Data Attributes

`tautest report --html` writes survivor cards with stable data attributes:

```html
<article
  data-tautest-file="src/discount.ts"
  data-tautest-line="2"
  data-tautest-mutator="EqualityOperator">
</article>
```

The HTML file also embeds the full report JSON in:

```html
<script type="application/json" id="tautest-report-data"></script>
```

This lets lightweight IDE webviews reuse the same static viewer while still grounding all diagnostics in `report.json`.

## Non-Goals For The First Extension

- Do not run mutation testing automatically on every keystroke.
- Do not call LLM providers from the IDE extension by default.
- Do not apply generated suggestions without an explicit human review step.
- Do not rely on Stryker raw reports when normalized Tautest fields are available.
