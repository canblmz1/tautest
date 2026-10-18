Gazetta renderer report import, 2026-10-18 UTC

Source: https://github.com/gazetta-studio/gazetta-studio/issues/935
Artifact: mutation-report, run 39109392655, source ccaed351
https://github.com/gazetta-studio/gazetta-studio/actions/runs/39109392655

The artifact contains mutation.html, not mutation.json. For this experiment,
the embedded app.report literal was extracted to JSON without executing HTML
or JavaScript. Tautest analyze itself accepts JSON, not HTML. The original
HTML and converted JSON hashes are recorded in evidence.json.

renderers.mutation.json keeps src/publish-renderers.ts, all its original 158
mutants, and referenced test names/locations from the original report.
Source and raw mutant records are unchanged. It is a slice, not a fresh run.
The MIT notice for that source is in PROJECT-LICENSE.

Try it in an empty directory with Node 22 or 24:

  curl -L https://raw.githubusercontent.com/canblmz1/tautest/evidence/triad-address/docs/evidence/adoption/gazetta-renderers/renderers.mutation.json -o renderers.mutation.json
  npx --yes tautest@2.1.1 analyze --from renderers.mutation.json --runner vitest

On Windows PowerShell use curl.exe instead of curl.
Open .tautest/review/report.md and .tautest/review/fix-prompt.md.
No project checkout, Stryker install or mutation rerun is needed for analysis.
Saving review decisions would need matching local source.

Observed slice:
  Killed 36, CompileError 60, Survived 55, NoCoverage 7, total 158.
  All 62 Survived/NoCoverage findings appear in 55 source-expression groups.

Example at line 137: replacing `index.${ctx.locale}.html` with an empty
template literal survived. Its two covering tests are:
  tests/publish-renderers.test.ts:
    renderPageWithEsi — pure fn locale-suffixes index file when locale set
  tests/publish-pages.test.ts:
    publishPage — wrapper preserves locale through to spine
This identifies tests to inspect; it does not prove their assertions are wrong
or that the mutant is inequivalent. No test was added or run in this experiment.

The original full artifact has 5,174 mutants: 1,785 Killed, 762 Survived,
587 NoCoverage, 2,034 CompileError and 6 Timeout. Its 1,349 findings appeared
in 1,184 groups. Those full-project counts do not describe the smaller slice.
CompileError and Timeout are preserved; a timeout is not an assertion kill.

All analysis was performed by the Tautest maintainer. This is neither an
external user's first run nor evidence of adoption. Current Gazetta HEAD was
not changed, tested, or claimed to match this older artifact.
