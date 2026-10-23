# Report-consumer fixture: published Tautest 2.1.5

Prepared for [TzolkinB/skills #259](https://github.com/TzolkinB/skills/issues/259), which proposes consuming mutation evidence and explicitly asks how to handle old or edited reports. This is our own toy control, not their implementation, acceptance or independent use. Their [#249 source review](https://github.com/TzolkinB/skills/issues/249) explicitly says Tautest was cloned/read but not run.

## Three different artifacts

| File | Meaning in this fixture |
| --- | --- |
| [mutation.json](mutation.json) | Unchanged raw StrykerJS 10.0.0 output from our 22 October published-2.1.5 toy run. Its observed schemaVersion is `1.0`; `files[*].mutants` retains all four raw records, `coveredBy`/`killedBy` join to `testFiles[*].tests[*].id`. |
| [report.json](report.json) | Normalized Tautest report: `version: "1"`, `schemaVersion: "1"`; aggregate `summary`, scope and actionable mutant context. Validated against [the published-version schema](https://github.com/canblmz1/tautest/blob/1ed141795ef28cc9b1e20cbbd2c165152f92e799/docs/report.schema.json). `surviving` is an actionable-findings list, not the complete raw mutant/test-attribution table; `stryker` is engine metadata, not embedded raw JSON. |
| [review.json](review.json) | Analysis context: original input SHA-256, raw summary, expression groups and review completeness. It is separate from the normalized-report schema. `contextHash: null` here because the matching project checkout is absent; manual decisions are unavailable. |

Do not select a parser from the filename alone. `analyze --json` stdout is an analysis envelope with `status`, input/groups and output paths; it is **not** the same object as the generated `report.json`. For complete raw killing-test identities consume the Stryker report, not only Tautest's actionable list.

## Actually exercised command

Save `mutation.json` in an otherwise disposable folder. With Node 22 or 24, the portable equivalent of the exercised invocation is:

```sh
npx --yes tautest@2.1.5 analyze --from mutation.json --runner vitest --json
```

Read `.tautest/review/report.json` and `.tautest/review/review.json`. [control.json](control.json) records two actual Windows/Node 22.23.2 invocations with their absolute paths and explicit output-directory flags, exit 0, unchanged input bytes and schema validation. Both preserved **4 total / 3 Killed / 1 Survived / 75%**. The remaining replacement is `age > 18`; the existing toy tests check ages 20 and 17, leaving the age-18 boundary untested. The engine was not rerun by these imports. Original engine/test/verification provenance is linked separately in the control record.

## Trust and freshness limits

- Importing an old report succeeds read-only. Repeating the import changed `createdAt` while retaining the identical input hash and results. Here `createdAt` is report-generation time, **not mutation execution time or proof that current source/tests match**.
- The recorded input hash identifies bytes. A hash stored alongside editable data is not a signature, trusted producer identity or authenticity proof. These artifacts are unsigned; the local toy commit IDs are not public upstream provenance.
- No threshold was evaluated during analysis. `summary.verdict`, score, complete recorded statuses and exit 0 are not a new diff/patch gate, a candidate-test verification result or a ship verdict. The raw engine's break threshold is not silently adopted as an imported gate.
- A consumer needing current-commit evidence must establish that association from its own trusted producer/CI record, with report hash, source/test/config/environment identity and execution provenance. If unavailable or mismatched, retain the uncertainty rather than using this example's render timestamp as freshness evidence. No new attestation feature is implemented here.

The files retain this machine's harmless local paths as actual output; consumers regenerate their own paths. The toy source and test are ours under [MIT](LICENSE.txt). No upstream project source is copied, no project installation/configuration/tests run during the first-look command, and no claim about Playwright/Cypress execution is made. Current built-in mutation runners remain Vitest and Jest; this fixture does not add a browser-aware runner.
