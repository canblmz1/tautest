# Importing the original 439 MB report

Published Tautest 2.1.2 rejects the original JSON from [this upstream run](https://github.com/rajbos/ai-engineering-fluency/actions/runs/39218400571) because it exceeds 128 MiB. The new importer accepts that same original file directly:

```sh
tautest analyze --from mutation.json
```

This maintainer reproduction checks a pre-release build, not published 2.1.2 and not independent adoption. It does not run the upstream tests or mutation engine. The report records a Node command runner without per-test coverage attribution; Tautest does not invent test names or claim Vitest compatibility.

The original remains 439,247,725 bytes with SHA-256 `ef24536f77c4ae8edce49307bf81daf5852d11aa2fe3b79fa418f95d585e9638`. Only 3,096 mutant `statusReason` diagnostic strings are omitted from the analysis. Every retained field is deeply equal to the [independently compacted reference](https://github.com/canblmz1/tautest/tree/296f86b/docs/evidence/adoption/rajbos-report), whose streaming recipe checked all other JSON events. Source, replacements, locations, identities, statuses and available test metadata match. Keep the original for diagnostics.

The built CLI succeeds with a 128 MiB old-generation heap limit; measured peak process RSS on Windows/Node 22.23.2 is 107,724 KiB. These measurements apply to this report. The general import limit is 1 GiB input and 128 MiB retained JSON, not a universal 128 MiB process-memory guarantee. Both semantic comparison and CLI execution together took 18.696 seconds. Raw totals remain 3,096 Killed, 1,033 Survived and 14 Timeout, yielding 868 expression groups. Tautest includes Timeout in its score numerator; this is not the issue dashboard's alternative score calculation.

To reproduce after installing dependencies and building the repository, obtain the original `mutation.json` from the upstream run and the compact reference above, then run:

```sh
pnpm exec tsx scripts/check-large-report-import.mts /path/to/original/mutation.json /path/to/compact.mutation.json
```

The script compares the entire retained object, rechecks the original hash after importing, and executes the built CLI from a new temporary directory under the heap limit. It prints the evidence metrics and retains its temporary CLI output. No upstream source/report is redistributed in this directory.
